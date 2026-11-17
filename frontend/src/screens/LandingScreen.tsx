import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNaturals } from "../context";
import { radius } from "../theme";
import { Body, BrandMark, Button, Display } from "../ui";

type GridTile = {
  source: ImageSourcePropType;
  title: string;
  aspectRatio: number;
};

type ImageColumn = {
  duration: number;
  tiles: GridTile[];
};

const privacyPolicyUrl = "https://naturals.in/privacy-policy/";
const tileGap = 9;
const tileHorizontalInset = 4;

const GRID_COLUMNS: ImageColumn[] = [
  {
    duration: 31000,
    tiles: [
      { source: require("../../assets/onboarding/onboarding-hair-styling.jpeg"), title: "Hair styling", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-barber.jpeg"), title: "Barber service", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-skincare.jpeg"), title: "Skincare facial", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-bridal-makeup.jpeg"), title: "Bridal makeup", aspectRatio: 1.5 },
      { source: require("../../assets/promo-women-hair.jpg"), title: "Naturals hair styling", aspectRatio: 1.5 },
      { source: require("../../assets/promo-hair-colour.jpg"), title: "Hair colour", aspectRatio: 1.5 },
      { source: require("../../assets/promo-women-makeup.jpg"), title: "Makeup artistry", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-salon-team.jpg"), title: "Salon team", aspectRatio: 1 },
    ],
  },
  {
    duration: 39000,
    tiles: [
      { source: require("../../assets/onboarding/onboarding-salon-interior.jpeg"), title: "Salon interior", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-bridal-hair.jpg"), title: "Bridal hair and makeup", aspectRatio: 0.558 },
      { source: require("../../assets/onboarding/onboarding-spa.jpeg"), title: "Spa and wellness", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-steam-facial.jpg"), title: "Steam facial", aspectRatio: 0.75 },
      { source: require("../../assets/promo-skincare.jpg"), title: "Skincare ritual", aspectRatio: 1.5 },
      { source: require("../../assets/promo-spa.jpg"), title: "Spa treatment", aspectRatio: 1.5 },
      { source: require("../../assets/promo-bridal.jpg"), title: "Bridal beauty", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-spa-interior.jpg"), title: "Spa interior", aspectRatio: 1.5 },
    ],
  },
  {
    duration: 35000,
    tiles: [
      { source: require("../../assets/onboarding/onboarding-bridal-makeup.jpeg"), title: "Bridal makeup", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-skincare.jpeg"), title: "Facial and skincare", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-barber.jpeg"), title: "Men's haircut", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-salon-interior.jpeg"), title: "Naturals salon", aspectRatio: 1.5 },
      { source: require("../../assets/promo-men-cut.jpg"), title: "Men's haircut", aspectRatio: 1.5 },
      { source: require("../../assets/promo-men-barber.jpg"), title: "Barber styling", aspectRatio: 1.5 },
      { source: require("../../assets/promo-men-grooming.jpg"), title: "Men's grooming", aspectRatio: 1.5 },
      { source: require("../../assets/onboarding/onboarding-pink-salon.jpg"), title: "Pink salon interior", aspectRatio: 0.75 },
    ],
  },
];

export function LandingScreen() {
  const { t, bp, go, openAuth, setShowLanding } = useNaturals();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 600;
  const tileWidth = Math.max(1, Math.floor(width / GRID_COLUMNS.length) - tileHorizontalInset * 2);
  const columns = useMemo(
    () =>
      GRID_COLUMNS.map((column) => {
        const cycleHeight =
          column.tiles.reduce((sum, tile) => sum + tileWidth / tile.aspectRatio, 0) +
          tileGap * column.tiles.length;
        return { ...column, cycleHeight, copies: Math.ceil(height / cycleHeight) + 1 };
      }),
    [height, tileWidth],
  );
  const columnMotion = useMemo(() => GRID_COLUMNS.map(() => new Animated.Value(0)), []);
  const columnWidth = Math.floor(width / GRID_COLUMNS.length);

  const handleSkip = useCallback(() => {
    setShowLanding(false);
    go("Home");
  }, [go, setShowLanding]);

  const handleLogin = useCallback(() => {
    openAuth("login");
    setShowLanding(false);
  }, [openAuth, setShowLanding]);

  const openPage = useCallback(
    (tab: "About" | "Salons") => {
      setShowLanding(false);
      go(tab);
    },
    [go, setShowLanding],
  );

  const handlePrivacy = useCallback(() => {
    void Linking.openURL(privacyPolicyUrl).catch(() => {
      Alert.alert("Unable to open the privacy policy", "Please try again later.");
    });
  }, []);

  useEffect(() => {
    const animations = columnMotion.map((motion, index) => {
      motion.setValue(index / columnMotion.length);
      return Animated.loop(
        Animated.timing(motion, {
          toValue: 1,
          duration: GRID_COLUMNS[index].duration,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== "web",
        }),
      );
    });
    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
      columnMotion.forEach((motion) => motion.stopAnimation());
    };
  }, [columnMotion]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      >
        <View style={{ flex: 1, flexDirection: "row" }}>
          {columns.map((column, columnIndex) => {
            const translateY = columnMotion[columnIndex].interpolate({
              inputRange: [0, 1],
              outputRange: [0, -column.cycleHeight],
            });
            const trackHeight = column.copies * column.cycleHeight;

            return (
              <View
                key={columnIndex}
                style={{
                  width: columnWidth,
                  height,
                  overflow: "hidden",
                  marginTop: columnIndex % 2 === 0 ? 0 : -(tileWidth / 1.5) * 0.18,
                }}
              >
                <Animated.View
                  style={{
                    width: columnWidth,
                    height: trackHeight,
                    gap: tileGap,
                    transform: [{ translateY }],
                  }}
                >
                  {Array.from({ length: column.copies }, (_, copyIndex) =>
                    column.tiles.map((tile, tileIndex) => {
                      const tileHeight = tileWidth / tile.aspectRatio;
                      return (
                        <View
                          key={`${columnIndex}-${copyIndex}-${tileIndex}`}
                          style={{
                            width: columnWidth - tileHorizontalInset * 2,
                            height: tileHeight,
                            borderRadius: radius.lg,
                            overflow: "hidden",
                            marginHorizontal: tileHorizontalInset,
                          }}
                        >
                          <Image
                            source={tile.source}
                            accessibilityLabel={tile.title}
                            resizeMode="cover"
                            fadeDuration={0}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </View>
                      );
                    }),
                  )}
                </Animated.View>
              </View>
            );
          })}
        </View>
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: t.scheme === "dark" ? "rgba(0,0,0,0.22)" : "rgba(36,27,45,0.16)" },
          ]}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip to home"
        onPress={handleSkip}
        style={{
          position: "absolute",
          top: Math.max(insets.top + 8, 18),
          right: bp.gutter,
          zIndex: 2,
          minWidth: 72,
          minHeight: 42,
          paddingHorizontal: 16,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.surface,
          alignItems: "center",
          justifyContent: "center",
          ...t.cardShadow,
        }}
      >
        <Body size={12} weight="700" color={t.primary} style={{ letterSpacing: 0.4 }}>
          Skip
        </Body>
      </Pressable>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          backgroundColor: t.bg,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingTop: compact ? 12 : 18,
          paddingHorizontal: bp.gutter,
          paddingBottom: Math.max(insets.bottom, 12) + (compact ? 5 : 10),
        }}
      >
        <BrandMark size={compact ? "md" : "lg"} align="center" onPress={handleSkip} />
        <Display
          size={compact ? 27 : 32}
          color={t.ink}
          align="center"
          style={{ marginTop: 2, letterSpacing: -0.3 }}
        >
          Naturals Salon
        </Display>
        <View
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            marginTop: compact ? 10 : 14,
          }}
        >
          <Button
            title="Login"
            onPress={handleLogin}
            icon="arrow-forward"
            full
            style={{ width: "100%", maxWidth: 440, minHeight: compact ? 48 : 54 }}
          />
        </View>
        <View
          style={{
            width: "100%",
            maxWidth: 540,
            borderTopWidth: 1,
            borderColor: t.border,
            marginTop: compact ? 10 : 14,
            paddingTop: compact ? 5 : 8,
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            columnGap: bp.isMobile ? 9 : 18,
            rowGap: 0,
          }}
        >
          <FooterLink label="Contact Support" onPress={() => openPage("About")} />
          <Ionicons name="ellipse" size={3} color={t.muted} />
          <FooterLink label="Team Details" onPress={() => openPage("Salons")} />
          <Ionicons name="ellipse" size={3} color={t.muted} />
          <FooterLink label="Privacy Policy" onPress={handlePrivacy} />
        </View>
      </View>
    </View>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useNaturals();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 34, justifyContent: "center", paddingHorizontal: 2 }}
    >
      <Body size={10.5} weight="600" color={t.primary} style={{ letterSpacing: 0.15 }}>
        {label}
      </Body>
    </Pressable>
  );
}
