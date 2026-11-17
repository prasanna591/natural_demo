import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useNaturals } from "../context";
import { SectionSwitch } from "../layout";
import { radius, type Section } from "../theme";
import { Badge, Body, BrandMark, Button, DemoNote, Display, ErrorNote, Field } from "../ui";

/** Translucent pill surface for the back button, per section atmosphere. */
const BACKGROUND: Record<
  Section,
  {
    pillBg: string;
    pillBorder: string;
  }
> = {
  women: {
    pillBg: "rgba(255, 255, 255, 0.62)",
    pillBorder: "rgba(255, 255, 255, 0.78)",
  },
  men: {
    pillBg: "rgba(20, 20, 24, 0.6)",
    pillBorder: "rgba(201, 168, 106, 0.34)",
  },
};

export function AuthScreen() {
  const app = useNaturals();
  const { t, bp, section, authMode, authName, setAuthName, authEmail, setAuthEmail, authPassword, setAuthPassword, signIn, closeAuth, error, clearError, busy, openAuth } = app;
  const [showPassword, setShowPassword] = useState(false);
  const { height } = useWindowDimensions();

  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [entrance]);

  if (!authMode) return null;
  const register = authMode === "register";
  const admin = authMode === "admin";
  const valid =
    authEmail.trim().length > 2 &&
    (admin || authEmail.includes("@")) &&
    authPassword.length >= (register ? 8 : 1) &&
    (!register || authName.trim().length >= 2);

  const contentOpacity = entrance;
  const contentOffset = entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  const background = BACKGROUND[section];
  const dark = t.scheme === "dark";

  return (
    <KeyboardAvoidingView style={{ flexGrow: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View
        style={{
          flexGrow: 1,
          width: "100%",
          minHeight: Math.max(height, 1),
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: bp.gutter,
          paddingVertical: bp.isMobile ? 18 : 30,
        }}
      >
        {/* Plain theme backdrop; the glass form carries the atmosphere. */}
        <Animated.View
          style={{
            width: "100%",
            maxWidth: 470,
            opacity: contentOpacity,
            transform: [{ translateY: contentOffset }],
          }}
        >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: bp.isMobile ? 20 : 26,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to browsing"
                onPress={closeAuth}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  minHeight: 40,
                  paddingHorizontal: 14,
                  borderRadius: radius.pill,
                  backgroundColor: background.pillBg,
                  borderWidth: 1,
                  borderColor: background.pillBorder,
                }}
              >
                <Ionicons name="arrow-back" size={16} color={t.primary} />
                <Body size={11.5} weight="700" color={t.primary}>
                  Back
                </Body>
              </Pressable>
              <SectionSwitch compact />
            </View>

            <View style={{ alignItems: "center" }}>
              <BrandMark size="lg" align="center" onPress={() => app.go("Home")} />
              <Display
                size={bp.isMobile ? 31 : 36}
                color={dark ? "#F7F1E8" : "#241B2D"}
                align="center"
                style={{
                  marginTop: 8,
                  letterSpacing: -0.3,
                  textShadowColor: dark ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.9)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: dark ? 10 : 12,
                }}
              >
                Naturals Salon
              </Display>
              <Body
                size={9.5}
                weight="700"
                color={dark ? "rgba(230, 211, 169, 0.82)" : "rgba(91, 42, 131, 0.72)"}
                style={{
                  marginTop: 3,
                  letterSpacing: 2.4,
                  textTransform: "uppercase",
                  textShadowColor: dark ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.85)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 8,
                }}
              >
                Salon & Wellness
              </Body>
            </View>

            <View
              style={[
                {
                  marginTop: bp.isMobile ? 20 : 26,
                  backgroundColor: dark
                    ? "rgba(16, 16, 20, 0.62)"
                    : section === "women"
                      ? "rgba(247, 241, 251, 0.82)"
                      : "rgba(255, 255, 255, 0.52)",
                  borderColor: dark
                    ? "rgba(201, 168, 106, 0.22)"
                    : section === "women"
                      ? "rgba(91, 42, 131, 0.18)"
                      : "rgba(255, 255, 255, 0.72)",
                  borderRadius: bp.isMobile ? 28 : 32,
                  borderWidth: 1,
                  padding: bp.isMobile ? 22 : 32,
                  ...t.cardShadow,
                },
                Platform.OS === "web"
                  ? ({ backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" } as unknown as object)
                  : null,
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Badge
                  label={register ? "new account" : admin ? "administrator access" : "welcome back"}
                  tone="primary"
                  icon={admin ? "shield-checkmark-outline" : "sparkles-outline"}
                />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="lock-closed-outline" size={11} color={t.muted} />
                  <Body size={9} weight="700" color={t.muted} style={{ letterSpacing: 1.1 }}>
                    SECURE
                  </Body>
                </View>
              </View>

              <Display size={bp.isMobile ? 30 : 34} style={{ marginTop: 14, letterSpacing: -0.3 }}>
                {register ? "Create your account." : admin ? "Administrator sign in." : "Welcome back."}
              </Display>
              <Body size={12.5} color={t.muted} style={{ marginTop: 7, maxWidth: 400 }}>
                {register
                  ? "Join Naturals to confirm appointments, manage visits and keep your details in one place."
                  : admin
                    ? "Use your authorized administrator or developer account to open the protected operations dashboard."
                    : "Sign in to manage appointments, reschedule visits and keep your profile up to date."}
              </Body>

              <View style={{ marginTop: 20 }}>
                {register ? (
                  <Field
                    label="Your name"
                    value={authName}
                    onChangeText={setAuthName}
                    placeholder="Full name"
                    autoCapitalize="words"
                    icon="person-outline"
                    required
                    error={authName.length > 0 && authName.trim().length < 2 ? "Too short" : undefined}
                  />
                ) : null}
                <Field
                  label={admin ? "Admin email or account name" : "Email address"}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  placeholder={admin ? "Admin email or account name" : "you@example.com"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={admin ? "default" : "email-address"}
                  icon={admin ? "person-outline" : "mail-outline"}
                  required
                />
                <Field
                  label="Password"
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder={register ? "At least 8 characters" : "Your password"}
                  secureTextEntry={!showPassword}
                  icon="lock-closed-outline"
                  required
                  error={register && authPassword.length > 0 && authPassword.length < 8 ? "At least 8 characters" : undefined}
                  rightAccessory={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      onPress={() => setShowPassword((value) => !value)}
                      style={{ minHeight: 40, minWidth: 34, alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={t.muted} />
                    </Pressable>
                  }
                />

                {error ? <ErrorNote message={error} onClose={clearError} /> : null}

                <Button
                  title={busy ? "Please wait…" : register ? "Create account" : admin ? "Admin login" : "Sign in"}
                  onPress={() => void signIn()}
                  disabled={!valid || busy}
                  loading={busy}
                  full
                  icon="arrow-forward"
                  style={{ marginTop: 4 }}
                />

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 16, flexWrap: "wrap" }}>
                  {!admin ? (
                    <>
                      <Body size={11.5} color={t.muted}>
                        {register ? "Already have an account?" : "New to Naturals?"}
                      </Body>
                      <Pressable accessibilityRole="button" onPress={() => { clearError(); openAuth(register ? "login" : "register"); }} style={{ minHeight: 32, justifyContent: "center" }}>
                        <Body size={11.5} weight="700" color={t.primary}>{register ? "Sign in" : "Create an account"}</Body>
                      </Pressable>
                      <Body size={11.5} color={t.muted}>·</Body>
                    </>
                  ) : null}
                  <Pressable accessibilityRole="button" onPress={() => { clearError(); openAuth(admin ? "login" : "admin"); }} style={{ minHeight: 32, justifyContent: "center" }}>
                    <Body size={11.5} weight="700" color={t.primary}>{admin ? "Customer sign in" : "Admin Login"}</Body>
                  </Pressable>
                </View>
                {!admin ? <DemoNote center>Browsing is available without an account. Confirming a booking requires one.</DemoNote> : null}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16 }}>
              <Ionicons name="shield-checkmark-outline" size={13} color={dark ? "rgba(230, 211, 169, 0.75)" : "rgba(91, 42, 131, 0.62)"} />
              <Body size={10} color={dark ? "rgba(245, 241, 232, 0.68)" : "rgba(74, 61, 85, 0.68)"}>
                Owner-scoped bookings · server-enforced access
              </Body>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
  );
}
