import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { ServiceCard } from "../components";
import { useNaturals } from "../context";
import { PageShell } from "../layout";
import { fonts, radius } from "../theme";
import { Badge, Body, Button, Chip, DemoNote, Display, EmptyState, Eyebrow } from "../ui";

export function ExploreScreen() {
  const app = useNaturals();
  const { t, section, bp, sectionServices, sectionCategories, filteredServices, search, setSearch, filter, setFilter, go } = app;
  const [focused, setFocused] = useState(false);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: sectionServices.length };
    sectionServices.forEach((service) => {
      map[service.category] = (map[service.category] ?? 0) + 1;
    });
    return map;
  }, [sectionServices]);

  const clear = () => {
    setSearch("");
    setFilter("All");
  };
  const filtering = search.trim().length > 0 || filter !== "All";

  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? 24 : 44 }}>
        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", justifyContent: "space-between", alignItems: bp.isDesktop ? "flex-end" : "flex-start", gap: 20 }}>
          <View style={{ maxWidth: 650 }}>
            <Eyebrow>{section === "men" ? "The discipline catalogue" : "The treatment catalogue"}</Eyebrow>
            <Display size={bp.isMobile ? 38 : 52} style={{ marginTop: 10 }}>
              {section === "men" ? "Disciplines & rituals" : "Treatments & rituals"}
            </Display>
            <Body size={13.5} color={t.muted} style={{ marginTop: 12, maxWidth: 560 }}>
              {section === "men"
                ? "Explore cuts, grooming, skin and body work. Each card carries its duration, published starting price and direct booking action."
                : "Explore hair, skin, body and bridal care. Each card carries its duration, published starting price and direct booking action."}
            </Body>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ minHeight: 28, alignSelf: "center" }}>
              <Badge label={`${sectionServices.length} ${section === "men" ? "disciplines" : "rituals"}`} tone="primary" />
            </View>
            <View style={{ minHeight: 28, alignSelf: "center" }}>
              <Button title="Book a visit" small onPress={() => app.startBooking()} icon="arrow-forward" />
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: focused ? t.primary : t.border,
            backgroundColor: t.surface,
            borderRadius: radius.pill,
            paddingHorizontal: 17,
            minHeight: 54,
            marginTop: 26,
            marginBottom: 18,
          }}
        >
          <Ionicons name="search-outline" size={18} color={focused ? t.primary : t.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={section === "men" ? "Search cuts, grooming, facials…" : "Search hair, facials, bridal, body…"}
            placeholderTextColor={t.muted}
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              fontFamily: fonts.body,
              fontSize: 13.5,
              color: t.ink,
              paddingVertical: 12,
            }}
          />
          {search ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")} style={{ minHeight: 32, justifyContent: "center", alignSelf: "center" }}>
              <Ionicons name="close-circle" size={18} color={t.muted} />
            </Pressable>
          ) : (
            <View style={{ minHeight: 28, alignSelf: "center" }}>
              <Badge label="live" tone="outline" />
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <View style={{ minHeight: 32 }}>
            <Chip label={`All (${counts.All ?? 0})`} selected={filter === "All"} onPress={() => setFilter("All")} icon="grid-outline" />
          </View>
          {sectionCategories.map((category) => (
            <View key={category.id} style={{ minHeight: 32 }}>
              <Chip
                label={`${category.name}${counts[category.name] ? ` (${counts[category.name]})` : ""}`}
                selected={filter === category.name}
                onPress={() => setFilter(category.name)}
              />
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Body size={11.5} color={t.muted} style={{ flexShrink: 1, minWidth: 0 }}>
            Showing <Body size={11.5} weight="700" color={t.ink}>{filteredServices.length}</Body> of {sectionServices.length} {section === "men" ? "disciplines" : "rituals"}
            {filter !== "All" ? ` in ${filter}` : ""}
            {search ? ` matching “${search.trim()}”` : ""}.
          </Body>
          {filtering ? (
            <Pressable accessibilityRole="button" onPress={clear} style={{ minHeight: 32, justifyContent: "center", flexShrink: 0 }}>
              <Body size={11} weight="700" color={t.primary}>
                Clear filters
              </Body>
            </Pressable>
          ) : (
            <DemoNote center>
              Published prices and app-estimated durations from the live API.
            </DemoNote>
          )}
        </View>

        {filteredServices.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 }}>
            {filteredServices.map((service) => (
              <View key={service.id} style={{ width: bp.isMobile ? "100%" : bp.isTablet ? "48.6%" : "32%" }}>
                <ServiceCard service={service} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="search-outline"
            title="No rituals match yet"
            message="Try a different word, switch category, or clear the filters to see the full catalogue."
            actionLabel="Clear search & filters"
            onAction={clear}
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View offers and promotions"
          onPress={() => go("Offers")}
          style={{
            flexDirection: bp.isMobile ? "column" : "row",
            alignItems: bp.isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 24,
            padding: 18,
            borderRadius: radius.lg,
            backgroundColor: t.primarySoft,
            borderWidth: 1,
            borderColor: t.primaryBorder,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="pricetag-outline" size={17} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Body size={13} weight="700" color={t.ink}>Offers & promotions</Body>
              <Body size={11} color={t.muted}>View current offers supplied by the API, including any demo promotions.</Body>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Body size={11.5} weight="700" color={t.primary}>View offers</Body>
            <Ionicons name="arrow-forward" size={15} color={t.primary} />
          </View>
        </Pressable>

        <View
          style={{
            marginTop: 42,
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
            <Display size={26}>Not sure where to begin?</Display>
            <Body size={12} color={t.muted} style={{ marginTop: 5 }}>
              Start with the salon team's most-booked ritual, or browse every service at your chosen studio.
            </Body>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              title="View salons"
              small
              kind="outline"
              onPress={() => go("Salons")}
            />
            <Button
              title="Book a consultation"
              small
              onPress={() => {
                const first = sectionServices[0];
                if (first) app.startBooking(first);
                else app.startBooking();
              }}
            />
          </View>
        </View>

        <DemoNote center>
          Published prices are shown as listed, starting or branch-specific values from the salon API; durations are app
          estimates. Member prices appear in each service's description. No payment is collected.
        </DemoNote>
      </View>
    </PageShell>
  );
}
