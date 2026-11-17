import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { formatDate, isUpcoming, money, servicePriceLabel, timeLabel, type Booking, type Offer, type Salon, type Service, type Stylist } from "./api";
import { useNaturals } from "./context";
import { categoryImageFor, salonImageFor, serviceImage } from "./images";
import { fonts, radius, spacing } from "./theme";
import { Badge, Body, Button, Card, Display, Eyebrow, Img, RowSkeleton, ServiceCardSkeleton, AnimatedPressable } from "./ui";

export { RowSkeleton, ServiceCardSkeleton };

export function ServiceCard({ service }: { service: Service }) {
  const { t, section, openService, startBooking, bp } = useNaturals();
  const [hover, setHover] = useState(false);
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: t.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: hover ? t.primaryBorder : t.border,
          overflow: "hidden",
          transform: [{ translateY: hover && !bp.isMobile ? -4 : 0 }],
        },
        hover && !bp.isMobile ? t.cardShadow : null,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${service.name}, ${service.duration_minutes} minutes, ${servicePriceLabel(service)}`}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        onPress={() => openService(service)}
      >
        <Img
          uri={serviceImage(service, section)}
          height={bp.isMobile ? 190 : 210}
          label={`${service.name} at Naturals ${section}`}
          radius={0}
          overlay="rgba(12, 8, 16, 0.12)"
        >
          <View style={{ position: "absolute", left: 14, top: 14, flexDirection: "row", gap: 6 }}>
            <View style={pillStyle}>
              <Body size={9.5} weight="700" color="#FFFFFF" style={{ letterSpacing: 1 }}>
                {service.category.toUpperCase()}
              </Body>
            </View>
            {service.is_demo ? (
              <View style={[pillStyle, { backgroundColor: "rgba(0,0,0,0.42)" }]}>
                <Body size={9.5} weight="600" color="#F4EFE6" style={{ letterSpacing: 0.8 }}>
                  DEMO
                </Body>
              </View>
            ) : null}
          </View>
          <View style={{ position: "absolute", right: 14, bottom: 14 }}>
            <View style={pillStyle}>
              <Body size={14} weight="700" color="#FFFFFF">
                {servicePriceLabel(service)}
              </Body>
            </View>
          </View>
        </Img>
        <View style={{ padding: 18, paddingBottom: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <Ionicons name="time-outline" size={13} color={t.primary} />
            <Body size={11} weight="600" color={t.muted}>
              {service.duration_minutes} min
            </Body>
          </View>
          <Display size={25} style={{ marginBottom: 6 }}>
            {service.name}
          </Display>
          <Body size={12.5} color={t.muted} numberOfLines={2} style={{ minHeight: 40 }}>
            {service.description}
          </Body>
        </View>
      </Pressable>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
          marginHorizontal: 18,
          marginBottom: 18,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: t.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View details for ${service.name}`}
          onPress={() => openService(service)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Body size={11.5} weight="700" color={t.inkSoft}>
            View details
          </Body>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Book ${service.name}`}
          onPress={() => startBooking(service)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            backgroundColor: t.primary,
            paddingLeft: 15,
            paddingRight: 12,
            minHeight: 44,
            borderRadius: radius.pill,
          }}
        >
          <Body size={11} weight="700" color={t.primaryText} style={{ letterSpacing: 0.4 }}>
            Book
          </Body>
          <Ionicons name="arrow-forward" size={13} color={t.primaryText} />
        </Pressable>
      </View>
    </View>
  );
}

const pillStyle = {
  backgroundColor: "rgba(16, 12, 20, 0.58)",
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.22)",
  paddingHorizontal: 10,
  paddingVertical: 5,
} as const;

export function CategoryTile({ category }: { category: { name: string; slug: string } }) {
  const { t, section, sectionServices, exploreCategory, bp } = useNaturals();
  const [hover, setHover] = useState(false);
  const count = sectionServices.filter((service) => service.category === category.name).length;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${category.name} services`}
      onPress={() => exploreCategory(category.name)}
      style={{ flex: 1, minWidth: bp.isMobile ? "45%" : 0 }}
    >
      <Img
        uri={categoryImageFor(category.name, section)}
        height={bp.isMobile ? 150 : 205}
        label={`${category.name} at Naturals`}
        radius={radius.xl}
        overlay="rgba(12, 8, 18, 0.34)"
        style={{ borderWidth: 1, borderColor: t.primaryBorder, opacity: hover ? 0.96 : 1 }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", padding: 18 }}>
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: "rgba(255,255,255,0.14)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.28)",
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: radius.pill,
              marginBottom: 9,
            }}
          >
            <Body size={9} weight="600" color="#FFFFFF" style={{ letterSpacing: 1.2 }}>
              {count} {count === 1 ? "SERVICE" : "SERVICES"}
            </Body>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Display size={bp.isMobile ? 27 : 32} color="#FFFFFF">
              {category.name}
            </Display>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: t.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-forward" size={15} color={t.primaryText} />
            </View>
          </View>
        </View>
      </Img>
    </AnimatedPressable>
  );
}

export function SalonCard({ salon, index, compact = false }: { salon: Salon; index: number; compact?: boolean }) {
  const { t, bp, staffBySalon, startBookingAtSalon, go } = useNaturals();
  const team = staffBySalon[salon.id] ?? [];
  return (
    <Card padded={false} style={{ overflow: "hidden", flex: 1 }}>
      <Img
        uri={salonImageFor(index, salon)}
        height={compact ? 150 : bp.isMobile ? 180 : 205}
        label={`${salon.name} interior`}
        radius={0}
        overlay="rgba(12, 8, 16, 0.1)"
      >
        <View style={{ position: "absolute", left: 14, top: 14 }}>
          <View style={pillStyle}>
            <Body size={10} weight="600" color="#FFFFFF" style={{ letterSpacing: 1 }}>
              {salon.city.toUpperCase()}
            </Body>
          </View>
        </View>
        {salon.is_demo ? (
          <View style={{ position: "absolute", right: 14, top: 14 }}>
            <View style={[pillStyle, { backgroundColor: "rgba(0,0,0,0.42)" }]}>
              <Body size={9} weight="600" color="#F4EFE6" style={{ letterSpacing: 0.8 }}>
                DEMO SALON
              </Body>
            </View>
          </View>
        ) : null}
      </Img>
      <View style={{ padding: 18 }}>
        <Display size={24} style={{ marginBottom: 4 }}>
          {salon.name}
        </Display>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Ionicons name="time-outline" size={13} color={t.primary} />
          <Body size={11.5} weight="600" color={t.inkSoft}>
            Open {salon.opens_at} – {salon.closes_at}
          </Body>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
          <Ionicons name="location-outline" size={14} color={t.muted} style={{ marginTop: 2 }} />
          <Body size={12} color={t.muted} style={{ flex: 1 }}>
            {salon.address}
          </Body>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="call-outline" size={13} color={t.muted} />
          <Body size={12} color={t.muted}>
            {salon.phone}
          </Body>
        </View>

        {team.length ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 15 }}>
            <View style={{ flexDirection: "row" }}>
              {team.slice(0, 3).map((stylist, teamIndex) => (
                <View
                  key={stylist.id}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: t.primarySoft,
                    borderWidth: 2,
                    borderColor: t.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: teamIndex === 0 ? 0 : -8,
                  }}
                >
                  <Body size={9} weight="700" color={t.primary}>
                    {stylist.name.split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase()}
                  </Body>
                </View>
              ))}
            </View>
            <Body size={11} color={t.muted}>
              {team.length} demo team members
            </Body>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 17 }}>
          <Button title="Book at this salon" onPress={() => startBookingAtSalon(salon)} small icon="arrow-forward" />
          <Button title="Salon details" onPress={() => go("Salons")} small kind="ghost" />
        </View>
      </View>
    </Card>
  );
}

export function OfferCard({ offer }: { offer: Offer }) {
  const { t, bp, startBookingWithOffer } = useNaturals();
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <View style={{ height: 2, backgroundColor: t.glow, opacity: 0.6 }} />
      <View style={{ flexDirection: bp.isMobile ? "column" : "row" }}>
        <View
          style={{
            width: bp.isMobile ? "100%" : 210,
            minHeight: bp.isMobile ? 150 : 200,
            backgroundColor: t.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            borderRightWidth: bp.isMobile ? 0 : 1,
            borderBottomWidth: bp.isMobile ? 1 : 0,
            borderColor: t.border,
            padding: 20,
          }}
        >
          <Display size={bp.isMobile ? 54 : 64} color={t.primary}>
            {offer.discount_percent}%
          </Display>
          <Eyebrow color={t.inkSoft}>off one visit</Eyebrow>
          {offer.is_demo ? <Badge label="demo offer" tone="outline" /> : null}
        </View>
        <View style={{ flex: 1, padding: bp.isMobile ? 18 : 24, justifyContent: "center" }}>
          <Display size={28} style={{ marginBottom: 7 }}>
            {offer.title}
          </Display>
          <Body size={13} color={t.muted} style={{ marginBottom: 13 }}>
            {offer.description}
          </Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <View
              style={{
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: t.primaryBorder,
                borderRadius: radius.sm,
                paddingHorizontal: 12,
                paddingVertical: 7,
                backgroundColor: t.surfaceAlt,
              }}
            >
              <Body size={12} weight="700" color={t.primary} style={{ letterSpacing: 1.4 }}>
                {offer.code}
              </Body>
            </View>
            <Button title="Apply offer" small kind="outline" onPress={() => startBookingWithOffer(offer.code)} />
          </View>
          <Body size={10} color={t.muted} style={{ marginTop: 12 }}>
            Eligibility and the final discount are verified by the salon server at checkout.
          </Body>
        </View>
      </View>
    </Card>
  );
}

export function BookingCard({ booking }: { booking: Booking }) {
  const { t, bp, startBooking, cancelBooking } = useNaturals();
  const date = new Date(`${booking.date}T12:00:00`);
  const upcoming = booking.status === "confirmed" && isUpcoming(booking);
  return (
    <Card style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 18 }}>
        <View
          style={{
            width: bp.isMobile ? "100%" : 92,
            borderRadius: radius.lg,
            backgroundColor: t.primarySoft,
            borderWidth: 1,
            borderColor: t.primaryBorder,
            paddingVertical: 12,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: bp.isMobile ? "row" : "column",
            gap: bp.isMobile ? 10 : 0,
          }}
        >
          <Body size={10} weight="700" color={t.primary} style={{ letterSpacing: 1.2 }}>
            {date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
          </Body>
          <Display size={32} style={{ marginVertical: bp.isMobile ? 0 : 2 }}>
            {date.getDate()}
          </Display>
          <Body size={10.5} color={t.muted}>
            {date.toLocaleDateString("en-IN", { weekday: "long" })}
          </Body>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <Body size={10} weight="700" color={t.muted} style={{ letterSpacing: 1.1 }}>
              {booking.reference}
            </Body>
            <Badge
              label={booking.status}
              tone={booking.status === "confirmed" ? "success" : booking.status === "cancelled" ? "danger" : "muted"}
            />
          </View>
          <Display size={24} style={{ marginTop: 4 }}>
            {booking.service.name}
          </Display>
          <Body size={12.5} color={t.muted} style={{ marginTop: 3 }}>
            {booking.salon.name} · {booking.salon.city}
          </Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            <Meta icon="calendar-outline" text={formatDate(booking.date)} />
            <Meta icon="time-outline" text={`${timeLabel(booking.start_time)} – ${timeLabel(booking.end_time)}`} />
            <Meta icon="person-outline" text={booking.stylist.name} />
            <Meta icon="hourglass-outline" text={`${booking.service.duration_minutes} min`} />
          </View>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          borderTopWidth: 1,
          borderTopColor: t.border,
          marginTop: 16,
          paddingTop: 14,
        }}
      >
        <View>
          <Body size={10} color={t.muted}>
            {booking.offer_code ? `Offer ${booking.offer_code} applied` : "Total"}
          </Body>
          <Display size={24}>{money(booking.total)}</Display>
        </View>
        {upcoming ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Reschedule" small kind="outline" onPress={() => startBooking(null, booking)} />
            <Button title="Cancel" small kind="ghost" onPress={() => cancelBooking(booking)} />
          </View>
        ) : (
          <Body size={11} color={t.muted}>
            {booking.status === "cancelled" ? "This appointment was cancelled." : "This appointment is complete."}
          </Body>
        )}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
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

export function StylistCard({ stylist, salonName }: { stylist: Stylist; salonName: string }) {
  const { t } = useNaturals();
  return (
    <Card style={{ flex: 1, minWidth: 210, padding: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: t.primarySoft,
            borderWidth: 1,
            borderColor: t.primaryBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Display size={22} color={t.primary}>
            {stylist.name
              .split(" ")
              .slice(-1)[0]
              ?.slice(0, 1)
              .toUpperCase()}
          </Display>
        </View>
        <View style={{ flex: 1 }}>
          <Body size={13} weight="700" color={t.ink}>
            {stylist.name}
          </Body>
          <Body size={10.5} color={t.muted} numberOfLines={1}>
            {stylist.title}
          </Body>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 }}>
        <Ionicons name="storefront-outline" size={12} color={t.muted} />
        <Body size={10.5} color={t.muted} numberOfLines={1} style={{ flex: 1 }}>
          {salonName}
        </Body>
      </View>
      <Badge label="demo profile" tone="outline" />
    </Card>
  );
}

/**
 * Compact treatment row used by the booking flow. It keeps the scan path short:
 * image, name, duration/category and price all sit on one line so customers can
 * compare more treatments before scrolling. The selection ring and check mark
 * animate in instead of snapping, which makes taps feel intentional.
 */
export function ServiceSelectCard({ service, selected, onPress }: { service: Service; selected: boolean; onPress: () => void }) {
  const { t, section } = useNaturals();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: selected ? 1 : 0,
      friction: 8,
      tension: 90,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [progress, selected]);

  const checkScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const checkOpacity = progress;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${service.name}, ${service.duration_minutes} minutes, ${servicePriceLabel(service)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        padding: 10,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? t.primary : pressed ? t.primaryBorder : t.border,
        backgroundColor: selected ? t.primarySoft : pressed ? t.surfaceAlt : t.surface,
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View style={{ position: "relative" }}>
        <Img uri={serviceImage(service, section)} height={52} label={service.name} radius={radius.md} style={{ width: 52 }} />
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -5,
            bottom: -5,
            width: 19,
            height: 19,
            borderRadius: 10,
            backgroundColor: t.primary,
            borderWidth: 2,
            borderColor: t.surface,
            alignItems: "center",
            justifyContent: "center",
            opacity: checkOpacity,
            transform: [{ scale: checkScale }],
          }}
        >
          <Ionicons name="checkmark" size={11} color={t.primaryText} />
        </Animated.View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Body size={12.5} weight="700" color={t.ink} numberOfLines={1}>
          {service.name}
        </Body>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
          <Ionicons name="time-outline" size={11} color={selected ? t.primary : t.muted} />
          <Body size={10} color={t.muted}>
            {service.duration_minutes} min
          </Body>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong }} />
          <Body size={10} color={t.muted} numberOfLines={1}>
            {service.category}
          </Body>
          {service.is_demo ? (
            <Body size={9} color={t.muted}>
              · demo
            </Body>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: "flex-end", gap: 4, paddingLeft: 4 }}>
        <Body size={12.5} weight="700" color={t.primary} numberOfLines={1}>
          {servicePriceLabel(service)}
        </Body>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 1.5,
            borderColor: selected ? t.primary : t.borderStrong,
            backgroundColor: selected ? t.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? <Ionicons name="checkmark" size={10} color={t.primaryText} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function SalonSelectCard({ salon, index, selected, onPress }: { salon: Salon; index: number; selected: boolean; onPress: () => void }) {
  const { t } = useNaturals();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        padding: 12,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? t.primary : t.border,
        backgroundColor: selected ? t.primarySoft : t.surface,
        marginBottom: 10,
      }}
    >
      <Img uri={salonImageFor(index, salon)} height={64} label={salon.name} radius={radius.md} style={{ width: 64 }} />
      <View style={{ flex: 1 }}>
        <Body size={13} weight="700" color={t.ink}>
          {salon.name}
        </Body>
        <Body size={10.5} color={t.muted} numberOfLines={1}>
          {salon.city} · {salon.opens_at}–{salon.closes_at}
        </Body>
        <Body size={10} color={t.muted} numberOfLines={1}>
          {salon.address}
        </Body>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={21} color={selected ? t.primary : t.borderStrong} />
    </Pressable>
  );
}

export function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: strong ? 0 : 9 }}>
      <Body size={strong ? 12 : 12} weight={strong ? "700" : "400"} color={strong ? t.ink : t.muted}>
        {label}
      </Body>
      {strong ? <Display size={26}>{value}</Display> : <Body size={12.5} weight="600" color={t.inkSoft}>{value}</Body>}
    </View>
  );
}

export function StatCard({ value, label }: { value: string | number; label: string }) {
  const { t } = useNaturals();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 130,
        padding: 17,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
      }}
    >
      <Display size={30} color={t.primary}>
        {value}
      </Display>
      <Body size={10.5} color={t.muted} style={{ marginTop: 3 }}>
        {label}
      </Body>
    </View>
  );
}

export const componentStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
