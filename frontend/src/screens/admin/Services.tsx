import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useNaturals } from "../../context";
import { money, type Service } from "../../api";
import { Badge, Body, Button, Card, Chip, Display, EmptyState, Eyebrow, Field, Img, LoadingBlock } from "../../ui";
import { MediaPicker } from "./MediaPicker";
import { buildImageUrl } from "../../api";

export function Services() {
  const {
    t,
    bp,
    categories,
    adminServices,
    servicesLoading,
    serviceForm,
    setServiceForm,
    loadAdminServices,
    saveService,
    editService,
    clearServiceEdit,
    deleteService,
    editingService,
    branchPrices,
    loadBranchPrices,
    saveBranchPrice,
    removeBranchPrice,
    adminSalons,
    loadAdminSalons,
    ask,
    notify,
    busy,
  } = useNaturals();

  const [pricingId, setPricingId] = useState<number | null>(null);
  const [priceDraft, setPriceDraft] = useState<Record<number, string>>({});
  const [availableDraft, setAvailableDraft] = useState<Record<number, boolean>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (adminSalons.length === 0) void loadAdminSalons();
  }, [adminSalons.length, loadAdminSalons]);

  useEffect(() => {
    if (pricingId) void loadBranchPrices(pricingId);
  }, [pricingId, loadBranchPrices]);

  const pricingService = adminServices.find((service) => service.id === pricingId) ?? null;

  useEffect(() => {
    if (!pricingId || !pricingService) return;
    const rows = branchPrices[pricingId] ?? [];
    const prices: Record<number, string> = {};
    const availability: Record<number, boolean> = {};
    adminSalons.forEach((salon) => {
      const row = rows.find((item) => item.salon_id === salon.id);
      prices[salon.id] = row ? String(row.price) : String(pricingService.price);
      availability[salon.id] = row ? row.is_available : true;
    });
    setPriceDraft(prices);
    setAvailableDraft(availability);
  }, [pricingId, pricingService, branchPrices, adminSalons]);

  const filtered = adminServices.filter((service) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${service.name} ${service.category} ${service.audience}`.toLowerCase().includes(text);
  });

  const confirmDeactivate = (service: Service) => {
    ask({
      title: "Deactivate service?",
      message: `"${service.name}" will disappear from the customer app. Existing bookings are kept.`,
      confirmLabel: "Deactivate",
      cancelLabel: "Keep active",
      destructive: true,
      onConfirm: () => {
        void deleteService(service.id);
      },
    });
  };

  const submitBranchPrice = async (salonId: number) => {
    if (!pricingId) return;
    const price = (priceDraft[salonId] ?? "").trim();
    if (!price) {
      notify("Enter a price for this branch.", "error");
      return;
    }
    await saveBranchPrice(pricingId, salonId, price, availableDraft[salonId] ?? true);
  };

  return (
    <View style={{ paddingTop: 24 }}>
      <Eyebrow>Services, packages & branch pricing</Eyebrow>
      <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
        Services
      </Display>
      <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
        Create services, upload imagery, control availability and set branch-specific prices. Customers see these values live.
      </Body>

      <Card style={{ marginTop: 18 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <Display size={22}>{editingService ? `Edit: ${editingService.name}` : "Add a service"}</Display>
            {editingService ? <Button title="New service" small kind="ghost" onPress={clearServiceEdit} icon="add-outline" /> : null}
          </View>

          <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Service name" value={serviceForm.name} onChangeText={(value) => setServiceForm("name", value)} placeholder="e.g. Signature haircut" required />
              <Field
                label="Description"
                value={serviceForm.description}
                onChangeText={(value) => setServiceForm("description", value)}
                placeholder="What the service includes"
                multiline
                required
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="Duration (min)" value={serviceForm.duration_minutes} onChangeText={(value) => setServiceForm("duration_minutes", value)} placeholder="45" keyboardType="numeric" style={{ flex: 1 }} />
                <Field label="Price (₹)" value={serviceForm.price} onChangeText={(value) => setServiceForm("price", value)} placeholder="699" keyboardType="numeric" style={{ flex: 1 }} />
              </View>
              <MediaPicker
                label="Service image"
                value={serviceForm.image_url}
                onChange={(value) => setServiceForm("image_url", value)}
                category="service"
                height={120}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
              Category
            </Body>
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={serviceForm.category_id === category.id}
                onPress={() => setServiceForm("category_id", String(category.id))}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
              Audience
            </Body>
            {["Everyone", "Women", "Men"].map((audience) => (
              <Chip key={audience} label={audience} selected={serviceForm.audience === audience} onPress={() => setServiceForm("audience", audience)} />
            ))}
            <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginLeft: 12, marginRight: 4 }}>
              Status
            </Body>
            <Chip label="Active" selected={serviceForm.is_active} onPress={() => setServiceForm("is_active", true)} />
            <Chip label="Inactive" selected={!serviceForm.is_active} onPress={() => setServiceForm("is_active", false)} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              title={editingService ? "Save changes" : "Create service"}
              small
              onPress={() => void saveService()}
              loading={busy}
              icon={editingService ? "save-outline" : "add-outline"}
            />
            {editingService ? <Button title="Cancel edit" small kind="ghost" onPress={clearServiceEdit} /> : null}
            <Button title="Refresh" small kind="outline" onPress={() => void loadAdminServices()} icon="refresh-outline" />
          </View>
        </View>
      </Card>

      <View style={{ marginTop: 18, flexDirection: bp.isDesktop ? "row" : "column", gap: 12, alignItems: bp.isDesktop ? "center" : "stretch" }}>
        <Field label="Search services" value={query} onChangeText={setQuery} placeholder="Name, category or audience" icon="search-outline" style={{ flex: 1, marginBottom: 0 }} />
        <Body size={11} color={t.muted}>{filtered.length} of {adminServices.length} services</Body>
      </View>

      <View style={{ marginTop: 14 }}>
        {servicesLoading && adminServices.length === 0 ? (
          <LoadingBlock label="Loading services…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon="pricetag-outline" title="No services" message="Create your first service above." />
        ) : (
          <View style={{ gap: 12 }}>
            {filtered.map((service) => {
              const image = service.image_url ? buildImageUrl(service.image_url) : "";
              return (
                <Card key={service.id} padded={false}>
                  <View style={{ padding: 16, gap: 12, flexDirection: bp.isMobile ? "column" : "row" }}>
                    <View style={{ width: bp.isMobile ? "100%" : 140 }}>
                      {image ? (
                        <Img uri={image} height={bp.isMobile ? 130 : 100} label={service.name} />
                      ) : (
                        <View style={{ height: bp.isMobile ? 130 : 100, borderRadius: 20, backgroundColor: t.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                          <Body size={10} color={t.muted}>No image</Body>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Body size={13} weight="700" color={t.ink}>{service.name}</Body>
                        <Badge label={service.is_active ? "active" : "inactive"} tone={service.is_active ? "success" : "muted"} />
                        <Badge label={service.audience} tone="primary" />
                      </View>
                      <Body size={11} color={t.muted} style={{ marginTop: 4 }} numberOfLines={2}>
                        {service.description}
                      </Body>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                        <Body size={11} color={t.muted}>{service.category}</Body>
                        <Body size={11} color={t.muted}>{service.duration_minutes} min</Body>
                        <Body size={11} weight="700" color={t.primary}>{money(service.price)}</Body>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        <Button title="Edit" small kind="outline" onPress={() => editService(service)} icon="create-outline" />
                        <Button
                          title={pricingId === service.id ? "Hide branch pricing" : "Branch pricing"}
                          small
                          kind="outline"
                          onPress={() => setPricingId(pricingId === service.id ? null : service.id)}
                          icon="storefront-outline"
                        />
                        {service.is_active ? (
                          <Button title="Deactivate" small kind="danger" onPress={() => confirmDeactivate(service)} icon="trash-outline" />
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {pricingId === service.id ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: t.border, padding: 16 }}>
                      <Eyebrow>Branch price & availability</Eyebrow>
                      <Body size={11} color={t.muted} style={{ marginTop: 4, marginBottom: 12 }}>
                        Leave the base price to inherit the catalogue price. Unavailable branches cannot be booked.
                      </Body>
                      {adminSalons.length === 0 ? (
                        <Body size={11} color={t.muted}>Create a branch first.</Body>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {adminSalons.map((salon) => {
                            const row = (branchPrices[service.id] ?? []).find((item) => item.salon_id === salon.id);
                            return (
                              <View
                                key={salon.id}
                                style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 10, alignItems: bp.isMobile ? "stretch" : "flex-end", borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 12 }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Body size={12} weight="700" color={t.ink}>{salon.name}</Body>
                                  <Body size={10} color={t.muted}>{salon.city}{row ? ` · override ${money(row.price)}` : " · uses base price"}</Body>
                                </View>
                                <Field
                                  label="Branch price"
                                  value={priceDraft[salon.id] ?? ""}
                                  onChangeText={(value) => setPriceDraft((current) => ({ ...current, [salon.id]: value }))}
                                  placeholder={String(service.price)}
                                  keyboardType="numeric"
                                  style={{ width: bp.isMobile ? undefined : 150, marginBottom: 0 }}
                                />
                                <View style={{ flexDirection: "row", gap: 6 }}>
                                  <Chip label="Available" selected={availableDraft[salon.id] ?? true} onPress={() => setAvailableDraft((current) => ({ ...current, [salon.id]: true }))} />
                                  <Chip label="Unavailable" selected={!(availableDraft[salon.id] ?? true)} onPress={() => setAvailableDraft((current) => ({ ...current, [salon.id]: false }))} />
                                </View>
                                <Button title="Save" small onPress={() => void submitBranchPrice(salon.id)} icon="checkmark-outline" />
                                {row ? (
                                  <Button title="Clear" small kind="ghost" onPress={() => void removeBranchPrice(service.id, salon.id)} />
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
