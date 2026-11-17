import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { formatDate, initials, isUpcoming, money, timeLabel } from "../api";
import { useNaturals } from "../context";
import { authImage } from "../images";
import { PageShell } from "../layout";
import { radius } from "../theme";
import { Badge, Body, Button, Card, DemoNote, Display, Eyebrow, Field, Img } from "../ui";

export function ProfileScreen() {
  const app = useNaturals();
  const { t, bp, user, bookings, editingName, setEditingName, saveProfile, openAuth, go, ask, logOut, selectedSalon } = app;
  const [saving, setSaving] = useState(false);

  const upcoming = bookings.filter((booking) => booking.status === "confirmed" && isUpcoming(booking));
  const completed = bookings.filter((booking) => booking.status === "completed");
  const cancelled = bookings.filter((booking) => booking.status === "cancelled");
  const next = [...upcoming].sort((a, b) => `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`))[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? 24 : 44 }}>
        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", justifyContent: "space-between", alignItems: bp.isDesktop ? "flex-end" : "flex-start", gap: 16 }}>
          <View style={{ maxWidth: 620 }}>
            <Eyebrow>Your Naturals</Eyebrow>
            <Display size={bp.isMobile ? 38 : 52} style={{ marginTop: 10 }}>
              {user ? `Hello, ${user.name.split(" ")[0]}.` : "A quieter kind of account."}
            </Display>
            <Body size={13.5} color={t.muted} style={{ marginTop: 12, maxWidth: 540 }}>
              {user
                ? "Your details, your next appointment and the shortcuts you use most — all connected to your signed-in account."
                : "Sign in to keep appointments, profile details and booking history together. Browsing stays open without an account."}
            </Body>
          </View>
          {user ? <Badge label={user.role === "developer" ? "developer" : user.role === "admin" ? "administrator" : "Naturals guest"} tone="primary" icon="shield-checkmark-outline" /> : null}
        </View>

        {!user ? (
          <Card padded={false} style={{ overflow: "hidden", marginTop: 26 }}>
            <View style={{ flexDirection: bp.isMobile ? "column" : "row" }}>
              <View style={{ flex: 1, padding: bp.isMobile ? 24 : 38, justifyContent: "center" }}>
                <Badge label="guest account" tone="outline" icon="person-outline" />
                <Display size={bp.isMobile ? 30 : 40} style={{ marginTop: 12 }}>
                  Keep every visit in one place.
                </Display>
                <Body size={13} color={t.muted} style={{ marginTop: 10, maxWidth: 440 }}>
                  Create an account to confirm appointments, update your name and return to your booking history on any device.
                </Body>
                <View style={{ gap: 10, marginTop: 18 }}>
                  {["Server-secured sign in", "Cancel or reschedule future visits", "No payment details collected"].map((item) => (
                    <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                      <Ionicons name="checkmark-circle" size={15} color={t.primary} />
                      <Body size={11.5} color={t.inkSoft}>
                        {item}
                      </Body>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                  <Button title="Sign in" onPress={() => openAuth("login")} />
                  <Button title="Create account" kind="outline" onPress={() => openAuth("register")} />
                </View>
              </View>
              <Img
                uri={authImage[app.section]}
                height={bp.isMobile ? 220 : 380}
                label="Naturals salon interior"
                radius={0}
                overlay="rgba(14, 8, 18, 0.16)"
                style={{ width: bp.isMobile ? "100%" : "42%" }}
              />
            </View>
          </Card>
        ) : (
          <>
            <Card padded={false} style={{ overflow: "hidden", marginTop: 26 }}>
              <View
                style={{
                  backgroundColor: t.primarySoft,
                  paddingHorizontal: bp.isMobile ? 20 : 30,
                  paddingVertical: bp.isMobile ? 22 : 28,
                  borderBottomWidth: 1,
                  borderBottomColor: t.primaryBorder,
                }}
              >
                <View style={{ flexDirection: bp.isMobile ? "column" : "row", alignItems: bp.isMobile ? "flex-start" : "center", gap: 18 }}>
                  <View
                    style={{
                      width: bp.isMobile ? 66 : 78,
                      height: bp.isMobile ? 66 : 78,
                      borderRadius: bp.isMobile ? 33 : 39,
                      backgroundColor: t.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 3,
                      borderColor: t.surface,
                    }}
                  >
                    <Display size={bp.isMobile ? 28 : 34} color={t.primaryText}>
                      {initials(user.name)}
                    </Display>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <Display size={bp.isMobile ? 30 : 36}>{user.name}</Display>
                      <Badge label={user.role === "developer" ? "developer" : user.role === "admin" ? "administrator" : "guest"} tone="primary" />
                    </View>
                    <Body size={12} color={t.muted} style={{ marginTop: 3 }}>
                      {user.email}
                    </Body>
                    <Body size={10.5} color={t.muted} style={{ marginTop: 5 }}>
                      Demo account · profile details are stored in the salon database.
                    </Body>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, alignSelf: bp.isMobile ? "stretch" : "center" }}>
                    <Button title="My bookings" small kind="outline" onPress={() => go("Bookings")} />
                    <Button title="Sign out" small kind="ghost" onPress={() => ask({ title: "Sign out of Naturals?", message: "Your bookings stay safe. You can sign back in at any time.", confirmLabel: "Sign out", destructive: true, onConfirm: () => void logOut() })} />
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", padding: bp.isMobile ? 12 : 16 }}>
                {[
                  { value: upcoming.length, label: "upcoming", icon: "calendar-outline" as const },
                  { value: completed.length, label: "completed", icon: "checkmark-done-outline" as const },
                  { value: cancelled.length, label: "cancelled", icon: "close-circle-outline" as const },
                  { value: bookings.length, label: "total visits", icon: "layers-outline" as const },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={{
                      flex: 1,
                      minWidth: bp.isMobile ? "46%" : 140,
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: t.surfaceAlt,
                      }}
                    >
                      <Ionicons name={stat.icon} size={15} color={t.primary} />
                    </View>
                    <View>
                      <Body size={18} weight="700" color={t.ink} style={{ lineHeight: 21 }}>
                        {stat.value}
                      </Body>
                      <Body size={9.5} color={t.muted}>
                        {stat.label}
                      </Body>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: 16, marginTop: 18, alignItems: "flex-start" }}>
              <Card style={{ flex: 1, width: bp.isDesktop ? undefined : "100%" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <View>
                    <Eyebrow>Account details</Eyebrow>
                    <Display size={26} style={{ marginTop: 5 }}>
                      Your name
                    </Display>
                  </View>
                  <Ionicons name="create-outline" size={19} color={t.primary} />
                </View>
                <Body size={11.5} color={t.muted} style={{ marginTop: 8 }}>
                  This is the name shown on your appointment records. Updates are saved to your signed-in profile.
                </Body>
                <Field
                  label="Full name"
                  value={editingName || user.name}
                  onChangeText={setEditingName}
                  placeholder="Your name"
                  autoCapitalize="words"
                  icon="person-outline"
                  style={{ marginTop: 16, marginBottom: 6 }}
                />
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Button
                    title="Save changes"
                    small
                    onPress={() => void handleSave()}
                    loading={saving}
                    disabled={saving || (editingName || user.name).trim().length < 2 || (editingName || user.name).trim() === user.name}
                  />
                  {editingName && editingName !== user.name ? (
                    <Pressable accessibilityRole="button" onPress={() => setEditingName(user.name)} style={{ minHeight: 36, justifyContent: "center" }}>
                      <Body size={11} weight="600" color={t.muted}>
                        Reset
                      </Body>
                    </Pressable>
                  ) : null}
                </View>
              </Card>

              <Card style={{ flex: 1, width: bp.isDesktop ? undefined : "100%", backgroundColor: t.surfaceAlt }}>
                <Eyebrow>Next appointment</Eyebrow>
                {next ? (
                  <>
                    <Display size={27} style={{ marginTop: 7 }}>
                      {next.service.name}
                    </Display>
                    <Body size={12} color={t.muted} style={{ marginTop: 5 }}>
                      {next.salon.name} · {next.salon.city}
                    </Body>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
                      <MiniMeta icon="calendar-outline" text={formatDate(next.date)} />
                      <MiniMeta icon="time-outline" text={timeLabel(next.start_time)} />
                      <MiniMeta icon="person-outline" text={next.stylist.name} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, gap: 10 }}>
                      <Display size={26}>{money(next.total)}</Display>
                      <Button title="Manage visit" small kind="outline" onPress={() => go("Bookings")} />
                    </View>
                  </>
                ) : (
                  <>
                    <Display size={27} style={{ marginTop: 7 }}>
                      Nothing booked yet.
                    </Display>
                    <Body size={12} color={t.muted} style={{ marginTop: 7 }}>
                      Your next ritual will appear here as soon as you confirm an appointment.
                    </Body>
                    <Button title="Find a treatment" small onPress={() => go("Explore")} style={{ marginTop: 16 }} icon="arrow-forward" />
                  </>
                )}
              </Card>
            </View>

            <View style={{ marginTop: 18 }}>
              <MenuRow icon="calendar-outline" title="My appointments" subtitle="Upcoming, past and cancelled visits" onPress={() => go("Bookings")} />
              <MenuRow icon="sparkles-outline" title="Virtual try-on" subtitle="Preview hairstyles, colours and beauty looks on your photo" onPress={() => go("TryOn")} />
              <MenuRow icon="pricetag-outline" title="Offers" subtitle="Currently active offers from the salon API" onPress={() => go("Offers")} />
              <MenuRow icon="storefront-outline" title="Salons" subtitle="Hours, addresses and branch teams" onPress={() => go("Salons")} />
              <MenuRow icon="information-circle-outline" title="About Naturals" subtitle="Company, membership cards, news and contacts" onPress={() => go("About")} />
              {user.role !== "customer" ? (
                <MenuRow icon="stats-chart-outline" title="Admin dashboard" subtitle="Live metrics, service creation and completion" onPress={() => go("Admin")} />
              ) : null}
              <MenuRow
                icon="shield-checkmark-outline"
                title="Privacy & access"
                subtitle="Owner-scoped bookings, server-enforced admin access"
                onPress={() =>
                  app.ask({
                    title: "Account & privacy",
                    message: "Bookings are visible only to your account and salon administrators. This demo does not collect payment details, loyalty points or reviews.",
                    confirmLabel: "Understood",
                    onConfirm: () => undefined,
                  })
                }
                showChevron
              />
            </View>

            <Card style={{ marginTop: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="help-buoy-outline" size={19} color={t.primary} />
                <Display size={24}>Need a hand?</Display>
              </View>
              <Body size={12} color={t.muted} style={{ marginTop: 7 }}>
                Contact the salon directly using the details on your appointment or the studio page. {selectedSalon ? `${selectedSalon.name} is open ${selectedSalon.opens_at}–${selectedSalon.closes_at}.` : ""}
              </Body>
            </Card>

            <DemoNote center>
              Membership and prepaid card details on the About screen are published reference information only. This demo
              does not manage card balances, loyalty tiers, saved cards or verified ratings — those would need real
              business data and backend support.
            </DemoNote>
          </>
        )}
      </View>
    </PageShell>
  );
}

function MiniMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={13} color={t.primary} />
      <Body size={11.5} color={t.inkSoft}>
        {text}
      </Body>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  showChevron?: boolean;
}) {
  const { t } = useNaturals();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        padding: 15,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: hover ? t.primaryBorder : t.border,
        backgroundColor: hover ? t.primarySoft : t.surface,
        marginBottom: 9,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: t.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={t.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Body size={13} weight="700" color={t.ink}>
          {title}
        </Body>
        <Body size={10.5} color={t.muted}>
          {subtitle}
        </Body>
      </View>
      {showChevron ? <Ionicons name="chevron-forward" size={17} color={t.muted} /> : null}
    </Pressable>
  );
}
