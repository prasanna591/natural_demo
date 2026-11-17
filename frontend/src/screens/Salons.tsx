import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Linking, Pressable, TextInput, View } from "react-native";
import type { Salon } from "../api";
import { useNaturals } from "../context";
import { salonImageFor } from "../images";
import { PageShell } from "../layout";
import { fonts, radius } from "../theme";
import { Badge, Body, Button, Card, DemoNote, Display, Eyebrow, Img } from "../ui";

function isOpenNow(salon: Salon) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMinute] = salon.opens_at.split(":").map(Number);
  const [closeHour, closeMinute] = salon.closes_at.split(":").map(Number);
  const opensAt = openHour * 60 + openMinute;
  const closesAt = closeHour * 60 + closeMinute;
  return closesAt >= opensAt
    ? currentMinutes >= opensAt && currentMinutes < closesAt
    : currentMinutes >= opensAt || currentMinutes < closesAt;
}

export function SalonsScreen() {
  const { t, bp, salons, sectionServices, section, salonId, startBookingAtSalon, loading, setError } = useNaturals();
  const [query, setQuery] = useState("");

  const filteredSalons = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return salons;
    return salons.filter((salon) =>
      `${salon.name} ${salon.city} ${salon.address}`.toLocaleLowerCase().includes(term),
    );
  }, [query, salons]);

  const openDirections = async (salon: Salon) => {
    if (salon.is_demo || salon.address.toLowerCase().includes("demo address")) {
      setError("Directions aren’t available for this demo branch because it has no verified address.");
      return;
    }
    const address = encodeURIComponent(`${salon.name}, ${salon.address}, ${salon.city}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${address}`;
    try {
      if (!(await Linking.canOpenURL(url))) {
        setError("Could not open map directions on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open map directions on this device.");
    }
  };

  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? 24 : 44 }}>
        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", justifyContent: "space-between", alignItems: bp.isDesktop ? "flex-end" : "flex-start", gap: 20 }}>
          <View style={{ maxWidth: 650 }}>
            <Eyebrow>Find your salon</Eyebrow>
            <Display size={bp.isMobile ? 38 : 52} style={{ marginTop: 10 }}>
              Find a Naturals branch.
            </Display>
            <Body size={13.5} color={t.muted} style={{ marginTop: 12, maxWidth: 560 }}>
              Search by city, locality or address, view branch hours and book directly with a location.
            </Body>
          </View>
          <Badge label={`${salons.length} branches`} tone="primary" icon="location-outline" />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 52, marginTop: 24 }}>
          <Ionicons name="search-outline" size={18} color={t.primary} />
          <TextInput
            accessibilityLabel="Search branches by city or address"
            value={query}
            onChangeText={setQuery}
            placeholder="Search city, locality or branch address"
            placeholderTextColor={t.muted}
            returnKeyType="search"
            style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: t.ink, paddingVertical: 12 }}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear branch search" onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 16 }}>
          <Ionicons name="information-circle-outline" size={15} color={t.muted} />
          <Body size={10.5} color={t.muted}>
            Search uses branch data from the API. Location access and distance estimates aren’t available in this app.
          </Body>
        </View>

        <View style={{ gap: 16 }}>
          {filteredSalons.map((salon, index) => (
            <BranchCard
              key={salon.id}
              salon={salon}
              index={index}
              serviceCount={sectionServices.length}
              section={section}
              selected={salonId === salon.id}
              onBook={() => startBookingAtSalon(salon)}
              onDirections={() => void openDirections(salon)}
            />
          ))}
          {!filteredSalons.length && !loading ? (
            <Card style={{ padding: 28, alignItems: "center" }}>
              <Ionicons name="location-outline" size={28} color={t.primary} />
              <Display size={25} style={{ marginTop: 10 }}>No branches found</Display>
              <Body size={12} color={t.muted} style={{ marginTop: 5, textAlign: "center" }}>
                Try another city, locality or address.
              </Body>
            </Card>
          ) : null}
          {!salons.length && loading ? (
            <Card style={{ padding: 22 }}>
              <Body size={12} color={t.muted}>Loading branches…</Body>
            </Card>
          ) : null}
        </View>

        <DemoNote center>
          Chennai, Madurai, Salem and Kumbakonam branch names, addresses, PIN codes and phone numbers are based on the
          official Tamil Nadu locator. Seelanaickenpatty is temporarily closed and hidden from public booking. Published
          service prices and Bharathi Salai starting prices are seeded from the supplied price lists; durations, sample
          teams and availability are app data. Confirm details with the branch before visiting.
        </DemoNote>
      </View>
    </PageShell>
  );
}

function BranchCard({
  salon,
  index,
  serviceCount,
  section,
  selected,
  onBook,
  onDirections,
}: {
  salon: Salon;
  index: number;
  serviceCount: number;
  section: "men" | "women";
  selected: boolean;
  onBook: () => void;
  onDirections: () => void;
}) {
  const { t, bp } = useNaturals();
  const open = isOpenNow(salon);
  const directionsEnabled = !salon.is_demo && !salon.address.toLowerCase().includes("demo address");
  return (
    <Card
      padded={false}
      style={{
        overflow: "hidden",
        borderColor: selected ? t.primary : t.border,
        borderWidth: selected ? 1.5 : 1,
      }}
    >
      <View style={{ flexDirection: bp.isDesktop ? "row" : "column" }}>
        <Img
          uri={salonImageFor(index)}
          height={bp.isMobile ? 190 : bp.isDesktop ? 290 : 230}
          label={`${salon.name} salon`}
          radius={0}
          style={{ width: bp.isDesktop ? "36%" : "100%" }}
          overlay="rgba(12, 8, 16, 0.12)"
        />
        <View style={{ flex: 1, padding: bp.isMobile ? 18 : 25 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <Badge label={salon.city} tone="primary" icon="location-outline" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <Badge
                label={salon.is_demo ? "Demo branch" : "Verified branch"}
                tone={salon.is_demo ? "muted" : "success"}
                icon={salon.is_demo ? "information-circle-outline" : "checkmark-circle"}
              />
              {selected ? <Badge label="Selected branch" tone="success" icon="checkmark-circle" /> : null}
              <Badge label={open ? "Open now" : "Closed now"} tone={open ? "success" : "muted"} icon={open ? "time-outline" : "moon-outline"} />
              {salon.review_count && salon.average_rating != null ? (
                <Badge
                  label={`${salon.average_rating.toFixed(1)} · ${salon.review_count} reviews`}
                  tone="primary"
                  icon="star-outline"
                />
              ) : null}
            </View>
          </View>
          <Display size={bp.isMobile ? 27 : 33} style={{ marginTop: 11 }}>{salon.name}</Display>
          <View style={{ gap: 9, marginTop: 13 }}>
            <DetailRow icon="location-outline" text={salon.address} />
            <DetailRow icon="call-outline" text={salon.phone} />
            <DetailRow icon="time-outline" text={`Hours · ${salon.opens_at}–${salon.closes_at}`} />
            <DetailRow icon="sparkles-outline" text={`${serviceCount} ${section === "men" ? "grooming services" : "beauty services"} in the catalogue`} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 18 }}>
            <Button title="Book at this branch" small onPress={onBook} icon="arrow-forward" />
            <Button title="Directions" small kind="outline" onPress={onDirections} icon="navigate-outline" disabled={!directionsEnabled} />
          </View>
          {!directionsEnabled ? <DemoNote>Directions unavailable until this branch has a verified address.</DemoNote> : null}
        </View>
      </View>
    </Card>
  );
}

function DetailRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
      <Ionicons name={icon} size={14} color={t.primary} style={{ marginTop: 2 }} />
      <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>{text}</Body>
    </View>
  );
}
