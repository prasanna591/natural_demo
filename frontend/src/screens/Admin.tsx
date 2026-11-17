import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, View } from "react-native";
import { useNaturals } from "../context";
import { PageShell } from "../layout";
import { radius } from "../theme";
import { Badge, Body, Button, Display } from "../ui";
import { Overview } from "./admin/Overview";
import { Appointments } from "./admin/Appointments";
import { Services } from "./admin/Services";
import { Branches } from "./admin/Branches";
import { Campaigns } from "./admin/Campaigns";
import { MediaScreen } from "./admin/Media";
import { ContentScreen } from "./admin/Content";
import { AuditScreen } from "./admin/Audit";
import { ReviewsScreen } from "./admin/Reviews";
import { DeveloperScreen } from "./admin/Developer";

const SECTIONS: {
  key:
    | "overview"
    | "appointments"
    | "services"
    | "branches"
    | "campaigns"
    | "media"
    | "content"
    | "audit"
    | "reviews"
    | "developer";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "overview", label: "Overview", icon: "globe-outline" },
  { key: "appointments", label: "Appointments", icon: "calendar-outline" },
  { key: "services", label: "Services", icon: "pricetag-outline" },
  { key: "branches", label: "Branches", icon: "storefront-outline" },
  { key: "campaigns", label: "Campaigns", icon: "megaphone-outline" },
  { key: "media", label: "Media", icon: "image-outline" },
  { key: "content", label: "Content", icon: "document-text-outline" },
  { key: "audit", label: "Audit Log", icon: "document-outline" },
  { key: "reviews", label: "Reviews", icon: "chatbubbles-outline" },
  { key: "developer", label: "Developer", icon: "construct-outline" },
];

export function AdminScreen() {
  const { t, bp, user, adminSection, setAdminSection, analytics, analyticsLoading, loadAnalytics, loadAdminBookings } =
    useNaturals();

  const isDeveloper = user?.role === "developer";

  return (
    <PageShell>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bp.isMobile ? 16 : 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: bp.isMobile ? 20 : 40 }}>
          <View style={{ flexDirection: bp.isDesktop ? "row" : "column", justifyContent: "space-between", alignItems: bp.isDesktop ? "flex-end" : "flex-start", gap: 12 }}>
            <View style={{ maxWidth: 620 }}>
              <Body size={11} weight="700" color={t.primary} style={{ textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 6 }}>
                Naturals Control Panel
              </Body>
              <Display size={bp.isMobile ? 34 : 48} style={{ marginTop: 2 }}>
                {isDeveloper ? "Developer Dashboard" : "Admin Dashboard"}
              </Display>
              <Body size={12.5} color={t.muted} style={{ marginTop: 6, maxWidth: 560 }}>
                Manage bookings, services, branches, campaigns and content. All actions are enforced server-side.
              </Body>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Badge label={isDeveloper ? "developer" : "administrator"} tone="primary" icon="shield-checkmark-outline" />
              <Button
                title="Refresh"
                small
                kind="outline"
                onPress={() => {
                  void loadAnalytics();
                  void loadAdminBookings();
                }}
                icon="refresh-outline"
              />
            </View>
          </View>

          <View style={{ marginTop: 24, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SECTIONS.map((section) => {
              const active = adminSection === section.key;
              if (section.key === "developer" && !isDeveloper) return null;
              return (
                <Pressable
                  key={section.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={section.label}
                  onPress={() => setAdminSection(section.key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    minHeight: 40,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: active ? t.primary : t.border,
                    backgroundColor: active ? t.primarySoft : t.surface,
                  }}
                >
                  <Ionicons name={section.icon} size={14} color={active ? t.primary : t.muted} />
                  <Body size={11.5} weight={active ? "700" : "500"} color={active ? t.primary : t.inkSoft}>
                    {section.label}
                  </Body>
                </Pressable>
              );
            })}
          </View>

          {adminSection === "overview" && (
            <Overview analytics={analytics} analyticsLoading={analyticsLoading} loadAnalytics={loadAnalytics} />
          )}
          {adminSection === "appointments" && <Appointments />}
          {adminSection === "services" && <Services />}
          {adminSection === "branches" && <Branches />}
          {adminSection === "campaigns" && <Campaigns />}
          {adminSection === "media" && <MediaScreen />}
          {adminSection === "content" && <ContentScreen />}
          {adminSection === "audit" && <AuditScreen />}
          {adminSection === "reviews" && <ReviewsScreen />}
          {adminSection === "developer" && <DeveloperScreen />}
        </View>
      </ScrollView>
    </PageShell>
  );
}
