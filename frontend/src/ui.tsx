import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useNaturals } from "./context";
import { fonts, radius, spacing, type Theme } from "./theme";

type IconName = keyof typeof Ionicons.glyphMap;

export function Display({
  children,
  size,
  color,
  style,
  numberOfLines,
  align,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  align?: "left" | "center" | "right";
}) {
  const { t, bp } = useNaturals();
  const resolved = size ?? (bp.isMobile ? 40 : bp.isDesktop ? 56 : 46);
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: fonts.display,
          fontSize: resolved,
          lineHeight: Math.round(resolved * 1.08),
          letterSpacing: resolved > 36 ? -0.8 : -0.2,
          fontWeight: "600",
          color: color ?? t.ink,
          textAlign: align ?? "left",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  size = 14,
  color,
  weight,
  style,
  numberOfLines,
  align,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: TextStyle["fontWeight"];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  align?: "left" | "center" | "right";
}) {
  const { t } = useNaturals();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: fonts.body,
          fontSize: size,
          lineHeight: Math.round(size * 1.6),
          color: color ?? t.inkSoft,
          fontWeight: weight ?? "400",
          textAlign: align ?? "left",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Eyebrow({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const { t } = useNaturals();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.body,
          fontSize: 11,
          lineHeight: 16,
          letterSpacing: 2.2,
          textTransform: "uppercase",
          fontWeight: "700",
          color: color ?? t.primary,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  kind = "primary",
  small = false,
  full = false,
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "outline" | "ghost" | "dark" | "light" | "danger";
  small?: boolean;
  full?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { t } = useNaturals();
  const [hover, setHover] = useState(false);
  const blocked = disabled || loading;

  const palette = {
    primary: { bg: t.primary, border: t.primary, text: t.primaryText },
    outline: { bg: hover ? t.primarySoft : "transparent", border: t.primaryBorder, text: t.primary },
    ghost: { bg: hover ? t.primarySoft : "transparent", border: "transparent", text: t.ink },
    dark: { bg: t.ink, border: t.ink, text: t.bg },
    light: { bg: t.surface, border: t.border, text: t.ink },
    danger: { bg: t.danger, border: t.danger, text: t.scheme === "dark" ? "#2A0F14" : "#FFFFFF" },
  }[kind];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: blocked }}
      disabled={blocked}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          minHeight: small ? 44 : 52,
          paddingHorizontal: small ? 16 : 24,
          paddingVertical: small ? 10 : 14,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.bg,
          opacity: blocked ? 0.45 : pressed && !blocked ? 0.92 : 1,
          transform: [
            { translateY: hover && !blocked ? -1 : 0 },
            { scale: pressed && !blocked && !small ? 0.985 : 1 },
          ],
          alignSelf: full ? "stretch" : "flex-start",
          width: full ? "100%" : undefined,
        },
        kind === "primary" ? t.cardShadow : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.text} /> : null}
      <Text
        style={{
          fontFamily: fonts.body,
          color: palette.text,
          fontSize: small ? 12 : 13.5,
          fontWeight: "700",
          letterSpacing: 0.3,
        }}
      >
        {title}
      </Text>
      {icon && !loading ? <Ionicons name={icon} size={small ? 15 : 17} color={palette.text} /> : null}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  size = 20,
  variant = "soft",
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  variant?: "soft" | "plain" | "dark";
}) {
  const { t } = useNaturals();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: variant === "soft" ? (hover ? t.primarySoft : t.surfaceAlt) : variant === "dark" ? t.ink : "transparent",
        borderWidth: variant === "plain" ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <Ionicons name={name} size={size} color={variant === "dark" ? t.bg : t.ink} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  const { t } = useNaturals();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? t.primary : hover ? t.primaryBorder : t.border,
        backgroundColor: selected ? t.primary : hover ? t.primarySoft : t.surface,
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? t.primaryText : t.primary} /> : null}
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 12,
          fontWeight: selected ? "700" : "500",
          color: selected ? t.primaryText : t.inkSoft,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl({
  options,
  values,
  value,
  onChange,
}: {
  options: string[];
  values?: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useNaturals();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 4,
        gap: 2,
        borderRadius: radius.pill,
        backgroundColor: t.surfaceAlt,
        borderWidth: 1,
        borderColor: t.border,
        alignSelf: "flex-start",
      }}
    >
      {options.map((option, index) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={values?.[index] ?? option}
            onPress={() => onChange(option)}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? t.primary : "transparent",
            }}
          >
            <Body size={11.5} weight="700" color={active ? t.primaryText : t.muted} style={{ letterSpacing: 0.3 }}>
              {values?.[index] ?? option}
            </Body>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({
  label,
  tone = "muted",
  icon,
}: {
  label: string;
  tone?: "muted" | "primary" | "success" | "danger" | "outline";
  icon?: IconName;
}) {
  const { t } = useNaturals();
  const palette = {
    muted: { bg: t.surfaceAlt, fg: t.muted, border: t.border },
    primary: { bg: t.primarySoft, fg: t.primary, border: t.primaryBorder },
    success: { bg: t.successSoft, fg: t.success, border: "transparent" },
    danger: { bg: t.dangerSoft, fg: t.danger, border: "transparent" },
    outline: { bg: "transparent", fg: t.muted, border: t.borderStrong },
  }[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      {icon ? <Ionicons name={icon} size={11} color={palette.fg} /> : null}
      <Text
        style={{
          fontFamily: fonts.body,
          color: palette.fg,
          fontSize: 9.5,
          fontWeight: "700",
          letterSpacing: 0.9,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useNaturals();
  return <View style={[{ height: 1, backgroundColor: t.border }, style]} />;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  onAction,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  align?: "left" | "center";
}) {
  const { t, bp } = useNaturals();
  return (
    <View
      style={{
        flexDirection: bp.isMobile || align === "center" ? "column" : "row",
        justifyContent: "space-between",
        alignItems: bp.isMobile || align === "center" ? (align === "center" ? "center" : "flex-start") : "flex-end",
        gap: 14,
        marginBottom: bp.isMobile ? 20 : 26,
      }}
    >
      <View style={{ flex: 1, alignItems: align === "center" ? "center" : "flex-start" }}>
        {eyebrow ? <Eyebrow style={{ marginBottom: 9 }}>{eyebrow}</Eyebrow> : null}
        <Display size={bp.isMobile ? 30 : 42} align={align}>
          {title}
        </Display>
        {subtitle ? (
          <Body size={14} color={t.muted} style={{ marginTop: 8, maxWidth: 560, textAlign: align }} numberOfLines={3}>
            {subtitle}
          </Body>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={{ flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44 }}>
          <Text style={{ fontFamily: fonts.body, color: t.primary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={15} color={t.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Img({
  uri,
  height,
  label,
  radius: corner = radius.lg,
  children,
  overlay,
  style,
  fallbackIcon = "sparkles-outline",
}: {
  uri: string;
  height: number;
  label: string;
  radius?: number;
  children?: React.ReactNode;
  overlay?: string;
  style?: StyleProp<ViewStyle>;
  fallbackIcon?: IconName;
}) {
  const { t } = useNaturals();
  const [failed, setFailed] = useState(false);
  return (
    <View style={[{ height, borderRadius: corner, overflow: "hidden", backgroundColor: t.surfaceAlt }, style]}>
      {!failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={label}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt }]}>
          <Ionicons name={fallbackIcon} size={34} color={t.primary} />
        </View>
      )}
      {overlay ? <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} /> : null}
      {children}
    </View>
  );
}

export function Field({
  label,
  icon,
  error,
  required,
  style,
  rightAccessory,
  ...props
}: TextInputProps & {
  label: string;
  icon?: IconName;
  error?: string;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
  rightAccessory?: React.ReactNode;
}) {
  const { t } = useNaturals();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: t.inkSoft }}>
          {label}
          {required ? <Text style={{ color: t.primary }}> *</Text> : null}
        </Text>
        {error ? <Text style={{ fontFamily: fonts.body, color: t.danger, fontSize: 10 }}>{error}</Text> : null}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: props.multiline ? "flex-start" : "center",
          gap: 10,
          borderWidth: 1,
          borderColor: error ? t.danger : focused ? t.primary : t.border,
          backgroundColor: t.inputBg,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          minHeight: props.multiline ? 96 : 50,
          paddingVertical: props.multiline ? 12 : 0,
        }}
      >
        {icon ? <Ionicons name={icon} size={17} color={focused ? t.primary : t.muted} style={{ marginTop: props.multiline ? 2 : 0 }} /> : null}
        <TextInput
          {...props}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={t.muted}
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 14,
            color: t.ink,
            paddingVertical: 12,
            minHeight: props.multiline ? 72 : 48,
            textAlignVertical: props.multiline ? "top" : "center",
          }}
        />
        {rightAccessory}
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useNaturals();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 54,
        paddingHorizontal: 24,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
      }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 24,
          backgroundColor: t.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={26} color={t.primary} />
      </View>
      <Display size={26} align="center" style={{ marginBottom: 7 }}>
        {title}
      </Display>
      <Body size={13} color={t.muted} align="center" style={{ maxWidth: 400 }}>
        {message}
      </Body>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} kind="outline" small style={{ marginTop: 18 }} /> : null}
    </View>
  );
}

export function ErrorNote({ message, onClose }: { message: string; onClose?: () => void }) {
  const { t } = useNaturals();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: t.dangerSoft,
        borderWidth: 1,
        borderColor: t.danger,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 11,
        marginBottom: 14,
      }}
    >
      <Ionicons name="alert-circle-outline" size={18} color={t.danger} />
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: t.danger }}>{message}</Text>
      {onClose ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={onClose} hitSlop={10} style={{ minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }}>
          <Ionicons name="close" size={17} color={t.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Spinner({ size = 22, color }: { size?: number; color?: string }) {
  const { t } = useNaturals();
  return <ActivityIndicator size={size} color={color ?? t.primary} />;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  const { t } = useNaturals();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 14 }}>
      <ActivityIndicator size="large" color={t.primary} />
      <Body size={12} color={t.muted}>
        {label}
      </Body>
    </View>
  );
}

export function Steps({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep?: (index: number) => void;
}) {
  const { t, bp } = useNaturals();
  return (
    <View style={{ marginBottom: 26 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {steps.map((_, index) => (
          <StepBar key={`bar-${index}`} filled={index <= current} t={t} />
        ))}
      </View>
      <View style={{ flexDirection: "row", marginTop: 12, gap: 4 }}>
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Step ${index + 1}: ${label}`}
              accessibilityState={{ selected: active, disabled: index > current }}
              disabled={index > current}
              onPress={() => onStep?.(index)}
              style={{ flex: 1, alignItems: bp.isMobile ? "flex-start" : "center", gap: 5 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: done ? t.primary : active ? t.primarySoft : t.surfaceAlt,
                    borderWidth: 1,
                    borderColor: active || done ? t.primary : t.border,
                  }}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={12} color={t.primaryText} />
                  ) : (
                    <Text style={{ fontFamily: fonts.body, fontSize: 9, fontWeight: "700", color: active ? t.primary : t.muted }}>{index + 1}</Text>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.body,
                    fontSize: bp.isMobile ? 10 : 11,
                    fontWeight: active || done ? "700" : "500",
                    color: active ? t.ink : done ? t.inkSoft : t.muted,
                  }}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One segment of the step progress rail; fills with a spring when reached. */
function StepBar({ filled, t }: { filled: boolean; t: Theme }) {
  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(fill, { toValue: filled ? 1 : 0, friction: 8, tension: 120, useNativeDriver: Platform.OS !== "web" }).start();
  }, [fill, filled]);
  return (
    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: t.border, overflow: "hidden" }}>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: 2,
          backgroundColor: t.primary,
          transform: [{ scaleX: fill as never }],
        }}
      />
    </View>
  );
}

/**
 * The supplied brand artwork (transparent PNG) is used for the Naturals
 * wordmark everywhere the brand name appears. `wordmark.png` is the artwork
 * with its transparent margins trimmed, and `wordmark-light.png` is the same
 * shape recoloured to the Men theme's warm gold so the mark blends with the
 * dark page instead of sitting on a contrasting plate.
 */
const BRAND_LOGO = require("../assets/wordmark.png") as ImageSourcePropType;
const BRAND_LOGO_LIGHT = require("../assets/wordmark-light.png") as ImageSourcePropType;
const BRAND_RATIO = 2149 / 615;

export function BrandMark({
  size = "md",
  align = "flex-start",
  onPress,
}: {
  size?: "sm" | "md" | "lg";
  align?: "flex-start" | "center";
  onPress?: () => void;
}) {
  const { t } = useNaturals();
  const height = size === "lg" ? 46 : size === "sm" ? 24 : 30;
  const dark = t.scheme === "dark";
  const content = (
    <View style={{ alignSelf: align }}>
      <Image
        source={dark ? BRAND_LOGO_LIGHT : BRAND_LOGO}
        accessibilityLabel="Naturals Salon & Wellness"
        resizeMode="contain"
        style={{ height, width: Math.round(height * BRAND_RATIO) }}
      />
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Naturals home" onPress={onPress}>
      {content}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { t } = useNaturals();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: t.border,
          padding: padded ? spacing.lg : 0,
          ...t.cardShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function DemoNote({ children, center }: { children: React.ReactNode; center?: boolean }) {
  const { t } = useNaturals();
  return (
    <Text
      style={{
        fontFamily: fonts.body,
        fontSize: 10,
        lineHeight: 15,
        color: t.muted,
        textAlign: center ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}

export function themeStyles(t: Theme) {
  return StyleSheet.create({
    surface: { backgroundColor: t.surface },
    text: { color: t.ink },
  });
}

/* ============================================================================
 * Futuristic interaction primitives.
 *
 * These build on React Native's built-in Animated API (no new dependencies)
 * so every effect stays smooth on Android, iOS and web.
 * ========================================================================== */

const USE_NATIVE = Platform.OS !== "web";

/** Pressable with a springy scale-down press feedback and hover lift. */
export function AnimatedPressable({
  children,
  onPress,
  style,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  disabled,
  scale = 0.975,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: string;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  disabled?: boolean;
  scale?: number;
}) {
  const press = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(press, { toValue: value, friction: 7, tension: 220, useNativeDriver: USE_NATIVE }).start();

  return (
    <Pressable
      accessibilityRole={accessibilityRole as never}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      style={{ alignSelf: "stretch" }}
    >
      <Animated.View style={[{ transform: [{ scale: press }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Interactive 3D tilt card. On web the card follows the pointer with a real
 * perspective transform plus a soft glare highlight; on touch devices a
 * gentle depth press keeps the effect (continuous tilt tracking conflicts
 * with scroll gestures and costs frame budget). Both paths use the same
 * built-in Animated values, so no new dependencies are involved.
 */
export function TiltCard({
  children,
  style,
  maxTilt = 6,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxTilt?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const isWeb = Platform.OS === "web";
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const glare = useRef(new Animated.Value(0)).current;
  const glareX = useRef(new Animated.Value(50)).current;
  const glareY = useRef(new Animated.Value(30)).current;

  const reset = () => {
    Animated.parallel([
      Animated.timing(rotateX, { toValue: 0, duration: 260, useNativeDriver: isWeb }),
      Animated.timing(rotateY, { toValue: 0, duration: 260, useNativeDriver: isWeb }),
      Animated.timing(glare, { toValue: 0, duration: 260, useNativeDriver: isWeb }),
    ]).start();
  };

  const nativePressIn = () => {
    if (isWeb) return;
    Animated.parallel([
      Animated.timing(rotateX, { toValue: 2.2, duration: 130, useNativeDriver: true }),
      Animated.timing(rotateY, { toValue: -3, duration: 130, useNativeDriver: true }),
    ]).start();
  };
  const nativePressOut = () => {
    if (isWeb) return;
    Animated.parallel([
      Animated.timing(rotateX, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(rotateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const card = (
    <View style={{ flex: 1 }}>
      <Animated.View
        style={[
          style,
          {
            transform: [
              { perspective: 900 } as never,
              { rotateX: rotateX as never },
              { rotateY: rotateY as never },
            ],
          },
        ]}
      >
        {children}
        {isWeb ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: 110,
              left: `${glareX.interpolate({ inputRange: [0, 100], outputRange: [-110, 0] })}%` as never,
              top: `${glareY.interpolate({ inputRange: [0, 100], outputRange: [-110, 0] })}%` as never,
              backgroundColor: "radial-gradient(circle, rgba(255,255,255,0.22), rgba(255,255,255,0) 65%)" as never,
              opacity: glare as never,
            }}
          />
        ) : null}
      </Animated.View>
    </View>
  );

  const handleMove = isWeb
    ? (event: { nativeEvent: { offsetX: number; offsetY: number; layout?: { width: number; height: number } } }) => {
        const layout = event.nativeEvent.layout;
        if (!layout || !layout.width || !layout.height) return;
        const nx = event.nativeEvent.offsetX / layout.width;
        const ny = event.nativeEvent.offsetY / layout.height;
        rotateY.setValue((nx - 0.5) * 2 * maxTilt);
        rotateX.setValue(-(ny - 0.5) * 2 * maxTilt);
        glareX.setValue(nx * 100);
        glareY.setValue(ny * 100);
      }
    : undefined;

  const handleEnter = isWeb
    ? () => {
        glare.setValue(1);
        glareX.setValue(50);
        glareY.setValue(30);
      }
    : undefined;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onHoverIn={handleEnter}
        onHoverOut={isWeb ? reset : undefined}
        onPress={onPress}
        onPressIn={nativePressIn}
        onPressOut={nativePressOut}
        {...(handleMove ? { onMouseMove: handleMove } : null)}
        style={{ flex: 1 }}
      >
        {card}
      </Pressable>
    );
  }

  return (
    <View
      {...({
        onHoverIn: handleEnter,
        onHoverOut: isWeb ? reset : undefined,
        onMouseMove: handleMove,
        onTouchStart: nativePressIn,
        onTouchEnd: nativePressOut,
        onTouchCancel: nativePressOut,
      } as object)}
      style={{ flex: 1 }}
    >
      {card}
    </View>
  );
}

/** Translucent glass panel with a luminous hairline border. */
export function GlassPanel({
  children,
  style,
  padded = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { t } = useNaturals();
  const blur =
    Platform.OS === "web"
      ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as unknown as object)
      : null;
  return (
    <View
      style={[
        {
          backgroundColor: t.glassBg,
          borderWidth: 1,
          borderColor: t.glassBorder,
          borderRadius: radius.xl,
          overflow: "hidden",
        },
        blur,
        padded ? { padding: spacing.lg } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Large ambient glow used behind heroes and section headers. */
export function GlowOrb({ size, color, style }: { size: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useNaturals();
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color ?? t.glowSoft,
          opacity: 0.9,
        },
        style,
      ]}
    />
  );
}

/** Fade-and-rise entrance used for screens and section blocks. */
export function useEntrance(delay = 0) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start();
  }, [progress, delay]);
  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
      },
    ],
  };
}

export function Entrance({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const entrance = useEntrance(delay);
  return <Animated.View style={[entrance as unknown as StyleProp<ViewStyle>, style]}>{children}</Animated.View>;
}

/** Shimmering skeleton bar for loading states. */
export function Skeleton({
  width,
  height = 14,
  radius: corner = 8,
  style,
  tone,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  tone?: string;
}) {
  const { t } = useNaturals();
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE }),
        Animated.timing(pulse, { toValue: 0.45, duration: 760, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius: corner,
          backgroundColor: tone ?? t.surfaceAlt,
          borderWidth: 1,
          borderColor: t.border,
        },
        { opacity: pulse as never },
        style,
      ]}
    />
  );
}

/** Skeleton placeholder shaped like a service card. */
export function ServiceCardSkeleton() {
  const { t, bp } = useNaturals();
  return (
    <View
      style={{
        flex: 1,
        minWidth: bp.isMobile ? "100%" : 260,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
        overflow: "hidden",
      }}
    >
      <Skeleton height={bp.isMobile ? 190 : 210} radius={0} style={{ width: "100%" }} />
      <View style={{ padding: 18, gap: 10 }}>
        <Skeleton width={90} height={12} />
        <Skeleton width="70%" height={22} />
        <Skeleton height={12} />
        <Skeleton height={12} style={{ width: "85%" }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Skeleton width={92} height={30} radius={radius.pill} />
          <Skeleton width={70} height={30} radius={radius.pill} />
        </View>
      </View>
    </View>
  );
}

/** Skeleton placeholder shaped like a list row. */
export function RowSkeleton({ height = 74 }: { height?: number }) {
  const { t } = useNaturals();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.surface,
        marginBottom: 10,
        minHeight: height,
      }}
    >
      <Skeleton width={52} height={52} radius={radius.md} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="80%" height={10} />
      </View>
      <Skeleton width={46} height={14} />
    </View>
  );
}

/** Small pulsing indicator dot for live/active states. */
export function PulseDot({ color, size = 8 }: { color?: string; size?: number }) {
  const { t } = useNaturals();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: USE_NATIVE }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: USE_NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? t.primary,
        opacity: pulse as never,
      }}
    />
  );
}
