import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useNaturals } from "../../context";
import { buildImageUrl, money, type Salon } from "../../api";
import { Badge, Body, Button, Card, Chip, Display, EmptyState, Eyebrow, Field, Img, LoadingBlock } from "../../ui";
import { MediaPicker } from "./MediaPicker";

export function Branches() {
  const {
    t,
    bp,
    adminSalons,
    salonsLoading,
    salonForm,
    setSalonForm,
    loadAdminSalons,
    saveSalon,
    editSalon,
    clearSalonEdit,
    deactivateSalon,
    editingSalon,
    branchServiceRows,
    branchServiceRowsLoading,
    loadBranchServiceRows,
    saveBranchServiceRow,
    ask,
    notify,
    busy,
  } = useNaturals();

  const [query, setQuery] = useState("");
  const [manageId, setManageId] = useState<number | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [priceDraft, setPriceDraft] = useState<Record<number, string>>({});
  const [availableDraft, setAvailableDraft] = useState<Record<number, boolean>>({});

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return adminSalons;
    return adminSalons.filter((salon) =>
      `${salon.name} ${salon.city} ${salon.address} ${salon.phone}`.toLowerCase().includes(text),
    );
  }, [adminSalons, query]);

  const manageSalon = adminSalons.find((salon) => salon.id === manageId) ?? null;

  useEffect(() => {
    if (!manageId) return;
    void loadBranchServiceRows(manageId, serviceQuery.trim() || undefined);
  }, [manageId, serviceQuery, loadBranchServiceRows]);

  useEffect(() => {
    const prices: Record<number, string> = {};
    const availability: Record<number, boolean> = {};
    branchServiceRows.forEach((row) => {
      prices[row.service_id] = row.branch_price != null ? String(row.branch_price) : String(row.base_price);
      availability[row.service_id] = row.is_available;
    });
    setPriceDraft(prices);
    setAvailableDraft(availability);
  }, [branchServiceRows]);

  const confirmDeactivate = (salon: Salon) => {
    ask({
      title: "Deactivate branch?",
      message: `"${salon.name}" will be hidden from the customer app. Existing appointments are kept.`,
      confirmLabel: "Deactivate",
      cancelLabel: "Keep active",
      destructive: true,
      onConfirm: () => {
        void deactivateSalon(salon.id);
      },
    });
  };

  const saveRow = async (serviceId: number) => {
    if (!manageId) return;
    const price = (priceDraft[serviceId] ?? "").trim();
    if (!price) {
      notify("Enter a branch price.", "error");
      return;
    }
    await saveBranchServiceRow(manageId, serviceId, {
      price,
      is_available: availableDraft[serviceId] ?? true,
    });
  };

  return (
    <View style={{ paddingTop: 24 }}>
      <Eyebrow>Locations, contact details & branch availability</Eyebrow>
      <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
        Branches
      </Display>
      <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
        Manage every Naturals location and decide which services each branch offers — including branch-specific prices.
      </Body>

      <Card style={{ marginTop: 18 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <Display size={22}>{editingSalon ? `Edit: ${editingSalon.name}` : "Add a branch"}</Display>
            {editingSalon ? <Button title="New branch" small kind="ghost" onPress={clearSalonEdit} icon="add-outline" /> : null}
          </View>

          <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Branch name" value={salonForm.name} onChangeText={(value) => setSalonForm("name", value)} placeholder="Naturals Studio — Adyar" required />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="City" value={salonForm.city} onChangeText={(value) => setSalonForm("city", value)} placeholder="Chennai" style={{ flex: 1 }} required />
                <Field label="Phone" value={salonForm.phone} onChangeText={(value) => setSalonForm("phone", value)} placeholder="+91 …" style={{ flex: 1 }} required />
              </View>
              <Field label="Address" value={salonForm.address} onChangeText={(value) => setSalonForm("address", value)} placeholder="Street, area, landmark" multiline required />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Field label="Opens at" value={salonForm.opens_at} onChangeText={(value) => setSalonForm("opens_at", value)} placeholder="10:00" style={{ flex: 1 }} />
                <Field label="Closes at" value={salonForm.closes_at} onChangeText={(value) => setSalonForm("closes_at", value)} placeholder="21:00" style={{ flex: 1 }} />
              </View>
              <MediaPicker
                label="Branch image"
                value={salonForm.image_url}
                onChange={(value) => setSalonForm("image_url", value)}
                category="salon"
                height={120}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
              Status
            </Body>
            <Chip label="Active" selected={salonForm.is_active} onPress={() => setSalonForm("is_active", true)} />
            <Chip label="Inactive" selected={!salonForm.is_active} onPress={() => setSalonForm("is_active", false)} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              title={editingSalon ? "Save changes" : "Create branch"}
              small
              onPress={() => void saveSalon()}
              loading={busy}
              icon={editingSalon ? "save-outline" : "add-outline"}
            />
            {editingSalon ? <Button title="Cancel edit" small kind="ghost" onPress={clearSalonEdit} /> : null}
            <Button title="Refresh" small kind="outline" onPress={() => void loadAdminSalons()} icon="refresh-outline" />
          </View>
        </View>
      </Card>

      <View style={{ marginTop: 18, flexDirection: bp.isDesktop ? "row" : "column", gap: 12, alignItems: bp.isDesktop ? "center" : "stretch" }}>
        <Field label="Search branches" value={query} onChangeText={setQuery} placeholder="Name, city, address or phone" icon="search-outline" style={{ flex: 1, marginBottom: 0 }} />
        <Body size={11} color={t.muted}>{filtered.length} of {adminSalons.length} branches</Body>
      </View>

      <View style={{ marginTop: 14 }}>
        {salonsLoading && adminSalons.length === 0 ? (
          <LoadingBlock label="Loading branches…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon="storefront-outline" title="No branches" message="Create your first branch above." />
        ) : (
          <View style={{ gap: 12 }}>
            {filtered.map((salon) => {
              const image = salon.image_url ? buildImageUrl(salon.image_url) : "";
              return (
                <Card key={salon.id} padded={false}>
                  <View style={{ padding: 16, gap: 12, flexDirection: bp.isMobile ? "column" : "row" }}>
                    <View style={{ width: bp.isMobile ? "100%" : 170 }}>
                      {image ? (
                        <Img uri={image} height={bp.isMobile ? 140 : 110} label={salon.name} />
                      ) : (
                        <View style={{ height: bp.isMobile ? 140 : 110, borderRadius: 20, backgroundColor: t.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                          <Body size={10} color={t.muted}>No image</Body>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Body size={13} weight="700" color={t.ink}>{salon.name}</Body>
                        <Badge label={salon.is_active ? "active" : "inactive"} tone={salon.is_active ? "success" : "muted"} />
                      </View>
                      <Body size={11} color={t.muted} style={{ marginTop: 4 }}>{salon.address}</Body>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                        <Body size={11} color={t.muted}>{salon.city}</Body>
                        <Body size={11} color={t.muted}>{salon.phone}</Body>
                        <Body size={11} color={t.muted}>{salon.opens_at} – {salon.closes_at}</Body>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        <Button title="Edit" small kind="outline" onPress={() => editSalon(salon)} icon="create-outline" />
                        <Button
                          title={manageId === salon.id ? "Hide services" : "Manage services"}
                          small
                          kind="outline"
                          onPress={() => setManageId(manageId === salon.id ? null : salon.id)}
                          icon="list-outline"
                        />
                        {salon.is_active ? (
                          <Button title="Deactivate" small kind="danger" onPress={() => confirmDeactivate(salon)} icon="trash-outline" />
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {manageId === salon.id ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: t.border, padding: 16 }}>
                      <Eyebrow>Services at {salon.city}</Eyebrow>
                      <Body size={11} color={t.muted} style={{ marginTop: 4, marginBottom: 12 }}>
                        Toggle availability and override the price for this branch only.
                      </Body>
                      <Field
                        label="Search services"
                        value={serviceQuery}
                        onChangeText={setServiceQuery}
                        placeholder="Filter by name"
                        icon="search-outline"
                        style={{ marginBottom: 12 }}
                      />
                      {branchServiceRowsLoading && branchServiceRows.length === 0 ? (
                        <LoadingBlock label="Loading branch services…" />
                      ) : branchServiceRows.length === 0 ? (
                        <Body size={11} color={t.muted}>No services match this search.</Body>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {branchServiceRows.map((row) => (
                            <View
                              key={row.service_id}
                              style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 10, alignItems: bp.isMobile ? "stretch" : "flex-end", borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 12 }}
                            >
                              <View style={{ flex: 1 }}>
                                <Body size={12} weight="700" color={t.ink}>{row.name}</Body>
                                <Body size={10} color={t.muted}>
                                  {row.category} · base {money(row.base_price)}
                                  {row.has_override ? ` · override ${money(row.branch_price ?? row.base_price)}` : " · no override"}
                                  {row.is_active ? "" : " · catalogue inactive"}
                                </Body>
                              </View>
                              <Field
                                label="Price"
                                value={priceDraft[row.service_id] ?? ""}
                                onChangeText={(value) => setPriceDraft((current) => ({ ...current, [row.service_id]: value }))}
                                placeholder={String(row.base_price)}
                                keyboardType="numeric"
                                style={{ width: bp.isMobile ? undefined : 140, marginBottom: 0 }}
                              />
                              <View style={{ flexDirection: "row", gap: 6 }}>
                                <Chip label="Available" selected={availableDraft[row.service_id] ?? row.is_available} onPress={() => setAvailableDraft((current) => ({ ...current, [row.service_id]: true }))} />
                                <Chip label="Unavailable" selected={!(availableDraft[row.service_id] ?? row.is_available)} onPress={() => setAvailableDraft((current) => ({ ...current, [row.service_id]: false }))} />
                              </View>
                              <Button title="Save" small onPress={() => void saveRow(row.service_id)} icon="checkmark-outline" />
                            </View>
                          ))}
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
