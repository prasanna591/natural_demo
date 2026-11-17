import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useNaturals } from "../context";
import { pickImage } from "../imagePicker";
import { fonts, radius } from "../theme";
import { buildImageUrl } from "../demo/assets";
import { Body, Button, Display, Entrance, Eyebrow, GlassPanel, PulseDot, RowSkeleton, TiltCard, AnimatedPressable } from "../ui";

/**
 * Virtual Try-On.
 *
 * This is an honest preview studio: the guest photographs themselves (camera
 * or gallery, using the same permission flow as the rest of the app) and the
 * selected look is applied as a colour-and-label preview simulation over the
 * photo. Nothing is uploaded — the image stays on the device. A true AI
 * hair-colour/hairstyle transfer would need a server-side model, so the UI
 * says exactly what it is and always offers the real next step: booking a
 * stylist consultation.
 */

type LookCategory = "hairstyles" | "colours" | "beauty";

type Look = {
  id: string;
  name: string;
  note: string;
  image: string;
  tint: string | null;
};

const unsplash = (id: string, width = 700) =>
  buildImageUrl(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`);

const IMG = {
  womenHair: unsplash("photo-1521590832167-7bcbfaa6381f", 700),
  womenHairAlt: unsplash("photo-1562322140-8baeececf3df", 700),
  womenHero: unsplash("photo-1522337360788-8b13dee7a37e", 700),
  bridal: unsplash("photo-1519699047748-de8e457a634e", 700),
  makeup: unsplash("photo-1487412947147-5cebf100ffc2", 700),
  hairColour: unsplash("photo-1522338242992-e1a54906a8da", 700),
  menCut: unsplash("photo-1621605815971-fbc98d665033", 700),
  menBeard: unsplash("photo-1599351431202-1e0f0137899a", 700),
  menPortrait: unsplash("photo-1517832606299-7ae9b720a186", 700),
  barberShop: unsplash("photo-1585747860715-2ba37e788b70", 700),
};

const COLLECTIONS: Record<"women" | "men", Record<LookCategory, Look[]>> = {
  women: {
    hairstyles: [
      { id: "w-h1", name: "Soft cascade layers", note: "Long layers, feathered ends", image: IMG.womenHairAlt, tint: null },
      { id: "w-h2", name: "Glass-glide bob", note: "Blunt, mirror-finish bob", image: IMG.womenHair, tint: null },
      { id: "w-h3", name: "Bridal pin-updo", note: "Twisted crown, face-framing strands", image: IMG.bridal, tint: null },
      { id: "w-h4", name: "Studio blowout", note: "Volume, soft curls, shine spray", image: IMG.womenHero, tint: null },
    ],
    colours: [
      { id: "w-c1", name: "Rose gold", note: "Warm blush blonde", image: IMG.hairColour, tint: "rgba(217, 162, 142, 0.34)" },
      { id: "w-c2", name: "Champagne beige", note: "Soft, sunlit neutral", image: IMG.womenHero, tint: "rgba(230, 211, 169, 0.32)" },
      { id: "w-c3", name: "Plum noir", note: "Deep violet-brown", image: IMG.womenHairAlt, tint: "rgba(142, 95, 168, 0.36)" },
      { id: "w-c4", name: "Copper silk", note: "Spun-copper warmth", image: IMG.hairColour, tint: "rgba(179, 106, 60, 0.32)" },
      { id: "w-c5", name: "Ash cashmere", note: "Cool, low-maintenance", image: IMG.womenHair, tint: "rgba(138, 123, 110, 0.30)" },
    ],
    beauty: [
      { id: "w-b1", name: "Dewy luminous", note: "Wet-skin highlight, sheer base", image: IMG.makeup, tint: "rgba(255, 214, 196, 0.22)" },
      { id: "w-b2", name: "Smoked rose", note: "Soft smoke eye, rose lip", image: IMG.bridal, tint: "rgba(196, 116, 138, 0.24)" },
      { id: "w-b3", name: "Nude cashmere", note: "Matte nude, brushed brow", image: IMG.makeup, tint: "rgba(224, 196, 172, 0.26)" },
      { id: "w-b4", name: "Bridal radiance", note: "Luminous base, petal cheeks", image: IMG.bridal, tint: "rgba(255, 232, 214, 0.24)" },
    ],
  },
  men: {
    hairstyles: [
      { id: "m-h1", name: "Textured crop", note: "Tapered sides, matte finish", image: IMG.menCut, tint: null },
      { id: "m-h2", name: "Barber slick-back", note: "Pomade shine, sharp part", image: IMG.menPortrait, tint: null },
      { id: "m-h3", name: "Beard fade", note: "Skin fade with sculpted beard", image: IMG.menBeard, tint: null },
      { id: "m-h4", name: "Buzz + line-up", note: "Clean edges, crisp silhouette", image: IMG.barberShop, tint: null },
    ],
    colours: [
      { id: "m-c1", name: "Ash brown", note: "Cool natural depth", image: IMG.menCut, tint: "rgba(128, 116, 104, 0.30)" },
      { id: "m-c2", name: "Platinum accent", note: "Ice-blonde tips", image: IMG.menPortrait, tint: "rgba(226, 232, 240, 0.30)" },
      { id: "m-c3", name: "Copper ember", note: "Warm chestnut lift", image: IMG.menBeard, tint: "rgba(170, 96, 52, 0.30)" },
      { id: "m-c4", name: "Ink black", note: "Deep, polished black", image: IMG.barberShop, tint: "rgba(24, 24, 30, 0.34)" },
    ],
    beauty: [
      { id: "m-b1", name: "Beard sculpt", note: "Line-up, oil finish", image: IMG.menBeard, tint: "rgba(230, 211, 169, 0.18)" },
      { id: "m-b2", name: "Clean glow facial", note: "Hydrated, even tone", image: IMG.menPortrait, tint: "rgba(255, 224, 196, 0.18)" },
      { id: "m-b3", name: "De-tan ritual", note: "Brightened, refreshed skin", image: IMG.menCut, tint: "rgba(255, 240, 214, 0.20)" },
    ],
  },
};

const CATEGORY_META: { key: LookCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "hairstyles", label: "Hairstyles", icon: "cut-outline" },
  { key: "colours", label: "Hair colour", icon: "color-palette-outline" },
  { key: "beauty", label: "Beauty looks", icon: "sparkles-outline" },
];

export function TryOnScreen() {
  const { t, bp, section, startBooking } = useNaturals();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [category, setCategory] = useState<LookCategory>("hairstyles");
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const tintOpacity = useRef(new Animated.Value(0)).current;

  const looks = useMemo(() => COLLECTIONS[section][category], [section, category]);
  const selectedLook = looks.find((look) => look.id === selectedLookId) ?? null;

  React.useEffect(() => {
    Animated.timing(tintOpacity, {
      toValue: selectedLook?.tint ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [tintOpacity, selectedLook]);

  React.useEffect(() => {
    // Keep the selection meaningful when switching categories.
    setSelectedLookId(null);
    setImageFailed(false);
  }, [category, section]);

  const choosePhoto = async (source: "camera" | "library") => {
    setPhotoError("");
    try {
      const file = await pickImage(source);
      if (file?.uri) {
        setPhotoUri(file.uri);
        setImageFailed(false);
      }
    } catch (reason) {
      setPhotoError(reason instanceof Error && reason.message ? reason.message : "Could not open that source.");
    }
  };

  const displayImage = photoUri ?? selectedLook?.image ?? looks[0]?.image ?? IMG.womenHair;
  const previewingOwnPhoto = Boolean(photoUri);
  const gutter = bp.isMobile ? 18 : bp.isTablet ? 28 : 40;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bp.isMobile ? 140 : 90 }}
    >
      <View style={{ maxWidth: bp.maxWidth, width: "100%", alignSelf: "center", paddingHorizontal: gutter, paddingTop: bp.isMobile ? 20 : 38 }}>
        <Entrance>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <PulseDot />
            <Eyebrow>Virtual studio · live preview</Eyebrow>
          </View>
          <Display size={bp.isMobile ? 36 : 50} style={{ marginTop: 8 }}>
            Try the look before the chair
          </Display>
          <Body size={13} color={t.muted} style={{ marginTop: 9, maxWidth: 620 }}>
            Photograph yourself or upload a portrait, then tap through hairstyles, colours and beauty
            looks to preview the direction. Your photo never leaves this device — it is not uploaded
            anywhere. Colour washes are indicative simulations, so the finishing shades are confirmed
            with your stylist in the salon.
          </Body>
        </Entrance>

        {/* Preview stage */}
        <Entrance delay={80}>
          <GlassPanel padded={false} style={{ marginTop: bp.isMobile ? 22 : 30 }}>
            <View
              style={{
                height: bp.isMobile ? 420 : 540,
                backgroundColor: t.surfaceAlt,
                overflow: "hidden",
              }}
            >
              {!imageFailed && displayImage ? (
                <Image
                  source={{ uri: displayImage }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessibilityLabel="Try-on preview portrait"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", gap: 10 }]}>
                  <Ionicons name="person-circle-outline" size={72} color={t.primary} />
                  <Body size={12} color={t.muted}>
                    {imageFailed ? "That image could not be displayed. Try another photo." : "Choose a look to begin."}
                  </Body>
                </View>
              )}

              {selectedLook?.tint ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: selectedLook.tint, opacity: tintOpacity as never },
                  ]}
                />
              ) : null}

              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: t.imageOverlay, opacity: previewingOwnPhoto ? 0.55 : 0.25 }]}
              />

              <View style={{ position: "absolute", left: 18, top: 18, right: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={stagePill}>
                  <Ionicons name="shield-checkmark-outline" size={12} color="#FFFFFF" />
                  <Body size={9.5} weight="700" color="#FFFFFF" style={{ letterSpacing: 1 }}>
                    {previewingOwnPhoto ? "YOUR PHOTO · STAYS ON DEVICE" : "SAMPLE MODEL"}
                  </Body>
                </View>
                {selectedLook ? (
                  <View style={[stagePill, { backgroundColor: "rgba(10, 8, 14, 0.7)" }]}>
                    <Ionicons name="sparkles" size={12} color={t.primary} />
                    <Body size={10} weight="700" color="#FFFFFF" style={{ letterSpacing: 0.6 }}>
                      {selectedLook.name.toUpperCase()}
                    </Body>
                  </View>
                ) : null}
              </View>

              {selectedLook ? (
                <View style={{ position: "absolute", left: 18, right: 18, bottom: 16 }}>
                  <View style={[stagePill, { alignSelf: "flex-start", backgroundColor: "rgba(10, 8, 14, 0.66)", maxWidth: "100%" }]}>
                    <Body size={10} color="#EDE7F2" numberOfLines={2}>
                      {previewingOwnPhoto
                        ? `Preview simulation · ${selectedLook.note}. In-salon colour match and finish may vary.`
                        : selectedLook.note}
                    </Body>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={{ padding: bp.isMobile ? 16 : 20, gap: 12 }}>
              {photoError ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderWidth: 1,
                    borderColor: t.danger,
                    backgroundColor: t.dangerSoft,
                    borderRadius: radius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Ionicons name="alert-circle-outline" size={15} color={t.danger} />
                  <Body size={11} color={t.danger} style={{ flex: 1 }}>
                    {photoError}
                  </Body>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Button
                  title="Take a photo"
                  icon="camera-outline"
                  small
                  onPress={() => choosePhoto("camera")}
                  accessibilityLabel="Open the camera to take a try-on photo"
                />
                <Button
                  title="Choose from gallery"
                  icon="images-outline"
                  small
                  kind="outline"
                  onPress={() => choosePhoto("library")}
                  accessibilityLabel="Choose a try-on photo from the gallery"
                />
                {photoUri ? (
                  <Button
                    title="Clear photo"
                    icon="trash-outline"
                    small
                    kind="ghost"
                    onPress={() => {
                      setPhotoUri(null);
                      setPhotoError("");
                    }}
                  />
                ) : null}
              </View>
              <Body size={10} color={t.muted}>
                {Platform.OS === "web"
                  ? "On web, the gallery button opens your file browser. Camera capture is best on the mobile app."
                  : "Camera use needs the camera permission; the gallery needs photo access. Both are requested only when you tap."}
              </Body>
            </View>
          </GlassPanel>
        </Entrance>

        {/* Collection switcher */}
        <Entrance delay={140}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 9,
              marginTop: bp.isMobile ? 26 : 34,
              marginBottom: 16,
            }}
          >
            {CATEGORY_META.map((meta) => {
              const active = category === meta.key;
              return (
                <Pressable
                  key={meta.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Browse ${meta.label}`}
                  onPress={() => setCategory(meta.key)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 44,
                    paddingHorizontal: 16,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: active ? t.primary : t.border,
                    backgroundColor: active ? t.primarySoft : t.surface,
                  }}
                >
                  <Ionicons name={meta.icon} size={15} color={active ? t.primary : t.muted} />
                  <Body size={12} weight="700" color={active ? t.primary : t.inkSoft}>
                    {meta.label}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        </Entrance>

        {/* Look gallery */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: bp.isMobile ? 12 : 16 }}>
          {looks.map((look, index) => {
            const active = look.id === selectedLookId;
            return (
              <Entrance key={`${category}-${look.id}`} delay={index * 60} style={{ width: bp.isMobile ? "100%" : bp.isTablet ? "48.5%" : "24%" }}>
                <TiltCard
                  accessibilityLabel={`Preview ${look.name}`}
                  onPress={() => setSelectedLookId(active ? null : look.id)}
                >
                  <View
                    style={{
                      borderRadius: radius.xl,
                      overflow: "hidden",
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? t.primary : t.border,
                      backgroundColor: t.surface,
                    }}
                  >
                    <View style={{ height: bp.isMobile ? 210 : 180, backgroundColor: t.surfaceAlt }}>
                      <Image
                        source={{ uri: look.image }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessibilityLabel={`${look.name} style reference`}
                      />
                      {look.tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: look.tint, opacity: active ? 0.85 : 0.4 }]} /> : null}
                      {active ? (
                        <View
                          style={{
                            position: "absolute",
                            right: 10,
                            top: 10,
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: t.primary,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="checkmark" size={14} color={t.primaryText} />
                        </View>
                      ) : null}
                    </View>
                    <View style={{ padding: 14, gap: 3 }}>
                      <Body size={12.5} weight="700" color={active ? t.primary : t.ink} numberOfLines={1}>
                        {look.name}
                      </Body>
                      <Body size={10.5} color={t.muted} numberOfLines={2}>
                        {look.note}
                      </Body>
                    </View>
                  </View>
                </TiltCard>
              </Entrance>
            );
          })}
        </View>

        {/* Next step */}
        <Entrance delay={200}>
          <GlassPanel style={{ marginTop: bp.isMobile ? 30 : 44, padding: bp.isMobile ? 18 : 26 }}>
            <View style={{ flexDirection: bp.isMobile ? "column" : "row", alignItems: "center", gap: 16 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Eyebrow>Love the direction?</Eyebrow>
                <Display size={bp.isMobile ? 25 : 30} style={{ marginTop: 5 }}>
                  Book the ritual
                </Display>
                <Body size={12} color={t.muted} style={{ marginTop: 5 }}>
                  A Naturals stylist reviews your preview with you, matches shade to your hair and skin in person, and confirms timing and price live.
                </Body>
              </View>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Button title="Start booking" icon="arrow-forward" onPress={() => startBooking()} />
                {selectedLook ? (
                  <Button
                    title="Save look for later"
                    kind="outline"
                    small
                    onPress={() => {
                      // The look is remembered for this visit only; the salon
                      // never receives the photo.
                      setSelectedLookId(selectedLook.id);
                    }}
                    accessibilityLabel="Keep this look selected"
                  />
                ) : null}
              </View>
            </View>
          </GlassPanel>
        </Entrance>

        <Body size={10} color={t.muted} style={{ marginTop: 18, textAlign: "center" }}>
          Virtual try-on is a styling preview: colour washes are simulated and photos are processed entirely on this device. No photo is uploaded to the salon.
        </Body>
      </View>
    </ScrollView>
  );
}

const stagePill = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  backgroundColor: "rgba(10, 8, 14, 0.6)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.2)",
  borderRadius: radius.pill,
  paddingHorizontal: 10,
  paddingVertical: 6,
} as const;

export const tryOnStyles = StyleSheet.create({
  stage: { flex: 1 },
});
