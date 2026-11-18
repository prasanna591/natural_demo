import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Linking,
  PanResponder,
  Pressable,
  Platform,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from "react-native";
import { buildImageUrl, money, timeLabel, todayString, type Campaign } from "../api";
import { CategoryTile, SalonCard, ServiceCard, StylistCard } from "../components";
import { useNaturals } from "../context";
import { editorialImage, heroImage, offerImage, promiseImage, haircutImage, hairColourImage, skincareImage, bridalImage, spaImage, mensGroomingImage } from "../images";
import { PageShell } from "../layout";
import { promoImages } from "../promoImages";
import { fonts, radius } from "../theme";
import { Badge, Body, Button, Card, DemoNote, Display, Eyebrow, Img, SectionHeading } from "../ui";

const COPY = {
  women: {
    eyebrow: "Naturals for women",
    heroTitle: "Salon care,\nin your own rhythm.",
    heroCopy:
      "Thoughtful hair, skin and bridal rituals in a light, unhurried setting — booked around your life, not the other way around.",
    heroCta: "Book an appointment",
    heroSecondary: "Explore treatments",
    editTitle: "The Naturals edit",
    editSub: "Signature rituals chosen from the live service catalogue. Every price and duration below comes from the salon API.",
    categoriesTitle: "Find your ritual",
    categoriesSub: "Start with a category, then narrow the services to exactly what you need.",
    salonsTitle: "Find your Naturals",
    salonsSub: "Verified branches across the current directory, each with real opening hours, contact details and a bookable team.",
    teamTitle: "Your specialists",
    teamSub: "A preview of the demo team. Choose your specialist in the booking flow — availability is checked by the salon server.",
    promiseTitle: "An easier kind of care",
    promiseSub: "The details that make a salon visit feel considered, from the first question to the final finish.",
    ctaTitle: "Your chair is waiting.",
    ctaCopy: "Choose a service, pick a real available time and let the salon team take it from there.",
    categoryOrder: ["Hair", "Skin", "Body", "Bridal"],
    promise: [
      {
        icon: "chatbubble-ellipses-outline" as const,
        title: "A conversation first",
        text: "Every visit starts with listening — your hair, your skin, the look you actually want to leave with.",
      },
      {
        icon: "leaf-outline" as const,
        title: "Considered rituals",
        text: "Cuts, colour-friendly care, facials and body treatments with clear durations and demo pricing upfront.",
      },
      {
        icon: "time-outline" as const,
        title: "Room to breathe",
        text: "A calm appointment window, a real availability check and no payment collected in this demo.",
      },
    ],
  },
  men: {
    eyebrow: "Naturals for men",
    heroTitle: "Grooming,\nwith quiet confidence.",
    heroCopy:
      "Precision cuts, beard-friendly grooming and restorative treatments in a deep, considered atelier. No noise — just a good chair and proper craft.",
    heroCta: "Book a grooming session",
    heroSecondary: "View disciplines",
    editTitle: "The grooming edit",
    editSub: "Signature disciplines chosen from the live service catalogue. Durations and prices are pulled from the salon API.",
    categoriesTitle: "Choose your discipline",
    categoriesSub: "Hair, beard-friendly grooming, skin and body — each with its own set of rituals.",
    salonsTitle: "Find your atelier",
    salonsSub: "Verified branches with real opening hours, contact details and a bookable team.",
    teamTitle: "The atelier team",
    teamSub: "A preview of the demo team. Pick your barber or stylist during booking, subject to the server's real availability.",
    promiseTitle: "Built around the chair",
    promiseSub: "A quieter kind of grooming appointment, with the details that matter left in plain sight.",
    ctaTitle: "Take the chair.",
    ctaCopy: "Pick a discipline, choose a real open slot and let the team handle the rest.",
    categoryOrder: ["Men's grooming", "Hair", "Skin", "Body"],
    promise: [
      {
        icon: "cut-outline" as const,
        title: "Precision, unhurried",
        text: "Clean lines and a considered finish, without rushing the chair time or the conversation.",
      },
      {
        icon: "shield-checkmark-outline" as const,
        title: "Grooming, not guesswork",
        text: "Cuts, beard-friendly grooming, skin and body treatments with clearly listed durations.",
      },
      {
        icon: "moon-outline" as const,
        title: "A calmer atelier",
        text: "Deep-toned spaces, straightforward booking and no payment collected in this demo.",
      },
    ],
  },
};

export function HomeScreen() {
  const app = useNaturals();
  const { t, section, bp, services, sectionServices, sectionCategories, featuredServices, salons, offers, user, appSettings, publicContent, publicCampaigns } = app;
  const base = COPY[section];
  const text = (key: string, fallback: string) => (publicContent[key]?.trim() ? publicContent[key] : fallback);
  const copy = {
    ...base,
    eyebrow: text(`home.hero.eyebrow.${section}`, base.eyebrow),
    heroTitle: text(`home.hero.title.${section}`, base.heroTitle),
    heroCopy: text(`home.hero.copy.${section}`, base.heroCopy),
    heroCta: text(`home.hero.cta.${section}`, base.heroCta),
    heroSecondary: text(`home.hero.secondary.${section}`, base.heroSecondary),
    editTitle: text(`home.edit.title.${section}`, base.editTitle),
    editSub: text(`home.edit.subtitle.${section}`, base.editSub),
    categoriesTitle: text(`home.categories.title.${section}`, base.categoriesTitle),
    categoriesSub: text(`home.categories.subtitle.${section}`, base.categoriesSub),
    salonsTitle: text(`home.salons.title.${section}`, base.salonsTitle),
    salonsSub: text(`home.salons.subtitle.${section}`, base.salonsSub),
    teamTitle: text(`home.team.title.${section}`, base.teamTitle),
    teamSub: text(`home.team.subtitle.${section}`, base.teamSub),
    promiseTitle: text(`home.promise.title.${section}`, base.promiseTitle),
    promiseSub: text(`home.promise.subtitle.${section}`, base.promiseSub),
    ctaTitle: text(`home.cta.title.${section}`, base.ctaTitle),
    ctaCopy: text(`home.cta.copy.${section}`, base.ctaCopy),
  };
  const heroUri = text(`home.hero.image.${section}`, "") ? buildImageUrl(publicContent[`home.hero.image.${section}`]) : heroImage[section];
  const audience = section === "men" ? "Men" : "Women";
  const campaigns = publicCampaigns.filter((item) => item.audience === "Everyone" || item.audience === audience);
  const featured = featuredServices[0] ?? services[0];
  const offer = offers[0];
  const handleCampaignAction = (campaign: Campaign) => {
    const target = campaign.cta_url?.trim() ?? "";
    if (/^https?:\/\//i.test(target)) {
      void Linking.openURL(target).catch(() => app.notify("Could not open the campaign link.", "error"));
      return;
    }

    const route = target.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "").toLowerCase();
    if (/^(book|booking|appointments?)(\/|$)/.test(route)) return app.startBooking(featured);
    if (/^(offers?|packages?)(\/|$)/.test(route)) return app.go("Offers");
    if (/^(salons?|branches?)(\/|$)/.test(route)) return app.go("Salons");
    if (/^profile(\/|$)/.test(route)) return app.go("Profile");
    if (/^(explore|services?)(\/|$)/.test(route)) return app.go("Explore");

    const label = campaign.cta_label.toLowerCase();
    if (/book|appointment|booking/.test(label)) return app.startBooking(featured);
    if (/offer|package/.test(label)) return app.go("Offers");
    if (/salon|branch/.test(label)) return app.go("Salons");
    app.go("Explore");
  };
  const selectedSalon = app.selectedSalon ?? salons[0];
  const verifiedSalons = salons.filter((salon) => !salon.is_demo);
  const verifiedCityCount = new Set(verifiedSalons.map((salon) => salon.city)).size;
  const team = selectedSalon ? app.staffBySalon[selectedSalon.id] ?? [] : [];
  const nextCategories = sectionCategories.length
    ? sectionCategories
    : section === "women"
      ? [{ id: -1, name: "Hair", slug: "hair" }, { id: -2, name: "Skin", slug: "skin" }, { id: -3, name: "Body", slug: "body" }, { id: -4, name: "Bridal", slug: "bridal" }]
      : [{ id: -1, name: "Men's grooming", slug: "mens-grooming" }, { id: -2, name: "Hair", slug: "hair" }, { id: -3, name: "Skin", slug: "skin" }, { id: -4, name: "Body", slug: "body" }];

  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? 20 : 38 }}>
        <PromoCarousel
          section={section}
          heroUri={heroUri}
          campaigns={campaigns}
          onBook={() => app.startBooking(featured)}
          onExplore={() => app.go("Explore")}
          onOffers={() => app.go("Offers")}
          onSalons={() => app.go("Salons")}
          onCampaignAction={handleCampaignAction}
          active={app.tab === "Home" && !app.bookingOpen}
        />
        {appSettings.promo_banner_enabled ? (
          <Card style={{ marginTop: 16, flexDirection: bp.isDesktop ? "row" : "column", alignItems: bp.isDesktop ? "center" : "flex-start", justifyContent: "space-between", gap: 14, backgroundColor: t.surfaceAlt }}>
            <View style={{ flex: 1 }}>
              <Eyebrow>From Naturals</Eyebrow>
              <Display size={bp.isMobile ? 25 : 30} style={{ marginTop: 5 }}>{appSettings.promo_banner_title}</Display>
              <Body size={12} color={t.muted} style={{ marginTop: 4 }}>{appSettings.promo_banner_message}</Body>
            </View>
            <Button title={appSettings.promo_banner_cta} small onPress={() => app.go("Offers")} icon="arrow-forward" />
          </Card>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 22 }}>
          <View style={{ flex: 1, minWidth: bp.isMobile ? "100%" : 250 }}>
            {user ? <Badge label={`welcome back, ${user.name.split(" ")[0]}`} tone="primary" icon="sparkles" /> : null}
            <Eyebrow style={{ marginTop: user ? 12 : 0 }}>{copy.eyebrow}</Eyebrow>
            <Display size={bp.isMobile ? 36 : 46} style={{ marginTop: 6 }}>{copy.heroTitle.replace("\n", " ")}</Display>
            <Body size={12.5} color={t.muted} style={{ marginTop: 7, maxWidth: 540 }}>{copy.heroCopy}</Body>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
            <Button title="Explore services" small kind="outline" onPress={() => app.go("Explore")} />
            <Button title="Find a branch" small onPress={() => app.go("Salons")} icon="location-outline" />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: t.border,
            paddingVertical: 16,
            marginTop: bp.isMobile ? 28 : 40,
            marginBottom: bp.isMobile ? 12 : 18,
          }}
        >
          <TrustItem icon="storefront-outline" value={`${verifiedSalons.length} verified branches`} label={`${verifiedCityCount} cities in Tamil Nadu`} />
          <TrustItem icon="sparkles-outline" value={`${sectionServices.length} rituals`} label={`Curated for ${section === "men" ? "men" : "women"}`} />
          <TrustItem icon="time-outline" value={selectedSalon ? `${selectedSalon.opens_at}–${selectedSalon.closes_at}` : "9:00–21:00"} label="Salon hours" />
          <TrustItem icon="pricetag-outline" value={offer ? `${offer.discount_percent}% demo offer` : "Live offers"} label={offer ? offer.code : "Check offers"} />
          <TrustItem icon="ribbon-outline" value="Since 2000" label="Chennai-born salon & spa" />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search services"
          onPress={() => app.go("Explore")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.surface,
            borderRadius: radius.pill,
            paddingHorizontal: 16,
            minHeight: 50,
            marginTop: bp.isMobile ? 8 : 6,
            marginBottom: bp.isMobile ? 28 : 8,
          }}
        >
          <Ionicons name="search-outline" size={17} color={t.muted} />
  <Body size={12.5} color={t.muted} style={{ flex: 1 }}>
    Search haircuts, facials, grooming and more
  </Body>
  <View style={{ alignItems: "center", justifyContent: "center", minHeight: 30 }}>
    <Badge label="explore" tone="primary" />
  </View>
        </Pressable>
      </View>

        <View style={{ marginTop: bp.isMobile ? 36 : 56 }}>
          <SectionHeading
            eyebrow="Curated categories"
            title={copy.categoriesTitle}
            subtitle={copy.categoriesSub}
            actionLabel="All services"
            onAction={() => app.go("Explore")}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: bp.isMobile ? 12 : 18 }}>
            {nextCategories.slice(0, 4).map((category) => (
              <CategoryTile key={category.name} category={category} />
            ))}
          </View>
        </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Signature services"
          title={copy.editTitle}
          subtitle={copy.editSub}
          actionLabel="View all treatments"
          onAction={() => app.go("Explore")}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 }}>
          {featuredServices.slice(0, 3).map((service) => (
            <View key={service.id} style={{ width: bp.isMobile ? "100%" : bp.isTablet ? "48.6%" : "32%" }}>
              <ServiceCard service={service} />
            </View>
          ))}
        </View>
      </View>

      {offer ? (
        <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
          <Card padded={false} style={{ overflow: "hidden" }}>
            <View style={{ flexDirection: bp.isMobile ? "column-reverse" : "row" }}>
              <View style={{ flex: 1, padding: bp.isMobile ? 22 : 34, justifyContent: "center" }}>
                <Badge label={offer.is_demo ? "demo offer" : "current offer"} tone="primary" icon="pricetag-outline" />
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                  <Display size={bp.isMobile ? 50 : 68} color={t.primary}>
                    {offer.discount_percent}%
                  </Display>
                  <Body size={13} weight="700" color={t.inkSoft}>
                    off one visit
                  </Body>
                </View>
                <Display size={bp.isMobile ? 27 : 34} style={{ marginTop: 6 }}>
                  {offer.title}
                </Display>
                <Body size={12.5} color={t.muted} style={{ marginTop: 8, maxWidth: 420 }}>
                  {offer.description}
                </Body>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 18 }}>
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
                  <Button title="Book with this offer" small onPress={() => app.startBookingWithOffer(offer.code)} icon="arrow-forward" />
                </View>
                <DemoNote>Offer eligibility is verified by the salon server at checkout.</DemoNote>
              </View>
              <Img
                uri={offerImage[section]}
                height={bp.isMobile ? 190 : 310}
                label="Offer image"
                radius={0}
                overlay="rgba(18, 10, 22, 0.16)"
                style={{ width: bp.isMobile ? "100%" : "42%" }}
              />
            </View>
          </Card>
        </View>
      ) : null}

      {campaigns.length ? (
        <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
          <SectionHeading
            eyebrow="Live campaigns"
            title={section === "men" ? "Atelier campaigns" : "Beauty campaigns"}
            subtitle="Published by the Naturals team and refreshed from the live CMS."
            actionLabel="See offers"
            onAction={() => app.go("Offers")}
          />
          <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 18 }}>
            {campaigns.slice(0, 3).map((campaign) => {
              const image = campaign.image_url
                ? buildImageUrl(campaign.image_url)
                : section === "men"
                  ? editorialImage.men
                  : editorialImage.women;
              return (
                <Card key={campaign.id} padded={false} style={{ flex: 1, overflow: "hidden" }}>
                  <Img uri={image} height={bp.isMobile ? 170 : 200} label={campaign.title} radius={0} overlay="rgba(12, 8, 16, 0.12)" />
                  <View style={{ padding: 18 }}>
                    <Badge label={campaign.audience === "Everyone" ? "all guests" : campaign.audience} tone="primary" />
                    <Display size={24} style={{ marginTop: 8 }}>{campaign.title}</Display>
                    {campaign.subtitle ? (
                      <Body size={11.5} weight="600" color={t.inkSoft} style={{ marginTop: 4 }}>{campaign.subtitle}</Body>
                    ) : null}
                    <Body size={12} color={t.muted} numberOfLines={3} style={{ marginTop: 6 }}>{campaign.description}</Body>
                    <Button title={campaign.cta_label || "Explore"} small kind="outline" onPress={() => handleCampaignAction(campaign)} icon="arrow-forward" style={{ marginTop: 12 }} />
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Studio discovery"
          title={copy.salonsTitle}
          subtitle={copy.salonsSub}
          actionLabel="All salons"
          onAction={() => app.go("Salons")}
        />
        <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 18 }}>
          {salons.slice(0, 2).map((salon, index) => (
            <SalonCard key={salon.id} salon={salon} index={index} />
          ))}
        </View>
      </View>

      {!bp.isMobile && (
        <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
          <SectionHeading
            eyebrow="The team"
            title={copy.teamTitle}
            subtitle={copy.teamSub}
            actionLabel="Book with the team"
            onAction={() => (selectedSalon ? app.startBookingAtSalon(selectedSalon) : app.startBooking())}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            {team.map((stylist) => (
              <StylistCard key={stylist.id} stylist={stylist} salonName={selectedSalon?.name ?? "Naturals"} />
            ))}
            {!team.length ? (
              <Card style={{ flex: 1, padding: 20 }}>
                <Body size={12} color={t.muted}>
                  Team profiles will appear once salon staff load from the API.
                </Body>
              </Card>
            ) : null}
          </View>
        </View>
      )}

      {!bp.isMobile && (
        <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
          <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: bp.isDesktop ? 34 : 20, alignItems: "stretch" }}>
            <Img
              uri={promiseImage[section]}
              height={bp.isMobile ? 260 : bp.isDesktop ? 440 : 320}
              label="Naturals salon detail"
              radius={30}
              overlay="rgba(16, 10, 20, 0.16)"
              style={{ width: bp.isDesktop ? "44%" : "100%" }}
            />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Eyebrow>The Naturals standard</Eyebrow>
              <Display size={bp.isMobile ? 32 : 44} style={{ marginTop: 9, maxWidth: 460 }}>
                {copy.promiseTitle}
              </Display>
              <Body size={13} color={t.muted} style={{ marginTop: 10, maxWidth: 480 }}>
                {copy.promiseSub}
              </Body>
              <View style={{ marginTop: 20, gap: 10 }}>
                {copy.promise.map((item) => (
                  <View
                    key={item.title}
                    style={{
                      flexDirection: "row",
                      gap: 14,
                      padding: 16,
                      borderRadius: radius.lg,
                      backgroundColor: t.surface,
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: t.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={item.icon} size={18} color={t.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body size={13} weight="700" color={t.ink}>
                        {item.title}
                      </Body>
                      <Body size={11.5} color={t.muted} style={{ marginTop: 3 }}>
                        {item.text}
                      </Body>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <View
          style={{
            backgroundColor: t.primary,
            borderRadius: bp.isMobile ? 26 : 34,
            padding: bp.isMobile ? 26 : 48,
            flexDirection: bp.isDesktop ? "row" : "column",
            alignItems: bp.isDesktop ? "center" : "flex-start",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <View style={{ flex: 1 }}>
            <Eyebrow color={t.primaryText} style={{ opacity: 0.72 }}>
              Book your next visit
            </Eyebrow>
            <Display size={bp.isMobile ? 38 : 52} color={t.primaryText} style={{ marginTop: 9 }}>
              {copy.ctaTitle}
            </Display>
            <Body size={13} color={t.primaryText} style={{ marginTop: 10, maxWidth: 460, opacity: 0.82 }}>
              {copy.ctaCopy}
            </Body>
          </View>
          <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 12, width: bp.isMobile ? "100%" : undefined }}>
            <Button title={copy.heroCta} onPress={() => app.startBooking()} kind="light" full={bp.isMobile} icon="arrow-forward" />
            <Button
              title={offer ? `Use ${offer.code}` : "See offers"}
              onPress={() => (offer ? app.startBookingWithOffer(offer.code) : app.go("Offers"))}
              kind="ghost"
              full={bp.isMobile}
            />
          </View>
        </View>
      </View>

      <View style={{ marginTop: bp.isMobile ? 32 : 48, marginBottom: bp.isMobile ? 6 : 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <Body size={10.5} color={t.muted} style={{ maxWidth: 560 }}>
              Branch names, addresses, PIN codes and phone numbers are from the official Naturals Tamil Nadu locator.
              Service descriptions, prices, stylists and offers are sample data and are not official Naturals information.
            </Body>
          <Body size={10.5} color={t.muted}>
            {text("site.footer.tagline", "Care that feels like you.")}
          </Body>
        </View>
      </View>
    </PageShell>
  );
}

type PromoDestination = "book" | "explore" | "offers" | "salons" | "campaign";

type PromoSlide = {
  image: ImageSourcePropType;
  fallbackImage?: ImageSourcePropType;
  eyebrow: string;
  title: string;
  copy: string;
  action: string;
  destination: PromoDestination;
  campaign?: Campaign;
};

function PromoSlideImage({
  source,
  fallback,
  label,
}: {
  source: ImageSourcePropType;
  fallback: ImageSourcePropType;
  label: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [source]);

  return (
    <Image
      source={failed ? fallback : source}
      resizeMode="cover"
      accessibilityLabel={label}
      onError={() => {
        if (!failed) setFailed(true);
      }}
      style={{ position: "absolute", width: "100%", height: "100%" }}
    />
  );
}

function PromoCarousel({
  section,
  heroUri,
  campaigns,
  onBook,
  onExplore,
  onOffers,
  onSalons,
  onCampaignAction,
  active,
}: {
  section: "men" | "women";
  heroUri: string;
  campaigns: Campaign[];
  onBook: () => void;
  onExplore: () => void;
  onOffers: () => void;
  onSalons: () => void;
  onCampaignAction: (campaign: Campaign) => void;
  active: boolean;
}) {
  const { t, bp } = useNaturals();
  const { width } = useWindowDimensions();
  const now = todayString();

  // Filter to only active campaigns within their scheduled date range.
  const activeCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (!c.is_active) return false;
      if (c.start_date && c.start_date > now) return false;
      if (c.end_date && c.end_date < now) return false;
      return true;
    });
  }, [campaigns, now]);

  const slides = useMemo(() => {
    const fallback: PromoSlide[] =
      section === "men"
        ? [
            { image: { uri: heroUri }, fallbackImage: promoImages.menBarber, eyebrow: "NATURALS MEN · GROOMING", title: "Good grooming. No rush.", copy: "Precision cuts, beard-friendly grooming and restorative treatments.", action: "Book now", destination: "book" },
            { image: promoImages.menGrooming, eyebrow: "MEN'S GROOMING", title: "Precision cuts & beard care.", copy: "Clean lines and a considered finish, without rushing the chair time.", action: "Explore services", destination: "explore" },
            { image: promoImages.menCut, eyebrow: "HAIRCUTS", title: "Sharp cuts, every time.", copy: "Book a haircut with our experienced barbers.", action: "Book now", destination: "book" },
            { image: promoImages.menBarber, eyebrow: "THE GROOMING EDIT", title: "Make time for yourself.", copy: "Find a service and a time that fits your day.", action: "View packages", destination: "offers" },
            { image: promoImages.menGrooming, eyebrow: "YOUR NEXT VISIT", title: "A better kind of reset.", copy: "Choose your branch and book a salon visit when you're ready.", action: "Find a branch", destination: "salons" },
            { image: promoImages.spa, eyebrow: "MEN'S SPA", title: "Restorative treatments.", copy: "Deep, considered care for skin and body.", action: "Book now", destination: "book" },
          ]
        : [
            { image: { uri: heroUri }, fallbackImage: promoImages.womenHair, eyebrow: "NATURALS WOMEN · BEAUTY", title: "A little time, just for you.", copy: "Thoughtful hair, skin and bridal rituals in a light, unhurried setting.", action: "Book now", destination: "book" },
            { image: promoImages.womenHair, eyebrow: "HAIRCUTS & STYLING", title: "Hair that feels like you.", copy: "From classic cuts to modern styles, tailored to your look.", action: "Book now", destination: "book" },
            { image: promoImages.hairColour, eyebrow: "HAIR COLOUR", title: "Colour that complements you.", copy: "Professional colour services for every shade and tone.", action: "Book now", destination: "book" },
            { image: promoImages.skincare, eyebrow: "SKINCARE", title: "Radiant skin, naturally.", copy: "Facials and skin treatments that restore your glow.", action: "Book now", destination: "book" },
            { image: promoImages.bridal, eyebrow: "BRIDAL MAKEUP", title: "Your special day, perfected.", copy: "Bridal beauty packages for the most important day.", action: "View packages", destination: "offers" },
            { image: promoImages.womenMakeup, eyebrow: "THE BEAUTY EDIT", title: "Find your own rhythm.", copy: "Explore treatments and choose a visit that works for you.", action: "Explore services", destination: "explore" },
            { image: promoImages.spa, eyebrow: "SPA TREATMENTS", title: "Care that feels considered.", copy: "From the first question to the final finish, every detail is handled.", action: "Book now", destination: "book" },
            { image: promoImages.womenHair, eyebrow: "YOUR NEXT VISIT", title: "Make room for a reset.", copy: "Find a branch and book your next salon appointment.", action: "Find a branch", destination: "salons" },
          ];
    if (!activeCampaigns.length) return fallback;
    return activeCampaigns.map((campaign, index) => {
      const defaultSlide = fallback[index % fallback.length];
      const defaultImage = defaultSlide.image;
      return {
        image: campaign.image_url ? { uri: buildImageUrl(campaign.image_url) } : defaultImage,
        fallbackImage: defaultSlide.fallbackImage ?? defaultImage,
        eyebrow: (campaign.subtitle || "Naturals campaign").toUpperCase(),
        title: campaign.title,
        copy: campaign.description,
        action: campaign.cta_label || "Explore",
        destination: "campaign" as const,
        campaign,
      };
    });
  }, [activeCampaigns, section, heroUri]);

  const count = slides.length;
  const total = count + 2;
  // Duplicate the first and last slides so the loop is visually seamless when
  // wrapping from the last slide back to the first (and vice-versa).
  const loopSlides = count > 1 ? [slides[count - 1], ...slides, slides[0]] : slides;
  // Start with a safe fallback width so the carousel is never rendered with 0-width
  // slides (which would make it invisible and break auto-transition). The real
  // width is measured via onLayout below.
  const safeWidth = Math.max(width || 375, 1);
  const [slideW, setSlideW] = useState(safeWidth);

  const handleLayout = (event: LayoutChangeEvent) => {
    const measured = Math.max(event.nativeEvent.layout.width, 1);
    if (measured !== slideW) {
      setSlideW(measured);
      // Re-base the translate offset on measured width so the active slide stays
      // in place without animating or jumping.
      offset.setValue(-positionRef.current * measured);
    }
  };

  const [position, setPosition] = useState(count > 1 ? 1 : 0);
  const positionRef = useRef(count > 1 ? 1 : 0);
  const [interacting, setInteracting] = useState(false);
  const [chevronHover, setChevronHover] = useState<"prev" | "next" | null>(null);
  const offset = useRef(new Animated.Value(-safeWidth)).current;
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animSeq = useRef(0);

  useEffect(() => {
    // Keep slideW in sync with window dimensions (e.g. browser resize).
    const nextW = Math.max(width || 375, 1);
    if (nextW !== slideW) {
      setSlideW(nextW);
      offset.setValue(-positionRef.current * nextW);
    }
  }, [width, slideW, offset]);

  useEffect(() => {
    const firstPosition = count > 1 ? 1 : 0;
    offset.stopAnimation();
    positionRef.current = firstPosition;
    setPosition(firstPosition);
    animSeq.current += 1;
    offset.setValue(-firstPosition * slideW);
  }, [count, offset]);

  const realIndex = () => {
    if (count <= 1) return 0;
    if (position === 0) return count - 1;
    if (position === total - 1) return 0;
    return position - 1;
  };

  const currentX = () => -positionRef.current * slideW;

  const snapToReal = () => {
    const p = positionRef.current;
    if (count <= 1) return;
    if (p === 0) {
      positionRef.current = count;
      setPosition(count);
      offset.setValue(-count * slideW);
    } else if (p === total - 1) {
      positionRef.current = 1;
      setPosition(1);
      offset.setValue(-slideW);
    }
  };

  const goTo = (next: number) => {
    if (count <= 1) return;
    let p = Math.max(0, Math.min(total - 1, next));
    positionRef.current = p;
    setPosition(p);
    const seq = ++animSeq.current;
    Animated.timing(offset, {
      toValue: -p * slideW,
      duration: 550,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (seq !== animSeq.current || !finished) return;
      if (p === 0 || p === total - 1) snapToReal();
    });
  };

  const nextSlide = () => goTo(positionRef.current + 1);
  const prevSlide = () => goTo(positionRef.current - 1);
  const pauseAutoplay = () => {
    setInteracting(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      setInteracting(false);
    }, 4500);
  };

  // Automatic sliding every 4.5 seconds, paused while the user interacts and
  // whenever Home is not the visible tab (keep-alive screens stay mounted, so
  // without this guard the timer would keep running in the background).
  useEffect(() => {
    if (!active || interacting || count < 2) return;
    const timer = setInterval(() => nextSlide(), 4500);
    return () => clearInterval(timer);
  }, [active, interacting, count, slideW]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          setInteracting(true);
          if (resumeTimer.current) clearTimeout(resumeTimer.current);
          offset.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          offset.setValue(currentX() + gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          const threshold = slideW * 0.35;
          if (Math.abs(gesture.dx) > threshold) {
            goTo(positionRef.current + (gesture.dx < 0 ? 1 : -1));
          } else {
            Animated.timing(offset, { toValue: currentX(), duration: 300, useNativeDriver: Platform.OS !== "web" }).start();
          }
          setInteracting(false);
        },
        onPanResponderTerminate: () => {
          Animated.timing(offset, { toValue: currentX(), duration: 300, useNativeDriver: Platform.OS !== "web" }).start();
          setInteracting(false);
        },
      }),
    [count, slideW],
  );

  const chevronFill = section === "men" ? "rgba(255, 255, 255, 0.28)" : "rgba(0, 0, 0, 0.30)";
  const chevronInk = section === "men" ? t.primary : "#FFFFFF";
  const chevron = (dir: "prev" | "next") => {
    const active = chevronHover === dir;
    return (
      <Pressable
        key={dir}
        accessibilityRole="button"
        accessibilityLabel={dir === "prev" ? "Previous slide" : "Next slide"}
        onPress={() => {
          pauseAutoplay();
          (dir === "prev" ? prevSlide : nextSlide)();
        }}
        onHoverIn={() => setChevronHover(dir)}
        onHoverOut={() => setChevronHover(null)}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [dir === "prev" ? "left" : "right"]: 0,
          width: 64,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chevronFill,
          opacity: active ? 0.95 : 0.5,
        }}
      >
        <Ionicons name={dir === "prev" ? "chevron-back-outline" : "chevron-forward-outline"} size={26} color={chevronInk} />
      </Pressable>
    );
  };

  return (
    <View
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      accessibilityLabel={`Promotional carousel, slide ${realIndex() + 1} of ${count}`}
      style={{ position: "relative", height: bp.isMobile ? 300 : bp.isTablet ? 360 : 390, borderRadius: bp.isMobile ? 23 : 30, overflow: "hidden", backgroundColor: t.surfaceAlt }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          width: loopSlides.length * slideW,
          height: "100%",
          transform: [{ translateX: offset }],
        }}
      >
        {loopSlides.map((item, index) => (
          <View key={index} style={{ width: slideW, height: "100%", flexShrink: 0 }}>
            <PromoSlideImage
              source={item.image}
              fallback={item.fallbackImage ?? item.image}
              label={`${item.eyebrow} promotional image`}
            />
            <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: section === "men" ? "rgba(5, 7, 11, 0.28)" : "rgba(37, 20, 45, 0.22)" }} />
            <View
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                justifyContent: "center",
                alignItems: "flex-start",
                padding: bp.isMobile ? 23 : 42,
                paddingBottom: bp.isMobile ? 50 : 56,
              }}
            >
              <Eyebrow
                color={section === "men" ? "#E6D3A9" : "#F2DFFF"}
                style={{ maxWidth: bp.isMobile ? "84%" : 520 }}
              >
                {item.eyebrow}
              </Eyebrow>
              <Display
                size={bp.isMobile ? 34 : 48}
                color="#FFFFFF"
                style={{ maxWidth: bp.isMobile ? "84%" : 560, marginTop: 9 }}
              >
                {item.title}
              </Display>
              <Body
                size={bp.isMobile ? 12 : 13.5}
                color="#F6F2F7"
                style={{ maxWidth: bp.isMobile ? "84%" : 450, marginTop: 8 }}
              >
                {item.copy}
              </Body>
              <Button
                title={item.action}
                small
                kind="light"
                onPress={() => {
                  if (item.destination === "campaign" && item.campaign) return onCampaignAction(item.campaign);
                  if (item.destination === "book") return onBook();
                  if (item.destination === "offers") return onOffers();
                  if (item.destination === "salons") return onSalons();
                  onExplore();
                }}
                icon="arrow-forward"
                style={{ marginTop: 16 }}
              />
            </View>
            <View style={{ position: "absolute", top: 15, right: 15, paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: section === "men" ? "rgba(13, 12, 18, 0.75)" : "rgba(36, 27, 45, 0.75)", borderWidth: 1, borderColor: section === "men" ? "rgba(201, 168, 106, 0.45)" : "rgba(91, 42, 131, 0.45)", minWidth: 110, justifyContent: "center", overflow: "hidden" }}>
              <Body size={8} weight="700" color="#FFFFFF" numberOfLines={1} style={{ letterSpacing: 0.4, textShadowColor: "#000000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{section === "men" ? "MEN'S ATELIER" : "WOMEN'S SALON"}</Body>
            </View>
          </View>
        ))}
        </Animated.View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 12, zIndex: 5, flexDirection: "row", gap: 8, justifyContent: "center" }}>
        {slides.map((_, index) => {
          const active = realIndex() === index;
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Show slide ${index + 1}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                pauseAutoplay();
                goTo(index + 1);
              }}
              hitSlop={8}
              style={{
                width: active ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: active ? (section === "men" ? t.primary : "#FFFFFF") : "rgba(255,255,255,0.5)",
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TrustItem({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  const { t, bp } = useNaturals();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: bp.isMobile ? 1 : 1,
        minWidth: bp.isMobile ? "48%" : 0,
        paddingHorizontal: bp.isMobile ? 6 : 18,
        paddingVertical: bp.isMobile ? 8 : 2,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.primarySoft,
        }}
      >
        <Ionicons name={icon} size={15} color={t.primary} />
      </View>
      <View>
        <Body size={11.5} weight="700" color={t.ink}>
          {value}
        </Body>
        <Body size={9.5} color={t.muted}>
          {label}
        </Body>
      </View>
    </View>
  );
}

export { timeLabel };
