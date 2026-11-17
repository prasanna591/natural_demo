import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import { OfferCard } from "../components";
import { useNaturals } from "../context";
import { PageShell } from "../layout";
import { radius } from "../theme";
import { Badge, Body, Button, Card, DemoNote, Display, EmptyState, Eyebrow } from "../ui";

export function OffersScreen() {
  const { t, bp, offers, go } = useNaturals();
  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? 24 : 44 }}>
        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", justifyContent: "space-between", alignItems: bp.isDesktop ? "flex-end" : "flex-start", gap: 18 }}>
          <View style={{ maxWidth: 650 }}>
            <Eyebrow>A little extra</Eyebrow>
            <Display size={bp.isMobile ? 38 : 52} style={{ marginTop: 10 }}>
              Offers, plainly put.
            </Display>
            <Body size={13.5} color={t.muted} style={{ marginTop: 12, maxWidth: 560 }}>
              Only currently active offers from the salon API appear here. Codes and discounts are checked again by the
              server when you confirm an appointment.
            </Body>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Badge label={`${offers.length} active`} tone="primary" icon="pricetag-outline" />
            <Badge label="server validated" tone="outline" icon="shield-checkmark-outline" />
          </View>
        </View>

        <View style={{ gap: 16, marginTop: 28 }}>
          {offers.map((offer) => (
            <OfferCard key={offer.code} offer={offer} />
          ))}
          {!offers.length ? (
            <EmptyState
              icon="pricetag-outline"
              title="No offers right now"
              message="There are no active offers in the salon database. Check back soon or explore the full service catalogue."
              actionLabel="Explore services"
              onAction={() => go("Explore")}
            />
          ) : null}
        </View>

        <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 14, marginTop: 28 }}>
          <Card style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Ionicons name="shield-checkmark-outline" size={18} color={t.primary} />
              <Body size={13} weight="700" color={t.ink}>
                Checked at checkout
              </Body>
            </View>
            <Body size={11.5} color={t.muted}>
              A code can be applied during the review step. The final eligibility, usage limit and discount are validated on
              the server, not in this screen.
            </Body>
          </Card>
          <Card style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Ionicons name="information-circle-outline" size={18} color={t.primary} />
              <Body size={13} weight="700" color={t.ink}>
                Demo promotion data
              </Body>
            </View>
            <Body size={11.5} color={t.muted}>
              The welcome offer is seeded development data, not an official Naturals promotion. It may be changed or removed
              by an administrator at any time.
            </Body>
          </Card>
        </View>

        <Card style={{ marginTop: 14, backgroundColor: t.surfaceAlt }}>
          <View
            style={{
              flexDirection: bp.isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: bp.isMobile ? "flex-start" : "center",
              gap: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Ionicons name="card-outline" size={18} color={t.primary} />
                <Display size={24}>Membership & prepaid cards</Display>
              </View>
              <Body size={11.5} color={t.muted} style={{ marginTop: 7, maxWidth: 620 }}>
                Naturals publishes member pricing plus membership, prepaid and voucher products including the Diamond
                Card and Universal Card. Their nationwide denominations are not public, so this app does not invent them
                or treat them as active offers.
              </Body>
            </View>
            <Button title="About Naturals" small kind="outline" icon="arrow-forward" onPress={() => go("About")} />
          </View>
        </Card>

        <View
          style={{
            marginTop: 26,
            padding: 22,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.surfaceAlt,
          }}
        >
          <Display size={26}>Using a code is simple.</Display>
          <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 16, marginTop: 14 }}>
            {["Choose any service and salon.", "Enter the code on the review step.", "Confirm — the server applies the real discount."].map((step, index) => (
              <View key={step} style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: t.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Body size={10} weight="700" color={t.primaryText}>
                    {index + 1}
                  </Body>
                </View>
                <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>
                  {step}
                </Body>
              </View>
            ))}
          </View>
        </View>

        <DemoNote center>
          No payment is collected. Offer usage, pricing and availability remain subject to the backend's validation rules.
        </DemoNote>
      </View>
    </PageShell>
  );
}
