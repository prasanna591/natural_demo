import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { buildImageUrl, formatDate, todayString, type Campaign } from "../../api";
import { useNaturals } from "../../context";
import { radius } from "../../theme";
import {
  Badge,
  Body,
  Button,
  Card,
  Chip,
  Display,
  EmptyState,
  Eyebrow,
  Field,
  IconButton,
  Img,
  LoadingBlock,
} from "../../ui";
import { MediaPicker } from "./MediaPicker";

type CampaignStatus = "Active" | "Scheduled" | "Expired" | "Inactive";
type StatusFilter = "All" | CampaignStatus;

const STATUS_FILTERS: StatusFilter[] = ["All", "Active", "Scheduled", "Expired", "Inactive"];

const STATUS_TONE: Record<CampaignStatus, "success" | "primary" | "danger" | "muted"> = {
  Active: "success",
  Scheduled: "primary",
  Expired: "danger",
  Inactive: "muted",
};

const STATUS_ICON: Record<CampaignStatus, keyof typeof Ionicons.glyphMap> = {
  Active: "checkmark-circle-outline",
  Scheduled: "time-outline",
  Expired: "alert-circle-outline",
  Inactive: "pause-circle-outline",
};

/** A campaign is scheduled/expired automatically from its date window. */
function campaignStatus(campaign: Campaign, today = todayString()): CampaignStatus {
  if (!campaign.is_active) return "Inactive";
  if (campaign.start_date && campaign.start_date > today) return "Scheduled";
  if (campaign.end_date && campaign.end_date < today) return "Expired";
  return "Active";
}

function dateLabel(value: string | null, fallback: string) {
  if (!value) return fallback;
  try {
    return formatDate(value, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

function isValidDateInput(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
}

export function Campaigns() {
  const {
    t,
    bp,
    campaigns,
    campaignsLoading,
    campaignForm,
    setCampaignForm,
    loadCampaigns,
    saveCampaign,
    editCampaign,
    clearCampaignEdit,
    removeCampaign,
    setCampaignActive,
    editingCampaign,
    ask,
    busy,
  } = useNaturals();

  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [preview, setPreview] = useState<Campaign | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { All: campaigns.length, Active: 0, Scheduled: 0, Expired: 0, Inactive: 0 };
    campaigns.forEach((campaign) => {
      counts[campaignStatus(campaign)] += 1;
    });
    return counts;
  }, [campaigns]);

  const visibleCampaigns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (statusFilter !== "All" && campaignStatus(campaign) !== statusFilter) return false;
      if (!term) return true;
      return [campaign.title, campaign.subtitle, campaign.description, campaign.cta_label, campaign.audience]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [campaigns, search, statusFilter]);

  const openCreate = () => {
    clearCampaignEdit();
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (campaign: Campaign) => {
    editCampaign(campaign);
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (busy) return;
    setFormOpen(false);
    setFormError("");
    clearCampaignEdit();
  };

  const validateForm = () => {
    if (campaignForm.title.trim().length < 2) return "Add a campaign title (at least 2 characters).";
    if (campaignForm.description.trim().length < 2) return "Add a short promotional description.";
    if (!isValidDateInput(campaignForm.start_date)) return "Start date must use the YYYY-MM-DD format.";
    if (!isValidDateInput(campaignForm.end_date)) return "End date must use the YYYY-MM-DD format.";
    if (campaignForm.start_date && campaignForm.end_date && campaignForm.end_date < campaignForm.start_date) {
      return "The end date must be on or after the start date.";
    }
    return "";
  };

  const submitForm = async () => {
    const message = validateForm();
    if (message) {
      setFormError(message);
      return;
    }
    setFormError("");
    const saved = await saveCampaign();
    if (saved) {
      setFormOpen(false);
      setFormError("");
    }
  };

  const confirmDelete = (campaign: Campaign) => {
    ask({
      title: "Delete campaign?",
      message: `"${campaign.title}" will be removed from the customer app immediately. This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: () => {
        void removeCampaign(campaign.id);
      },
    });
  };

  const toggleActive = (campaign: Campaign) => {
    const next = !campaign.is_active;
    ask({
      title: next ? "Activate campaign?" : "Deactivate campaign?",
      message: next
        ? `"${campaign.title}" will be visible to customers while its dates are current.`
        : `"${campaign.title}" will be hidden from customers immediately.`,
      confirmLabel: next ? "Activate" : "Deactivate",
      cancelLabel: "Cancel",
      onConfirm: () => {
        void setCampaignActive(campaign, next);
      },
    });
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
  };

  return (
    <View style={{ paddingTop: 24 }}>
      <View
        style={{
          flexDirection: bp.isDesktop ? "row" : "column",
          alignItems: bp.isDesktop ? "flex-end" : "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <View style={{ maxWidth: 640 }}>
          <Eyebrow>Offers, banners & seasonal stories</Eyebrow>
          <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 4 }}>
            Campaigns
          </Display>
          <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
            Create promotions, upload banner imagery and control exactly which campaigns customers see. Status is derived from
            the active switch and the scheduled dates.
          </Body>
        </View>
        <Button title="Create New Campaign" onPress={openCreate} icon="add" full={bp.isMobile} />
      </View>

      <Card style={{ marginTop: 18 }}>
        <View style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 10, alignItems: bp.isMobile ? "stretch" : "flex-end" }}>
            <Field
              label="Search campaigns"
              value={search}
              onChangeText={setSearch}
              placeholder="Title, description, CTA or audience"
              icon="search-outline"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <Button
              title="Refresh"
              small
              kind="outline"
              onPress={() => void loadCampaigns()}
              icon="refresh-outline"
              loading={campaignsLoading}
            />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {STATUS_FILTERS.map((status) => (
              <Chip
                key={status}
                label={`${status} · ${statusCounts[status]}`}
                selected={statusFilter === status}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </View>
        </View>
      </Card>

      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <Display size={22}>{statusFilter === "All" ? "All campaigns" : `${statusFilter} campaigns`}</Display>
          <Body size={11} color={t.muted}>
            {visibleCampaigns.length} of {campaigns.length}
          </Body>
        </View>

        {campaignsLoading && campaigns.length === 0 ? (
          <LoadingBlock label="Loading campaigns…" />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title="No campaigns yet"
            message="Create your first campaign to feature a promotion on the customer home screen."
            actionLabel="Create campaign"
            onAction={openCreate}
          />
        ) : visibleCampaigns.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No matching campaigns"
            message="Try a different search term or status filter."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        ) : (
          <View style={{ gap: 14 }}>
            {visibleCampaigns.map((campaign) => {
              const image = campaign.image_url ? buildImageUrl(campaign.image_url) : "";
              const status = campaignStatus(campaign);
              return (
                <Card key={campaign.id} padded={false}>
                  <View style={{ flexDirection: bp.isMobile ? "column" : "row" }}>
                    <View style={{ width: bp.isMobile ? "100%" : 250 }}>
                      {image ? (
                        <Img
                          uri={image}
                          height={bp.isMobile ? 180 : 230}
                          label={`${campaign.title} banner`}
                          radius={0}
                          overlay="rgba(12, 8, 16, 0.1)"
                        />
                      ) : (
                        <View
                          style={{
                            height: bp.isMobile ? 180 : 230,
                            backgroundColor: t.surfaceAlt,
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                          }}
                        >
                          <Ionicons name="image-outline" size={30} color={t.primary} />
                          <Body size={10.5} color={t.muted}>
                            No banner image
                          </Body>
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1, padding: 18, gap: 9 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Body size={14} weight="700" color={t.ink}>
                          {campaign.title}
                        </Body>
                        <Badge label={status} tone={STATUS_TONE[status]} icon={STATUS_ICON[status]} />
                        <Badge label={campaign.audience === "Everyone" ? "all guests" : campaign.audience} tone="primary" />
                      </View>

                      {campaign.subtitle ? (
                        <Body size={11.5} weight="600" color={t.inkSoft}>
                          {campaign.subtitle}
                        </Body>
                      ) : null}
                      <Body size={12} color={t.muted} numberOfLines={3}>
                        {campaign.description}
                      </Body>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                        <MetaPill icon="play-outline" label={`Start ${dateLabel(campaign.start_date, "any time")}`} />
                        <MetaPill icon="flag-outline" label={`End ${dateLabel(campaign.end_date, "no limit")}`} />
                        <MetaPill icon="megaphone-outline" label={campaign.cta_label || "Explore"} />
                      </View>

                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <Button title="Preview" small kind="outline" onPress={() => setPreview(campaign)} icon="eye-outline" />
                        <Button title="Edit" small kind="outline" onPress={() => openEdit(campaign)} icon="create-outline" />
                        <Button
                          title={campaign.is_active ? "Deactivate" : "Activate"}
                          small
                          kind="ghost"
                          onPress={() => toggleActive(campaign)}
                          icon={campaign.is_active ? "pause-circle-outline" : "play-circle-outline"}
                        />
                        <Button title="Remove" small kind="danger" onPress={() => confirmDelete(campaign)} icon="trash-outline" />
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </View>

      {/* Create / edit form */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={closeForm} statusBarTranslucent>
        <View
          style={{
            flex: 1,
            backgroundColor: t.scrim,
            justifyContent: "center",
            alignItems: "center",
            padding: bp.isMobile ? 10 : 24,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Close campaign form" onPress={closeForm} style={StyleSheet.absoluteFill} />
          <View
            style={{
              width: bp.isMobile ? "100%" : 860,
              maxHeight: "92%",
              backgroundColor: t.surface,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: t.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: t.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Eyebrow>{editingCampaign ? "Update promotion" : "New promotion"}</Eyebrow>
                <Display size={bp.isMobile ? 24 : 30} style={{ marginTop: 2 }}>
                  {editingCampaign ? `Edit: ${editingCampaign.title}` : "Create new campaign"}
                </Display>
              </View>
              <IconButton name="close" label="Close campaign form" onPress={closeForm} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
              <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 18 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Campaign title"
                    value={campaignForm.title}
                    onChangeText={(value) => setCampaignForm("title", value)}
                    placeholder="Monsoon glow edit"
                    required
                  />
                  <Field
                    label="Supporting line (optional)"
                    value={campaignForm.subtitle}
                    onChangeText={(value) => setCampaignForm("subtitle", value)}
                    placeholder="A short line shown above the title"
                  />
                  <Field
                    label="Short promotional description"
                    value={campaignForm.description}
                    onChangeText={(value) => setCampaignForm("description", value)}
                    placeholder="What the promotion includes and why guests should care"
                    multiline
                    required
                  />
                  <Field
                    label="Call-to-action button text"
                    value={campaignForm.cta_label}
                    onChangeText={(value) => setCampaignForm("cta_label", value)}
                    placeholder="Book Now or Explore Offers"
                  />
                  <Field
                    label="CTA link (optional)"
                    value={campaignForm.cta_url}
                    onChangeText={(value) => setCampaignForm("cta_url", value)}
                    placeholder="/booking, /explore, /offers, /salons or https://…"
                    autoCapitalize="none"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <MediaPicker
                    label="Campaign banner image"
                    value={campaignForm.image_url}
                    onChange={(value) => setCampaignForm("image_url", value)}
                    category="campaign"
                    height={170}
                  />

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Field
                      label="Start date"
                      value={campaignForm.start_date}
                      onChangeText={(value) => setCampaignForm("start_date", value)}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="End date"
                      value={campaignForm.end_date}
                      onChangeText={(value) => setCampaignForm("end_date", value)}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      style={{ flex: 1 }}
                    />
                  </View>
                  <Body size={10} color={t.muted} style={{ marginTop: -6, marginBottom: 14 }}>
                    Use YYYY-MM-DD. Leave either date blank for an open-ended campaign.
                  </Body>

                  <Field
                    label="Display order"
                    value={String(campaignForm.position)}
                    onChangeText={(value) => setCampaignForm("position", Number(value) || 0)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Body size={10} color={t.muted} style={{ marginTop: -6, marginBottom: 14 }}>
                    Lower numbers appear first in the customer app.
                  </Body>

                  <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    Audience
                  </Body>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    {["Everyone", "Women", "Men"].map((audience) => (
                      <Chip
                        key={audience}
                        label={audience}
                        selected={campaignForm.audience === audience}
                        onPress={() => setCampaignForm("audience", audience)}
                      />
                    ))}
                  </View>

                  <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    Campaign status
                  </Body>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Chip label="Active" selected={campaignForm.is_active} onPress={() => setCampaignForm("is_active", true)} />
                    <Chip label="Inactive" selected={!campaignForm.is_active} onPress={() => setCampaignForm("is_active", false)} />
                  </View>
                  <Body size={10} color={t.muted} style={{ marginTop: 8 }}>
                    Active campaigns are shown only inside their date window. Outside it they are scheduled or expired automatically.
                  </Body>
                </View>
              </View>

              {formError ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: t.dangerSoft,
                    borderWidth: 1,
                    borderColor: t.danger,
                    borderRadius: radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginTop: 8,
                  }}
                >
                  <Ionicons name="alert-circle-outline" size={16} color={t.danger} />
                  <Body size={11.5} color={t.danger} style={{ flex: 1 }}>
                    {formError}
                  </Body>
                </View>
              ) : null}

              <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 10, marginTop: 18 }}>
                <Button
                  title={editingCampaign ? "Save changes" : "Create campaign"}
                  onPress={() => void submitForm()}
                  loading={busy}
                  icon={editingCampaign ? "save-outline" : "megaphone-outline"}
                  full={bp.isMobile}
                />
                <Button title="Cancel" kind="ghost" onPress={closeForm} full={bp.isMobile} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Customer-facing preview */}
      <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)} statusBarTranslucent>
        <View
          style={{
            flex: 1,
            backgroundColor: t.scrim,
            justifyContent: "center",
            alignItems: "center",
            padding: bp.isMobile ? 10 : 24,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Close campaign preview" onPress={() => setPreview(null)} style={StyleSheet.absoluteFill} />
          {preview ? (
            <View
              style={{
                width: bp.isMobile ? "100%" : 680,
                maxHeight: "92%",
                backgroundColor: t.surface,
                borderRadius: 26,
                borderWidth: 1,
                borderColor: t.border,
                overflow: "hidden",
              }}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                {preview.image_url ? (
                  <Img
                    uri={buildImageUrl(preview.image_url)}
                    height={bp.isMobile ? 220 : 280}
                    label={`${preview.title} banner preview`}
                    radius={0}
                    overlay="rgba(12, 8, 16, 0.14)"
                  />
                ) : (
                  <View
                    style={{
                      height: bp.isMobile ? 220 : 280,
                      backgroundColor: t.surfaceAlt,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    <Ionicons name="image-outline" size={38} color={t.primary} />
                    <Body size={11} color={t.muted}>
                      No banner image — the themed fallback will be used
                    </Body>
                  </View>
                )}

                <View style={{ padding: bp.isMobile ? 20 : 28 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <Eyebrow>Customer preview</Eyebrow>
                    <IconButton name="close" label="Close campaign preview" onPress={() => setPreview(null)} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    <Badge label={campaignStatus(preview)} tone={STATUS_TONE[campaignStatus(preview)]} icon={STATUS_ICON[campaignStatus(preview)]} />
                    <Badge label={preview.audience === "Everyone" ? "all guests" : preview.audience} tone="primary" />
                  </View>
                  <Display size={bp.isMobile ? 30 : 38} style={{ marginTop: 12 }}>
                    {preview.title}
                  </Display>
                  {preview.subtitle ? (
                    <Body size={12.5} weight="600" color={t.inkSoft} style={{ marginTop: 6 }}>
                      {preview.subtitle}
                    </Body>
                  ) : null}
                  <Body size={13} color={t.muted} style={{ marginTop: 10 }}>
                    {preview.description}
                  </Body>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    <MetaPill icon="play-outline" label={`Start ${dateLabel(preview.start_date, "any time")}`} />
                    <MetaPill icon="flag-outline" label={`End ${dateLabel(preview.end_date, "no limit")}`} />
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 9,
                      minHeight: 48,
                      paddingHorizontal: 22,
                      borderRadius: radius.pill,
                      backgroundColor: t.primary,
                      alignSelf: "flex-start",
                      marginTop: 20,
                    }}
                  >
                    <Body size={13} weight="700" color={t.primaryText}>
                      {preview.cta_label || "Explore"}
                    </Body>
                    <Ionicons name="arrow-forward" size={16} color={t.primaryText} />
                  </View>

                  <View
                    style={{
                      marginTop: 18,
                      padding: 12,
                      borderRadius: radius.md,
                      backgroundColor: t.surfaceAlt,
                      borderWidth: 1,
                      borderColor: t.border,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <Ionicons name="information-circle-outline" size={16} color={t.primary} />
                    <Body size={10.5} color={t.muted} style={{ flex: 1 }}>
                      Preview only. Customers see this campaign on the home screen while it is active and inside its scheduled dates.
                    </Body>
                  </View>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { t } = useNaturals();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surfaceAlt,
      }}
    >
      <Ionicons name={icon} size={11} color={t.primary} />
      <Body size={10} color={t.muted}>
        {label}
      </Body>
    </View>
  );
}
