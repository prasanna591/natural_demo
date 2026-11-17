import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Linking, Pressable, View } from "react-native";
import { useNaturals } from "../context";
import { PageShell } from "../layout";
import { radius } from "../theme";
import { Badge, Body, Button, Card, DemoNote, Display, Divider, Eyebrow, SectionHeading } from "../ui";

type IconName = keyof typeof Ionicons.glyphMap;
type BadgeTone = "muted" | "primary" | "success" | "danger" | "outline";

const FACTS: { icon: IconName; label: string; value: string }[] = [
  { icon: "calendar-outline", label: "Founded", value: "2000" },
  { icon: "person-outline", label: "Founder", value: "K. Veena" },
  { icon: "people-outline", label: "Co-founder", value: "C.K. Kumaravel" },
  { icon: "location-outline", label: "Headquarters", value: "Chennai, Tamil Nadu" },
  { icon: "storefront-outline", label: "Salon network", value: "1,000+ outlets claimed for 2026" },
  { icon: "trending-up-outline", label: "Expansion target", value: "3,000 salons by 2029" },
];

const SERVICE_GROUPS: { title: string; icon: IconName; intro: string; items: string[] }[] = [
  {
    title: "Women",
    icon: "flower-outline",
    intro: "Hair, skin, body and occasion-led beauty care.",
    items: [
      "Haircuts, layers, feather cuts and styling",
      "Global colour, highlights, balayage and root touch-up",
      "Hair spa, keratin, hair Botox, smoothening and straightening",
      "Facials, clean-ups, de-tan, face masks and waxing",
      "Threading, manicure, pedicure and body treatments",
    ],
  },
  {
    title: "Men",
    icon: "cut-outline",
    intro: "Precision grooming, hair care and skin maintenance.",
    items: [
      "Haircuts, hairstyling and head massage",
      "Beard trimming, shaving and hair colouring",
      "Hair spa, straightening, smoothening and keratin",
      "Men's facials, clean-ups and de-tan",
      "Manicure, pedicure and body care",
    ],
  },
  {
    title: "Bridal & pre-wedding",
    icon: "sparkles-outline",
    intro: "Makeup, styling and preparation for the wedding season.",
    items: [
      "Bridal, reception and engagement makeup",
      "Bridal hairstyling and saree draping",
      "Pre-bridal facials and skin brightening",
      "Hair spa and hair treatments",
      "Body polishing and groom grooming",
    ],
  },
  {
    title: "Hair, skin & body",
    icon: "leaf-outline",
    intro: "The core treatment families behind the service menu.",
    items: [
      "Hair: wash, cut, colour, spa, keratin and scalp care",
      "Skin: fruit, black, deep-cleansing, hydrating and anti-ageing facials",
      "De-tan, masks, clean-ups and luxury facial rituals",
      "Body: massage, scrubs, detox, wraps and reflexology",
      "Waxing, peel-off treatments, threading and skin brightening",
    ],
  },
];

const CARDS: {
  name: string;
  icon: IconName;
  status: string;
  tone: BadgeTone;
  detail: string;
}[] = [
  {
    name: "Membership card",
    icon: "card-outline",
    status: "₹100 published at one branch",
    tone: "primary",
    detail:
      "Naturals publishes member prices for selected services. A Bharathi Salai branch FAQ lists a ₹100 membership card, but that is one branch-specific example — not confirmation of a single nationwide fee.",
  },
  {
    name: "Diamond Card",
    icon: "diamond-outline",
    status: "No nationwide price published",
    tone: "outline",
    detail:
      "Recognised in Naturals' terms as a prepaid or membership card. Terms cover activation after payment, fixed validity, redemption at eligible salons and non-transferability. A reliable current price and complete benefit table are not publicly established.",
  },
  {
    name: "Universal Card",
    icon: "albums-outline",
    status: "No nationwide price published",
    tone: "outline",
    detail:
      "Also named in the terms as part of the prepaid membership/card range. Activation follows payment, validity is fixed, redemption follows applicable branch pricing, and schemes generally cannot be combined unless permitted.",
  },
  {
    name: "Prepaid packages",
    icon: "wallet-outline",
    status: "Terms only",
    tone: "outline",
    detail:
      "Prepaid service-value packages are activated after payment confirmation, issued digitally and subject to expiry. Activated packages are described as non-refundable. Denominations are not published in a verified nationwide list.",
  },
  {
    name: "Gift vouchers",
    icon: "gift-outline",
    status: "Conditions apply",
    tone: "outline",
    detail:
      "Naturals also supports gift and promotional vouchers. Each voucher carries its own eligibility, validity and redemption conditions.",
  },
];

const MEMBER_PRICES: { service: string; regular: string; member: string }[] = [
  { service: "Classic haircut", regular: "₹450", member: "₹400" },
  { service: "Root touch-up", regular: "₹1,000", member: "₹900" },
  { service: "Shave", regular: "₹120", member: "₹100" },
  { service: "Beard trim", regular: "₹180", member: "₹150" },
  { service: "Moisturising hair spa", regular: "₹800–₹900", member: "₹700–₹800" },
  { service: "Fruit facial", regular: "₹900", member: "₹800" },
  { service: "Face clean-up", regular: "₹700", member: "₹600" },
  { service: "Face and neck de-tan", regular: "₹450", member: "₹400" },
  { service: "Black facial", regular: "₹1,700", member: "₹1,500" },
  { service: "Cocoa butter manicure", regular: "₹450", member: "₹400" },
];

const PUBLISHED_OFFERS: { name: string; validity: string }[] = [
  { name: "Customer First Voucher", validity: "Displayed until 28 February 2027" },
  { name: "More beauty. More value", validity: "Displayed until 31 December 2026" },
  { name: "Customer First Offer by Naturals Salon", validity: "Displayed until 28 February 2027" },
];

const NEWS: { date: string; title: string; detail: string }[] = [
  {
    date: "September 2026",
    title: "Naturals NXT opens in Pune",
    detail: "An AI-assisted salon concept at Amanora Mall, pairing consultations and recommendations with professional stylists.",
  },
  {
    date: "2026",
    title: "1,000-salon milestone",
    detail: "Naturals announced crossing 1,000 salons, with a stated ambition of 3,000 salons and 50,000 jobs by 2029.",
  },
  {
    date: "Recent",
    title: "NXTFACE skincare launch",
    detail: "A direct-to-consumer skincare range spanning serums, sunscreens, lip balms, day creams and cleansers.",
  },
  {
    date: "Reported November 2025",
    title: "Home beauty services pilot",
    detail: "A Bengaluru trial focused initially on skincare. Reported as a pilot, not proof of nationwide availability.",
  },
  {
    date: "2025",
    title: "Franchise and industry recognition",
    detail: "Best Franchisor recognition, plus speaking and icon honours for C.K. Kumaravel at Chennai business events.",
  },
  {
    date: "Ongoing",
    title: "Naturals Beauty Academy",
    detail: "Beauty training and skill-development initiatives, alongside women entrepreneurship programmes.",
  },
];

const FRANCHISE_SUPPORT = [
  "Naturals brand identity and business setup guidance",
  "Location selection and salon setup support",
  "Professional salon and beauty training",
  "Digital marketing and PR support",
  "Ongoing operations and IT/POS billing support",
  "Product-line training for salon teams",
];

const LIVE_DATA = [
  "Branch addresses, hours and bookable staff",
  "Service catalogue, durations and availability",
  "Active offers and server-validated discount codes",
  "Branch-specific price overrides used at checkout",
];

const REFERENCE_DATA = [
  "Company history, network claims and 2029 targets",
  "Membership and prepaid card conditions",
  "Published member-price examples",
  "Published offer names, news, franchise and contact details",
];

export function AboutScreen() {
  const { t, bp, go, setError } = useNaturals();

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This link could not be opened on this device.");
    }
  };

  return (
    <PageShell>
      <View style={{ paddingTop: bp.isMobile ? 24 : 44 }}>
        <View
          style={{
            flexDirection: bp.isDesktop ? "row" : "column",
            justifyContent: "space-between",
            alignItems: bp.isDesktop ? "flex-end" : "flex-start",
            gap: 18,
          }}
        >
          <View style={{ maxWidth: 680 }}>
            <Eyebrow>About Naturals</Eyebrow>
            <Display size={bp.isMobile ? 38 : 52} style={{ marginTop: 10 }}>
              More than a salon.
            </Display>
            <Body size={13.5} color={t.muted} style={{ marginTop: 12, maxWidth: 620 }}>
              Naturals is an Indian unisex salon and beauty-care chain founded in Chennai in 2000. This page gathers
              published company, membership, franchise and contact information for reference. Booking data stays live in
              the rest of the app.
            </Body>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label="since 2000" tone="primary" icon="ribbon-outline" />
            <Badge label="Chennai-born" tone="outline" icon="location-outline" />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 26 }}>
          {FACTS.map((fact) => (
            <Card key={fact.label} style={{ flex: 1, minWidth: bp.isMobile ? "47%" : 170 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name={fact.icon} size={15} color={t.primary} />
                <Body size={9.5} weight="700" color={t.muted} style={{ letterSpacing: 1, textTransform: "uppercase" }}>
                  {fact.label}
                </Body>
              </View>
              <Body size={13} weight="700" color={t.ink} style={{ marginTop: 7 }}>
                {fact.value}
              </Body>
            </Card>
          ))}
        </View>

        <Card style={{ marginTop: 16, backgroundColor: t.surfaceAlt }}>
          <Body size={12} color={t.inkSoft}>
            The company started with its first salon in Chennai and grew into a company- and franchise-operated network
            spanning beauty services, training, products and franchise partnerships. The stated 2029 ambitions also include
            1,000+ women entrepreneurs and technology-enabled salon experiences.
          </Body>
        </Card>
      </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="What Naturals does"
          title="A broad service menu."
          subtitle="Published service families from the Naturals website. The bookable catalogue in this app remains the authoritative list of what can be reserved right now."
          actionLabel="Browse services"
          onAction={() => go("Explore")}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {SERVICE_GROUPS.map((group) => (
            <Card key={group.title} style={{ flex: 1, minWidth: bp.isMobile ? "100%" : 280 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: t.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={group.icon} size={16} color={t.primary} />
                </View>
                <Display size={24}>{group.title}</Display>
              </View>
              <Body size={11.5} color={t.muted} style={{ marginTop: 8 }}>
                {group.intro}
              </Body>
              <View style={{ gap: 7, marginTop: 12 }}>
                {group.items.map((item) => (
                  <View key={item} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Ionicons name="ellipse" size={5} color={t.primary} style={{ marginTop: 7 }} />
                    <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>
                      {item}
                    </Body>
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Membership & prepaid cards"
          title="Know what is published."
          subtitle="Naturals' terms recognise several prepaid and membership products. Where a nationwide denomination is not public, this page says so instead of guessing."
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {CARDS.map((card) => (
            <Card key={card.name} style={{ flex: 1, minWidth: bp.isMobile ? "100%" : 280 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Ionicons name={card.icon} size={17} color={t.primary} />
                <Display size={23}>{card.name}</Display>
              </View>
              <View style={{ marginTop: 9 }}>
                <Badge label={card.status} tone={card.tone} />
              </View>
              <Body size={11.5} color={t.muted} style={{ marginTop: 10 }}>
                {card.detail}
              </Body>
            </Card>
          ))}
        </View>

        <Card style={{ marginTop: 16 }}>
          <View
            style={{
              flexDirection: bp.isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: bp.isMobile ? "flex-start" : "center",
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Display size={24}>Published member-price examples</Display>
              <Body size={11} color={t.muted} style={{ marginTop: 5 }}>
                Selected service pages show a regular and a member price. These are published examples, not this app's
                checkout rates or a guarantee for every branch.
              </Body>
            </View>
            <Badge label="reference only" tone="outline" icon="document-text-outline" />
          </View>
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <Body size={9.5} weight="700" color={t.muted} style={{ flex: 1, letterSpacing: 1, textTransform: "uppercase" }}>
                Service
              </Body>
              <Body size={9.5} weight="700" color={t.muted} style={{ width: 92, textAlign: "right", letterSpacing: 1, textTransform: "uppercase" }}>
                Regular
              </Body>
              <Body size={9.5} weight="700" color={t.muted} style={{ width: 92, textAlign: "right", letterSpacing: 1, textTransform: "uppercase" }}>
                Member
              </Body>
            </View>
            {MEMBER_PRICES.map((row, index) => (
              <View
                key={row.service}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 9,
                  borderBottomWidth: index === MEMBER_PRICES.length - 1 ? 0 : 1,
                  borderBottomColor: t.border,
                }}
              >
                <Body size={11.5} color={t.ink} style={{ flex: 1 }}>
                  {row.service}
                </Body>
                <Body size={11.5} color={t.muted} style={{ width: 92, textAlign: "right" }}>
                  {row.regular}
                </Body>
                <Body size={11.5} weight="700" color={t.primary} style={{ width: 92, textAlign: "right" }}>
                  {row.member}
                </Body>
              </View>
            ))}
          </View>
          <Body size={10.5} color={t.muted} style={{ marginTop: 12 }}>
            Branch pricing can differ by city, salon format, hair length, product and membership. Confirm the branch
            quotation before booking.
          </Body>
        </Card>
      </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Published promotions"
          title="Offers worth checking."
          subtitle="Offer names and validity dates displayed on Naturals branch pages. They are not the active offers in this app, and the monetary benefit of each needs to be checked in its own terms."
          actionLabel="See live offers"
          onAction={() => go("Offers")}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {PUBLISHED_OFFERS.map((offer, index) => (
            <Card key={offer.name} style={{ flex: 1, minWidth: bp.isMobile ? "100%" : 230 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Badge label={`reference ${index + 1}`} tone="outline" />
                <Ionicons name="pricetag-outline" size={16} color={t.primary} />
              </View>
              <Display size={23} style={{ marginTop: 10 }}>
                {offer.name}
              </Display>
              <Body size={11.5} color={t.muted} style={{ marginTop: 7 }}>
                {offer.validity}
              </Body>
            </Card>
          ))}
        </View>
        <Card style={{ marginTop: 14, backgroundColor: t.surfaceAlt }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Ionicons name="information-circle-outline" size={17} color={t.primary} style={{ marginTop: 1 }} />
            <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>
              The two “Customer First” entries published across branch pages are treated here as the same reference offer,
              not four separate discounts. Only offers returned by this app's backend can be applied at checkout.
            </Body>
          </View>
        </Card>
      </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Company news"
          title="What has changed lately."
          subtitle="Published announcements from Naturals and independent reporting. Availability can differ by city and is not managed by this demo."
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {NEWS.map((item) => (
            <Card key={item.title} style={{ flex: 1, minWidth: bp.isMobile ? "100%" : 280 }}>
              <Body size={9.5} weight="700" color={t.primary} style={{ letterSpacing: 1, textTransform: "uppercase" }}>
                {item.date}
              </Body>
              <Display size={23} style={{ marginTop: 7 }}>
                {item.title}
              </Display>
              <Body size={11.5} color={t.muted} style={{ marginTop: 7 }}>
                {item.detail}
              </Body>
            </Card>
          ))}
        </View>
      </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Franchise"
          title="A business, not just a chair."
          subtitle="Published franchise information. These figures are estimates and are not a guaranteed return or a live quotation from this app."
        />
        <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 14 }}>
          <Card style={{ flex: 1 }}>
            <Display size={24}>Investment at a glance</Display>
            <View style={{ gap: 12, marginTop: 14 }}>
              <StatRow icon="cash-outline" label="Starting investment" value="₹50 lakh" />
              <StatRow icon="trending-up-outline" label="Indicative payback" value="24–36 or 36–48 months" />
              <StatRow icon="business-outline" label="Loan assistance advertised" value="Up to ₹40 lakh" />
            </View>
            <Body size={10.5} color={t.muted} style={{ marginTop: 14 }}>
              Naturals' terms cite 24–36 months, while its franchise page cites 36–48 months. The two figures conflict.
              Actual investment and profitability depend on location, rent, interiors, staffing, sales and operating costs.
            </Body>
          </Card>
          <Card style={{ flex: 1 }}>
            <Display size={24}>Franchise support</Display>
            <View style={{ gap: 8, marginTop: 14 }}>
              {FRANCHISE_SUPPORT.map((item) => (
                <View key={item} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={14} color={t.primary} style={{ marginTop: 2 }} />
                  <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>
                    {item}
                  </Body>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Contact"
          title="Reach the company."
          subtitle="Published contact details for Naturals Salon Private Limited. For a specific visit, use the phone number on the branch page instead."
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Card style={{ flex: 1, minWidth: bp.isMobile ? "100%" : 320 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Ionicons name="business-outline" size={17} color={t.primary} />
              <Display size={23}>Registered office</Display>
            </View>
            <Body size={11.5} color={t.muted} style={{ marginTop: 9 }}>
              No. 10, Anna Enclave, Injambakkam, Chennai, Tamil Nadu 600041.
            </Body>
            <Divider style={{ marginVertical: 14 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Ionicons name="business-outline" size={17} color={t.primary} />
              <Display size={23}>Corporate office</Display>
            </View>
            <Body size={11.5} color={t.muted} style={{ marginTop: 9 }}>
              3rd Floor, Ispahani Centre, 123 &amp; 124, Nungambakkam High Road, Thousand Lights, Chennai, Tamil Nadu
              600034.
            </Body>
          </Card>
          <Card style={{ flex: 1, minWidth: bp.isMobile ? "100%" : 320 }}>
            <Display size={23}>Customer & business enquiries</Display>
            <View style={{ gap: 4, marginTop: 10 }}>
              <ContactRow icon="logo-whatsapp" label="Customer WhatsApp" value="+91 90926 26262" onPress={() => open("https://wa.me/919092626262")} />
              <ContactRow icon="mail-outline" label="Customer care" value="care@naturals.in" onPress={() => open("mailto:care@naturals.in")} />
              <ContactRow icon="briefcase-outline" label="Franchise enquiries" value="franchise@naturals.in" onPress={() => open("mailto:franchise@naturals.in")} />
              <ContactRow icon="call-outline" label="Franchise telephone" value="7358140268" onPress={() => open("tel:+917358140268")} />
              <ContactRow icon="people-outline" label="Careers" value="jobs@naturals.in" onPress={() => open("mailto:jobs@naturals.in")} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 14 }}>
              <Button title="naturals.in" small kind="outline" icon="open-outline" onPress={() => open("https://naturals.in/")} />
              <Button title="Salon locator" small kind="ghost" icon="location-outline" onPress={() => open("https://salons.naturals.in/")} />
            </View>
          </Card>
        </View>
      </View>

      <View style={{ marginTop: bp.isMobile ? 46 : 68 }}>
        <SectionHeading
          eyebrow="Data policy"
          title="Live data vs reference."
          subtitle="A clear split between what this demo stores and what was published on the Naturals website."
        />
        <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 14 }}>
          <Card style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Ionicons name="server-outline" size={17} color={t.primary} />
              <Display size={23}>From this app's backend</Display>
            </View>
            <View style={{ gap: 8, marginTop: 12 }}>
              {LIVE_DATA.map((item) => (
                <View key={item} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={14} color={t.success} style={{ marginTop: 2 }} />
                  <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>
                    {item}
                  </Body>
                </View>
              ))}
            </View>
          </Card>
          <Card style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Ionicons name="document-text-outline" size={17} color={t.primary} />
              <Display size={23}>Published reference</Display>
            </View>
            <View style={{ gap: 8, marginTop: 12 }}>
              {REFERENCE_DATA.map((item) => (
                <View key={item} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Ionicons name="ellipse" size={5} color={t.primary} style={{ marginTop: 7 }} />
                  <Body size={11.5} color={t.inkSoft} style={{ flex: 1 }}>
                    {item}
                  </Body>
                </View>
              ))}
            </View>
          </Card>
        </View>

        <Card style={{ marginTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Ionicons name="shield-checkmark-outline" size={18} color={t.primary} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Display size={23}>What this page does not claim</Display>
              <Body size={11.5} color={t.muted} style={{ marginTop: 7 }}>
                No nationwide Diamond Card, Universal Card or prepaid package denomination is invented here. No membership
                balance, card purchase, guaranteed franchise return or live Naturals booking is provided by this demo.
                Company facts, published prices, news and contacts were compiled from naturals.in, salons.naturals.in and
                cited reporting, with research dated 31 October 2026.
              </Body>
            </View>
          </View>
        </Card>

        <DemoNote center>
          This screen is static reference content. It does not call a Naturals API or change this app's backend, pricing
          rules or booking records.
        </DemoNote>
      </View>
    </PageShell>
  );
}

function StatRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Ionicons name={icon} size={15} color={t.primary} />
      <Body size={11} color={t.muted} style={{ flex: 1 }}>
        {label}
      </Body>
      <Body size={11.5} weight="700" color={t.ink} style={{ textAlign: "right" }}>
        {value}
      </Body>
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { t } = useNaturals();
  const [hover, setHover] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 42,
        paddingHorizontal: 8,
        marginHorizontal: -8,
        borderRadius: radius.sm,
        backgroundColor: hover ? t.primarySoft : "transparent",
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.surfaceAlt,
        }}
      >
        <Ionicons name={icon} size={14} color={t.primary} />
      </View>
      <Body size={10.5} color={t.muted} style={{ flex: 1 }}>
        {label}
      </Body>
      <Body size={11.5} weight="700" color={hover ? t.primary : t.ink}>
        {value}
      </Body>
    </Pressable>
  );
}
