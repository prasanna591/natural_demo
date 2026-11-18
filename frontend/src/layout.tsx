import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { initials, type Salon, type Tab } from "./api";
import { useNaturals } from "./context";
import { fonts, radius, spacing, type Section } from "./theme";
import { Body, BrandMark, Button, Divider, Display, Eyebrow, IconButton } from "./ui";

const NAV: { tab: Tab; label: string }[] = [
  { tab: "Home", label: "Home" },
  { tab: "Explore", label: "Services" },
  { tab: "Bookings", label: "Bookings" },
  { tab: "Salons", label: "Branches" },
  { tab: "Reviews", label: "Reviews" },
  { tab: "Profile", label: "Profile" },
];

/** Compact title shown beside the back arrow on narrow screens. */
function screenTitle(tab: Tab) {
  const titles: Record<Tab, string> = {
    Home: "Home",
    Explore: "Services",
    Salons: "Branches",
    Bookings: "Bookings",
    Offers: "Offers",
    Profile: "Profile",
    About: "About",
    Admin: "Admin",
    Reviews: "Reviews",
    TryOn: "Try-On",
  };
  return titles[tab] ?? "Naturals";
}

export function SectionSwitch({ compact = false }: { compact?: boolean }) {
  const { t, section, switchSection } = useNaturals();
  const options: { key: Section; label: string }[] = [
    { key: "women", label: "Women" },
    { key: "men", label: "Men" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 4,
        borderRadius: radius.pill,
        backgroundColor: t.surfaceAlt,
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      {options.map((option) => {
        const active = section === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Browse Naturals ${option.label}`}
            onPress={() => switchSection(option.key)}
            hitSlop={4}
            style={{
              minHeight: 40,
              paddingHorizontal: compact ? 10 : 17,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? t.primary : "transparent",
            }}
          >
            <Body
              size={compact ? 10.5 : 11.5}
              weight="700"
              color={active ? t.primaryText : t.muted}
              style={{ letterSpacing: 0.4 }}
            >
              {option.label}
            </Body>
          </Pressable>
        );
      })}
    </View>
  );
}

function NavLink({ item }: { item: { tab: Tab; label: string } }) {
  const { t, tab, go } = useNaturals();
  const [hover, setHover] = useState(false);
  const active = tab === item.tab;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={() => go(item.tab)}
      style={{
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: 2,
        borderBottomWidth: 1.5,
        borderBottomColor: active || hover ? t.primary : "transparent",
      }}
    >
      <Body size={12} weight={active ? "700" : "500"} color={active ? t.ink : hover ? t.inkSoft : t.muted}>
        {item.label}
      </Body>
    </Pressable>
  );
}

export function bottomNavSpace(bottomInset: number) {
  return Math.max(bottomInset, Platform.OS === "web" ? 14 : 12) + 104;
}

/**
 * Branch location selector shown at the very top of the app. It reads the
 * same live `/salons` records as the rest of the booking flow and only updates
 * `salonId`, so every branch-aware screen refreshes through the existing
 * context rather than introducing a parallel source of branch data.
 */
export function BranchSelector() {
  const { t, bp, salons, selectedSalon, setSalonId, notify } = useNaturals();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const choose = (salon: Salon) => {
    setSalonId(salon.id);
    setOpen(false);
    notify(`Branch set to ${salon.city}.`);
  };

  return (
    <>
      <View style={{ backgroundColor: t.bg, borderBottomWidth: 1, borderBottomColor: t.border }}>
        <View
          style={{
            maxWidth: 1200,
            width: "100%",
            alignSelf: "center",
            paddingHorizontal: bp.gutter,
            paddingVertical: bp.isMobile ? 8 : 10,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedSalon
                ? `Selected branch ${selectedSalon.name}. Open branch selector`
                : "Choose your salon branch"
            }
            onHoverIn={() => setHover(true)}
            onHoverOut={() => setHover(false)}
            onPress={() => setOpen(true)}
            style={{
              minHeight: bp.isMobile ? 48 : 52,
              flexDirection: "row",
              alignItems: "center",
              gap: bp.isMobile ? 10 : 12,
              paddingLeft: 7,
              paddingRight: 8,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: hover ? t.primaryBorder : t.border,
              backgroundColor: hover ? t.primarySoft : t.surface,
              ...t.cardShadow,
            }}
          >
            <View
              style={{
                width: bp.isMobile ? 36 : 38,
                height: bp.isMobile ? 36 : 38,
                borderRadius: 19,
                backgroundColor: t.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="location" size={17} color={t.primaryText} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Body size={8.5} weight="700" color={t.muted} numberOfLines={1} style={{ letterSpacing: 1.25 }}>
                {selectedSalon ? `YOUR BRANCH · ${selectedSalon.city.toUpperCase()}` : "YOUR BRANCH"}
              </Body>
              <Body size={bp.isMobile ? 12 : 12.5} weight="700" color={t.ink} numberOfLines={1} style={{ marginTop: 1 }}>
                {selectedSalon?.name ?? "Choose your salon"}
              </Body>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                minHeight: 30,
                paddingHorizontal: 10,
                borderRadius: radius.pill,
                backgroundColor: t.surfaceAlt,
                borderWidth: 1,
                borderColor: t.border,
              }}
            >
              <Body size={10} weight="700" color={t.primary} numberOfLines={1}>
                Change
              </Body>
              <Ionicons name="chevron-down" size={12} color={t.primary} />
            </View>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: t.scrim,
            justifyContent: bp.isMobile ? "flex-end" : "center",
            alignItems: "center",
            paddingTop: bp.isMobile ? 48 : 24,
            paddingHorizontal: bp.isMobile ? 0 : 24,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close branch selector"
            onPress={() => setOpen(false)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              width: "100%",
              maxWidth: bp.isMobile ? undefined : 580,
              maxHeight: bp.isMobile ? "88%" : "84%",
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.border,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderBottomLeftRadius: bp.isMobile ? 0 : 30,
              borderBottomRightRadius: bp.isMobile ? 0 : 30,
              overflow: "hidden",
            }}
          >
            {bp.isMobile ? (
              <View style={{ alignItems: "center", paddingTop: 9 }}>
                <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: t.borderStrong }} />
              </View>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
                paddingHorizontal: bp.isMobile ? 20 : 24,
                paddingTop: bp.isMobile ? 13 : 24,
                paddingBottom: 16,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: t.primarySoft,
                  borderWidth: 1,
                  borderColor: t.primaryBorder,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="location" size={19} color={t.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Eyebrow>Your branch</Eyebrow>
                <Display size={bp.isMobile ? 26 : 30} style={{ marginTop: 2 }}>
                  Choose your salon
                </Display>
                <Body size={11.5} color={t.muted} style={{ marginTop: 4 }}>
                  Services, branch prices and availability refresh for the location you pick.
                </Body>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close branch selector"
                onPress={() => setOpen(false)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: t.surfaceAlt,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <Ionicons name="close" size={18} color={t.ink} />
              </Pressable>
            </View>
            <Divider />
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{
                padding: bp.isMobile ? 16 : 20,
                paddingBottom: Math.max(insets.bottom, 12) + 18,
              }}
            >
              <View style={{ gap: 10 }}>
                {salons.map((salon) => (
                  <BranchOption
                    key={salon.id}
                    salon={salon}
                    active={salon.id === selectedSalon?.id}
                    onPress={() => choose(salon)}
                  />
                ))}
              </View>
              {!salons.length ? (
                <View style={{ paddingVertical: 26, alignItems: "center" }}>
                  <Ionicons name="location-outline" size={26} color={t.muted} />
                  <Body size={12} color={t.muted} align="center" style={{ marginTop: 8 }}>
                    Branches will appear here once the salon API responds.
                  </Body>
                </View>
              ) : (
                <Body size={10} color={t.muted} align="center" style={{ marginTop: 14 }}>
                  Branches are loaded live from the salon API.
                </Body>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function BranchOption({
  salon,
  active,
  onPress,
}: {
  salon: Salon;
  active: boolean;
  onPress: () => void;
}) {
  const { t, bp } = useNaturals();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${salon.name}, ${salon.city}${active ? ", currently selected" : ""}`}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        padding: bp.isMobile ? 14 : 16,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: active ? t.primary : t.border,
        backgroundColor: active ? t.primarySoft : t.surfaceAlt,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? t.primary : t.surface,
          borderWidth: 1,
          borderColor: active ? t.primary : t.border,
        }}
      >
        <Ionicons
          name={active ? "checkmark" : "location-outline"}
          size={17}
          color={active ? t.primaryText : t.primary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Body size={12.5} weight="700" color={t.ink}>
            {salon.city}
          </Body>
          {active ? (
            <Body size={8.5} weight="700" color={t.primary} style={{ letterSpacing: 1 }}>
              SELECTED
            </Body>
          ) : null}
        </View>
        <Body size={11.5} weight="600" color={t.inkSoft} numberOfLines={1} style={{ marginTop: 1 }}>
          {salon.name}
        </Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 6 }}>
          <Ionicons name="time-outline" size={12} color={t.muted} />
          <Body size={10} color={t.muted}>
            {salon.opens_at}–{salon.closes_at}
          </Body>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong }} />
          <Ionicons name="call-outline" size={12} color={t.muted} />
          <Body size={10} color={t.muted}>
            {salon.phone}
          </Body>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 }}>
          <Ionicons name="navigate-outline" size={12} color={t.muted} style={{ marginTop: 2 }} />
          <Body size={10} color={t.muted} numberOfLines={1} style={{ flex: 1 }}>
            {salon.address}
          </Body>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * In-app Back control. It sits beside the wordmark on every pushed screen and
 * calls the exact same handler as Android's hardware back button, so both
 * routes always unwind the same history stack.
 */
function HeaderBackButton() {
  const { t, bp, goBack } = useNaturals();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back to the previous screen"
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={() => goBack()}
      hitSlop={6}
      style={{
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: bp.isDesktop ? 14 : 0,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderWidth: 1,
        borderColor: hover ? t.primaryBorder : t.border,
        backgroundColor: hover ? t.primarySoft : t.surface,
      }}
    >
      <Ionicons name="arrow-back" size={18} color={t.primary} />
      {bp.isDesktop ? (
        <Body size={11.5} weight="700" color={t.primary}>
          Back
        </Body>
      ) : null}
    </Pressable>
  );
}

export function Header() {
  const { t, bp, tab, go, user, openAuth, canGoBack, goBack, bookingOpen } = useNaturals();
  const sticky =
    Platform.OS === "web"
      ? ({ position: "sticky", top: 0, zIndex: 60 } as unknown as object)
      : null;

  return (
    <>
      <View
        style={[
          {
            backgroundColor: t.navBg,
            borderBottomWidth: 1,
            borderBottomColor: t.border,
          },
          sticky,
        ]}
      >
        <View
          style={{
            maxWidth: 1200,
            width: "100%",
            alignSelf: "center",
            paddingHorizontal: bp.gutter,
            minHeight: bp.isMobile ? 66 : 78,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: bp.isMobile ? 8 : 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: bp.isMobile ? 8 : 18, flex: 1, minWidth: 0 }}>
            {canGoBack && !bookingOpen ? (
              <>
                <HeaderBackButton />
                {bp.isMobile ? (
                  <Body size={12.5} weight="700" color={t.ink} numberOfLines={1} style={{ flexShrink: 1, minWidth: 0 }}>
                    {screenTitle(tab)}
                  </Body>
                ) : (
                  <BrandMark onPress={() => go("Home")} />
                )}
              </>
            ) : (
              <BrandMark onPress={() => go("Home")} />
            )}
            {bp.isDesktop ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 19 }}>
                {NAV.map((item) => (
                  <NavLink key={item.tab} item={item} />
                ))}
                <NavLink item={{ tab: "TryOn", label: "Try-On" }} />
                {user && user.role !== "customer" ? <NavLink item={{ tab: "Admin", label: "Admin" }} /> : null}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: bp.isMobile ? 6 : 13, flexShrink: 0 }}>
            <SectionSwitch compact={bp.isMobile} />

            {user ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() => go("Profile")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 44,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: t.primarySoft,
                    borderWidth: 1,
                    borderColor: t.primaryBorder,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Body size={11.5} weight="700" color={t.primary}>
                    {initials(user.name)}
                  </Body>
                </View>
                {bp.isDesktop ? (
                  <Body size={11.5} weight="600" color={t.ink} numberOfLines={1} style={{ maxWidth: 90 }}>
                    {user.name.split(" ")[0]}
                  </Body>
                ) : null}
              </Pressable>
            ) : bp.isMobile ? (
              <IconButton name="person-outline" label="Sign in" onPress={() => openAuth("login")} />
            ) : (
              <Button title="Sign in" small kind="outline" onPress={() => openAuth("login")} />
            )}
          </View>
        </View>
      </View>
      {tab !== "Home" && tab !== "Explore" && <BranchSelector />}
    </>
  );
}

/**
 * The floating navigation uses a different glass tint per salon section:
 * purple for Naturals Women and the existing warm gold-accented dark glass for
 * Naturals Men. Both stay translucent so content remains visible through the
 * blur as it scrolls underneath.
 */
const GLASS_NAV: Record<
  Section,
  {
    background: string;
    border: string;
    highlight: string;
    highlightBorder: string;
    inactive: string;
    accent: string;
    shine: string;
  }
> = {
  women: {
    background: "rgba(54, 24, 80, 0.86)",
    border: "rgba(220, 201, 236, 0.30)",
    highlight: "rgba(255, 255, 255, 0.12)",
    highlightBorder: "rgba(233, 213, 255, 0.28)",
    inactive: "#D8CAE5",
    accent: "#E9D5FF",
    shine: "rgba(233, 213, 255, 0.32)",
  },
  men: {
    background: "rgba(13, 12, 18, 0.82)",
    border: "rgba(201, 168, 106, 0.30)",
    highlight: "rgba(201, 168, 106, 0.14)",
    highlightBorder: "rgba(230, 211, 169, 0.26)",
    inactive: "#CBC5D4",
    accent: "#E6D3A9",
    shine: "rgba(230, 211, 169, 0.34)",
  },
};

function BottomNavItem({
  item,
  active,
  onPress,
  glass,
}: {
  item: { tab: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap };
  active: boolean;
  onPress: () => void;
  glass: (typeof GLASS_NAV)[Section];
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 240,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [active, progress]);

  const iconScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pillScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${item.label}${active ? ", current tab" : ""}`}
      {...(Platform.OS === "web" ? ({ "aria-selected": active } as object) : null)}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 58,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        borderRadius: 20,
        paddingTop: 5,
        paddingBottom: 6,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 3,
          right: 3,
          borderRadius: 17,
          backgroundColor: glass.highlight,
          borderWidth: 1,
          borderColor: glass.highlightBorder,
          opacity: progress,
          transform: [{ scale: pillScale }],
        }}
      />
      <Animated.View style={{ transform: [{ scale: iconScale }], marginBottom: 1 }}>
        <Ionicons name={active ? item.activeIcon : item.icon} size={21} color={active ? glass.accent : glass.inactive} />
      </Animated.View>
      <Body
        size={10.5}
        weight={active ? "700" : "600"}
        color={active ? glass.accent : glass.inactive}
        numberOfLines={1}
        style={{ letterSpacing: 0.2 }}
      >
        {item.label}
      </Body>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 4,
          width: 12,
          height: 2,
          borderRadius: 1,
          backgroundColor: glass.accent,
          opacity: progress,
          transform: [{ scaleX: progress }],
        }}
      />
    </Pressable>
  );
}

export function BottomNav() {
  const { t, bp, tab, go } = useNaturals();
  const insets = useSafeAreaInsets();
  if (bp.isDesktop) return null;
  const items: { tab: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
    { tab: "Home", label: "Home", icon: "home-outline", activeIcon: "home" },
    { tab: "Explore", label: "Services", icon: "sparkles-outline", activeIcon: "sparkles" },
    { tab: "Bookings", label: "Bookings", icon: "calendar-outline", activeIcon: "calendar" },
    { tab: "Salons", label: "Branches", icon: "storefront-outline", activeIcon: "storefront" },
    { tab: "Profile", label: "Profile", icon: "person-outline", activeIcon: "person" },
  ];
  const glass = GLASS_NAV[t.section];
  const bottomOffset = Math.max(insets.bottom, Platform.OS === "web" ? 14 : 12) + 6;
  const webBlur =
    Platform.OS === "web"
      ? ({ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as unknown as object)
      : null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        alignItems: "center",
        paddingHorizontal: bp.isTablet ? 20 : 12,
        zIndex: 90,
      }}
    >
      <View
        style={[
          {
            maxWidth: 560,
            width: "100%",
            flexDirection: "row",
            gap: 2,
            padding: 7,
            borderRadius: 30,
            backgroundColor: glass.background,
            borderWidth: 1,
            borderColor: glass.border,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.38,
            shadowRadius: 28,
            elevation: 20,
          },
          webBlur,
        ]}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 30,
            right: 30,
            height: 1,
            backgroundColor: glass.shine,
          }}
        />
        {items.map((item) => (
          <BottomNavItem
            key={item.tab}
            item={item}
            active={tab === item.tab}
            glass={glass}
            onPress={() => go(item.tab)}
          />
        ))}
      </View>
    </View>
  );
}

export function Footer() {
  const { t, bp, section, go, salons, offers, startBooking, switchSection, openAuth, user, logOut } =
    useNaturals();
  const openBooking = startBooking;
  return (
    <View style={{ backgroundColor: t.bgAlt, borderTopWidth: 1, borderTopColor: t.border, marginTop: bp.isMobile ? 48 : 80 }}>
      <View
        style={{
          maxWidth: 1200,
          width: "100%",
          alignSelf: "center",
          paddingHorizontal: bp.gutter,
          paddingTop: bp.isMobile ? 36 : 56,
          paddingBottom: 26,
        }}
      >
        <View style={{ flexDirection: bp.isDesktop ? "row" : "column", gap: bp.isMobile ? 30 : 44 }}>
          <View style={{ flex: bp.isDesktop ? 1.4 : undefined, maxWidth: 340 }}>
            <BrandMark size="md" onPress={() => go("Home")} />
            <Body size={13} color={t.muted} style={{ marginTop: 16, maxWidth: 300 }}>
              A calmer way to book salon care. One Naturals, two atmospheres — soft light for women, deep noir for men.
            </Body>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Button title="Book a visit" small onPress={() => openBooking()} icon="arrow-forward" />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: bp.isMobile ? 30 : 54, flex: bp.isDesktop ? 1.6 : undefined }}>
            <View style={{ minWidth: 130 }}>
              <FooterHeading>Explore</FooterHeading>
              <FooterLink label="All services" onPress={() => go("Explore")} />
              <FooterLink label="Virtual try-on" onPress={() => go("TryOn")} />
              <FooterLink label="Branches" onPress={() => go("Salons")} />
              <FooterLink label={`Offers${offers.length ? ` (${offers.length})` : ""}`} onPress={() => go("Offers")} />
              <FooterLink label="About Naturals" onPress={() => go("About")} />
              <FooterLink label="Membership & cards" onPress={() => go("About")} />
              <FooterLink
                label={`Naturals ${section === "men" ? "Women" : "Men"}`}
                onPress={() => switchSection(section === "men" ? "women" : "men")}
              />
            </View>
            <View style={{ minWidth: 130 }}>
              <FooterHeading>Account</FooterHeading>
              <FooterLink label="My bookings" onPress={() => go("Bookings")} />
              <FooterLink label="Profile" onPress={() => go("Profile")} />
              {user ? (
                <FooterLink label="Sign out" onPress={logOut} />
              ) : (
                <FooterLink label="Sign in" onPress={() => openAuth("login")} />
              )}
            </View>
            <View style={{ minWidth: 180, flex: 1 }}>
              <FooterHeading>Visit</FooterHeading>
              {salons.filter((salon) => !salon.is_demo).slice(0, 2).map((salon) => (
                <Pressable key={salon.id} accessibilityRole="button" onPress={() => go("Salons")} style={{ marginBottom: 12 }}>
                  <Body size={12} weight="600" color={t.ink}>
                    {salon.city}
                  </Body>
                  <Body size={10.5} color={t.muted} numberOfLines={1}>
                    {salon.name}
                  </Body>
                  <Body size={10.5} color={t.muted}>
                    {salon.opens_at} – {salon.closes_at} · {salon.phone}
                  </Body>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  const { t } = useNaturals();
  return (
    <Body size={10} weight="700" color={t.primary} style={{ letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </Body>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useNaturals();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      style={{ minHeight: 40, justifyContent: "center" }}
    >
      <Body size={12} color={hover ? t.primary : t.inkSoft}>
        {label}
      </Body>
    </Pressable>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  const { bp } = useNaturals();
  return (
    <View
      style={{
        width: "100%",
        maxWidth: bp.maxWidth,
        alignSelf: "center",
        paddingHorizontal: bp.gutter,
      }}
    >
      {children}
    </View>
  );
}

export function SectionRule({ label }: { label?: string }) {
  const { t } = useNaturals();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginVertical: spacing.xl }}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
      {label ? (
        <Body size={9.5} weight="700" color={t.muted} style={{ letterSpacing: 1.8 }}>
          {label.toUpperCase()}
        </Body>
      ) : null}
      <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
    </View>
  );
}

export function BookingSummaryPlaceholder() {
  const { t, bp } = useNaturals();
  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
        padding: 18,
      }}
    >
      <Display size={bp.isMobile ? 24 : 28}>Your appointment</Display>
      <Body size={12} color={t.muted} style={{ marginTop: 6 }}>
        Choose a salon, treatment, date and time to see the summary.
      </Body>
    </View>
  );
}

export { fonts };
