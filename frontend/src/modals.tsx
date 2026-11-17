import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { servicePriceLabel } from "./api";
import { useNaturals } from "./context";
import { serviceImage } from "./images";
import { bottomNavSpace } from "./layout";
import { fonts, radius } from "./theme";
import { Badge, Body, BrandMark, Button, DemoNote, Display, Eyebrow, Img, Spinner } from "./ui";

const SHEET_NATIVE = Platform.OS !== "web";

/** Springy entrance wrapper for modal sheets; animates on every mount. */
function SheetIn({ children, style }: { children: React.ReactNode; style?: object }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      friction: 9,
      tension: 120,
      useNativeDriver: SHEET_NATIVE,
    }).start();
  }, [progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress as never,
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) as never },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) as never },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function ServiceDetailModal() {
  const { t, bp, section, selectedService, closeService, startBooking } = useNaturals();
  const visible = Boolean(selectedService);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeService} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: t.scrim,
          justifyContent: bp.isMobile ? "flex-end" : "center",
          alignItems: "center",
          paddingHorizontal: bp.isMobile ? 0 : 24,
          paddingTop: bp.isMobile ? 40 : 24,
        }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Close service details" onPress={closeService} style={StyleSheet.absoluteFill} />
        {selectedService ? (
          <SheetIn
            style={{
              width: bp.isMobile ? "100%" : 720,
              maxHeight: bp.isMobile ? "94%" : "90%",
              backgroundColor: t.surface,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              borderBottomLeftRadius: bp.isMobile ? 0 : 26,
              borderBottomRightRadius: bp.isMobile ? 0 : 26,
              borderWidth: 1,
              borderColor: t.primaryBorder,
              overflow: "hidden",
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
              <Img
                uri={serviceImage(selectedService, section)}
                height={bp.isMobile ? 230 : 280}
                label={`${selectedService.name} at Naturals`}
                radius={0}
                overlay="rgba(12, 8, 16, 0.22)"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={closeService}
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: "rgba(12, 9, 16, 0.56)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.24)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={19} color="#FFFFFF" />
                </Pressable>
                <View style={{ position: "absolute", left: 16, bottom: 16, flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
                  <View style={pill}>
                    <Body size={9.5} weight="700" color="#FFFFFF" style={{ letterSpacing: 1.1 }}>
                      {selectedService.category.toUpperCase()}
                    </Body>
                  </View>
                  <View style={pill}>
                    <Body size={9.5} weight="600" color="#FFFFFF" style={{ letterSpacing: 0.8 }}>
                      {selectedService.audience.toUpperCase()}
                    </Body>
                  </View>
                  {selectedService.is_demo ? (
                    <View style={pill}>
                      <Body size={9.5} weight="600" color="#F4EFE6" style={{ letterSpacing: 0.8 }}>
                        DEMO DATA
                      </Body>
                    </View>
                  ) : null}
                </View>
              </Img>
              <View style={{ padding: bp.isMobile ? 20 : 28 }}>
                <Eyebrow>Service detail</Eyebrow>
                <Display size={bp.isMobile ? 33 : 42} style={{ marginTop: 7 }}>
                  {selectedService.name}
                </Display>
                <Body size={13} color={t.muted} style={{ marginTop: 10, maxWidth: 580 }}>
                  {selectedService.description}
                </Body>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
                  <MetaCard icon="time-outline" label="Duration" value={`${selectedService.duration_minutes} minutes`} />
                  <MetaCard icon="pricetag-outline" label="Price" value={servicePriceLabel(selectedService)} />
                  <MetaCard icon="people-outline" label="Available to" value={selectedService.audience} />
                </View>

                <View
                  style={{
                    marginTop: 18,
                    padding: 14,
                    borderRadius: radius.md,
                    backgroundColor: t.surfaceAlt,
                    borderWidth: 1,
                    borderColor: t.border,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Ionicons name="information-circle-outline" size={18} color={t.primary} />
                  <DemoNote>
                    {selectedService.is_demo
                      ? "This description, duration and price are demonstration data from the salon API. Availability and final pricing are checked by the server during booking. No payment is collected."
                      : "Prices are published Naturals starting or listed prices, and member prices are shown in the description where published. Durations are app estimates; availability and final pricing are confirmed by the branch. No payment is collected here."}
                  </DemoNote>
                </View>

                <View style={{ flexDirection: bp.isMobile ? "column" : "row", gap: 10, marginTop: 22 }}>
                  <Button title="Book this service" onPress={() => startBooking(selectedService)} icon="arrow-forward" full={bp.isMobile} />
                  <Button title="Keep browsing" kind="outline" onPress={closeService} full={bp.isMobile} />
                </View>
              </View>
            </ScrollView>
          </SheetIn>
        ) : null}
      </View>
    </Modal>
  );
}

function MetaCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { t, bp } = useNaturals();
  return (
    <View
      style={{
        flex: bp.isMobile ? 1 : undefined,
        minWidth: bp.isMobile ? 110 : 160,
        padding: 13,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons name={icon} size={14} color={t.primary} />
        <Body size={9.5} weight="700" color={t.muted} style={{ letterSpacing: 1 }}>
          {label.toUpperCase()}
        </Body>
      </View>
      <Body size={13} weight="700" color={t.ink} style={{ marginTop: 5 }}>
        {value}
      </Body>
    </View>
  );
}

export function DialogModal() {
  const { t, dialog, closeDialog } = useNaturals();
  return (
    <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={closeDialog} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: t.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: 22,
        }}
      >
        {dialog ? (
          <SheetIn
            style={{
              width: "100%",
              maxWidth: 430,
              borderRadius: radius.xl,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.primaryBorder,
              padding: 26,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: dialog.destructive ? t.dangerSoft : t.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons
                name={dialog.destructive ? "alert-circle-outline" : "sparkles-outline"}
                size={22}
                color={dialog.destructive ? t.danger : t.primary}
              />
            </View>
            <Display size={30}>{dialog.title}</Display>
            <Body size={12.5} color={t.muted} style={{ marginTop: 8 }}>
              {dialog.message}
            </Body>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
              <Button title={dialog.cancelLabel ?? "Keep it"} kind="ghost" small onPress={closeDialog} />
              <Button
                title={dialog.confirmLabel ?? "Confirm"}
                kind={dialog.destructive ? "danger" : "primary"}
                small
                onPress={() => {
                  const action = dialog.onConfirm;
                  closeDialog();
                  action();
                }}
              />
            </View>
          </SheetIn>
        ) : null}
      </View>
    </Modal>
  );
}

export function ToastView() {
  const { t, bp, toast, bookingOpen } = useNaturals();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const toastKey = toast?.message ?? "";
  useEffect(() => {
    if (!toast) {
      slide.setValue(0);
      return;
    }
    Animated.spring(slide, { toValue: 1, friction: 8, tension: 130, useNativeDriver: Platform.OS !== "web" }).start();
  }, [slide, toastKey]);
  if (!toast) return null;
  const success = toast.tone === "success";
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bookingOpen ? 22 : bp.isDesktop ? 28 : bottomNavSpace(insets.bottom),
        alignItems: "center",
        paddingHorizontal: 16,
        zIndex: 100,
        opacity: slide as never,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) as never }],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          backgroundColor: success ? t.ink : t.danger,
          borderRadius: radius.pill,
          paddingHorizontal: 16,
          paddingVertical: 11,
          maxWidth: 560,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <Ionicons
          name={success ? "checkmark-circle" : "alert-circle"}
          size={17}
          color={success ? t.bg : "#FFFFFF"}
        />
        <Body size={11.5} weight="600" color={success ? t.bg : "#FFFFFF"} style={{ flexShrink: 1 }}>
          {toast.message}
        </Body>
      </View>
    </Animated.View>
  );
}

export function LoadingScreen() {
  const { t } = useNaturals();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <BrandMark size="lg" align="center" />
      <View style={{ marginTop: 26 }}>
        <Spinner size={24} />
      </View>
      <Body size={11} color={t.muted} style={{ marginTop: 14, letterSpacing: 0.6 }}>
        Preparing your Naturals experience…
      </Body>
    </View>
  );
}

const pill = {
  backgroundColor: "rgba(14, 10, 18, 0.58)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
  borderRadius: radius.pill,
  paddingHorizontal: 10,
  paddingVertical: 5,
} as const;

export const modalStyles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.body },
});
