import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, View } from "react-native";
import { formatDate, timeLabel, isUpcoming, type Booking } from "../api";
import { BookingCard } from "../components";
import { useNaturals } from "../context";
import { authImage } from "../images";
import { PageShell } from "../layout";
import { fonts, radius } from "../theme";
import { Badge, Body, Button, Card, DemoNote, Display, EmptyState, Eyebrow, Img } from "../ui";

type BookingTab = "upcoming" | "past" | "cancelled";

/** Springing success reveal for a freshly confirmed appointment. */
function SuccessCard({ booking, onDismiss }: { booking: Booking; onDismiss: () => void }) {
  const { t } = useNaturals();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, { toValue: 1, friction: 7, tension: 110, useNativeDriver: Platform.OS !== "web" }).start();
  }, [progress]);

  const checkScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <Animated.View
      style={{
        marginTop: 24,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: t.success,
        backgroundColor: t.successSoft,
        padding: 20,
        opacity: progress as never,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) as never }],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
        <Animated.View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: t.surface,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: checkScale as never }],
          }}
        >
          <Ionicons name="checkmark" size={20} color={t.success} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Body size={13} weight="700" color={t.ink}>
            Appointment confirmed
          </Body>
          <Body size={11.5} color={t.inkSoft} style={{ marginTop: 3 }}>
            {booking.reference} · {booking.service.name} · {formatDate(booking.date)} at{" "}
            {timeLabel(booking.start_time)} · {booking.salon.name}
          </Body>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss confirmation" onPress={onDismiss} style={{ minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }}>
          <Ionicons name="close" size={17} color={t.inkSoft} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function BookingsScreen() {
  const app = useNaturals();
  const { t, bp, user, bookings, lastConfirmed, clearLastConfirmed, go, openAuth, startBooking } = app;
  const [active, setActive] = useState<BookingTab>("upcoming");

  const groups = useMemo(() => {
    const upcoming = bookings
      .filter((booking) => booking.status === "confirmed" && isUpcoming(booking))
      .sort((a, b) => `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`));
    const past = bookings
      .filter((booking) => booking.status === "completed" || (booking.status === "confirmed" && !isUpcoming(booking)))
      .sort((a, b) => `${b.date}T${b.start_time}`.localeCompare(`${a.date}T${a.start_time}`));
    const cancelled = bookings
      .filter((booking) => booking.status === "cancelled")
      .sort((a, b) => `${b.date}T${b.start_time}`.localeCompare(`${a.date}T${a.start_time}`));
    return { upcoming, past, cancelled };
  }, [bookings]);

  const list = groups[active];
  const counts: Record<BookingTab, number> = {
    upcoming: groups.upcoming.length,
    past: groups.past.length,
    cancelled: groups.cancelled.length,
  };

  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? 24 : 44 }}>
        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", justifyContent: "space-between", alignItems: bp.isDesktop ? "flex-end" : "flex-start", gap: 18 }}>
          <View style={{ maxWidth: 620 }}>
            <Eyebrow>Your diary</Eyebrow>
            <Display size={bp.isMobile ? 38 : 52} style={{ marginTop: 10 }}>
              Appointments & rituals.
            </Display>
            <Body size={13.5} color={t.muted} style={{ marginTop: 12, maxWidth: 540 }}>
              Everything you have booked, in one calm place. Cancel or reschedule a future appointment and the salon database
              updates immediately.
            </Body>
          </View>
          {user ? (
            <Button title="Book a visit" onPress={() => startBooking()} icon="arrow-forward" />
          ) : null}
        </View>

        {!user ? (
          <Card padded={false} style={{ overflow: "hidden", marginTop: 26 }}>
            <View style={{ flexDirection: bp.isMobile ? "column" : "row" }}>
              <View style={{ flex: 1, padding: bp.isMobile ? 24 : 34, justifyContent: "center" }}>
                <Badge label="account required" tone="primary" icon="person-outline" />
                <Display size={bp.isMobile ? 30 : 38} style={{ marginTop: 12 }}>
                  Your next visit, kept in order.
                </Display>
                <Body size={13} color={t.muted} style={{ marginTop: 10, maxWidth: 430 }}>
                  Sign in to see upcoming appointments, review past visits, and cancel or reschedule future bookings. Browsing
                  stays open without an account.
                </Body>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                  <Button title="Sign in" onPress={() => openAuth("login")} />
                  <Button title="Create an account" kind="outline" onPress={() => openAuth("register")} />
                </View>
              </View>
              <Img
                uri={authImage[app.section]}
                height={bp.isMobile ? 210 : 340}
                label="Naturals salon"
                radius={0}
                overlay="rgba(14, 8, 18, 0.16)"
                style={{ width: bp.isMobile ? "100%" : "42%" }}
              />
            </View>
          </Card>
        ) : (
          <>
            {lastConfirmed ? (
              <SuccessCard booking={lastConfirmed} onDismiss={clearLastConfirmed} />
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
              <SummaryPill icon="calendar-outline" value={counts.upcoming} label="upcoming" />
              <SummaryPill icon="checkmark-done-outline" value={counts.past} label="past visits" />
              <SummaryPill icon="close-circle-outline" value={counts.cancelled} label="cancelled" />
              <SummaryPill icon="layers-outline" value={bookings.length} label="total appointments" />
            </View>

            <View style={{ flexDirection: "row", gap: 7, marginTop: 26, marginBottom: 18, flexWrap: "wrap" }}>
              {(["upcoming", "past", "cancelled"] as BookingTab[]).map((tab) => {
                const selected = active === tab;
                return (
                  <Pressable
                    key={tab}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setActive(tab)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      minHeight: 44,
                      paddingHorizontal: 16,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: selected ? t.primary : t.border,
                      backgroundColor: selected ? t.primary : t.surface,
                    }}
                  >
                    <Body size={11.5} weight="700" color={selected ? t.primaryText : t.inkSoft} style={{ textTransform: "capitalize" }}>
                      {tab}
                    </Body>
                    <View
                      style={{
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        borderRadius: 9,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected ? "rgba(255,255,255,0.22)" : t.surfaceAlt,
                      }}
                    >
                      <TextCount value={counts[tab]} selected={selected} />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {list.length ? (
              list.map((booking) => <BookingCard key={booking.id} booking={booking} />)
            ) : (
              <EmptyState
                icon={active === "upcoming" ? "calendar-outline" : active === "cancelled" ? "close-circle-outline" : "time-outline"}
                title={
                  active === "upcoming" ? "No upcoming appointments" : active === "past" ? "No past visits yet" : "Nothing cancelled"
                }
                message={
                  active === "upcoming"
                    ? "Your diary is clear. Choose a treatment and a real open slot to plan your next visit."
                    : active === "past"
                      ? "Completed and past appointments will live here once you have visited."
                      : "Any cancelled appointments will appear here with their original reference."
                }
                actionLabel={active === "upcoming" ? "Explore services" : undefined}
                onAction={active === "upcoming" ? () => go("Explore") : undefined}
              />
            )}

            <View
              style={{
                marginTop: 28,
                padding: 22,
                borderRadius: radius.xl,
                backgroundColor: t.primarySoft,
                borderWidth: 1,
                borderColor: t.primaryBorder,
                flexDirection: bp.isMobile ? "column" : "row",
                alignItems: bp.isMobile ? "flex-start" : "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <View style={{ flex: 1 }}>
                <Display size={bp.isMobile ? 25 : 30}>Need to change a plan?</Display>
                <Body size={12} color={t.muted} style={{ marginTop: 5, maxWidth: 500 }}>
                  Reschedule up to the moment your appointment starts. Cancellation releases the slot for other guests.
                </Body>
              </View>
              <Button title="Book another visit" small onPress={() => startBooking()} icon="add" />
            </View>
          </>
        )}

        <DemoNote center>
          Appointment history is read from your signed-in account. No loyalty points, ratings or fake visits are shown.
        </DemoNote>
      </View>
    </PageShell>
  );
}

function SummaryPill({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
}) {
  const { t, bp } = useNaturals();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
        flex: bp.isMobile ? 1 : undefined,
        minWidth: bp.isMobile ? "46%" : 150,
      }}
    >
      <Ionicons name={icon} size={15} color={t.primary} />
      <View>
        <Body size={16} weight="700" color={t.ink} style={{ lineHeight: 19 }}>
          {value}
        </Body>
        <Body size={9.5} color={t.muted}>
          {label}
        </Body>
      </View>
    </View>
  );
}

function TextCount({ value, selected }: { value: number; selected: boolean }) {
  const { t } = useNaturals();
  return (
    <Body size={9} weight="700" color={selected ? t.primaryText : t.muted}>
      {value}
    </Body>
  );
}

export function useBookingStats() {
  return useNaturals().bookings as Booking[];
}

const _styles = { fontFamily: fonts.body };
void _styles;
