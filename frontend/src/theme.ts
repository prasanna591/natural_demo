import { Platform } from "react-native";

export type Section = "women" | "men";

export type Theme = {
  section: Section;
  scheme: "light" | "dark";
  label: string;
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkSoft: string;
  muted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  primaryBorder: string;
  accent: string;
  border: string;
  borderStrong: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  navBg: string;
  navBorder: string;
  navActiveBg: string;
  navActiveBorder: string;
  navActiveInk: string;
  inputBg: string;
  scrim: string;
  imageOverlay: string;
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  cardShadow: object;
  /** Translucent glass surface fill used by floating panels and nav. */
  glassBg: string;
  /** Hairline border for glass surfaces. */
  glassBorder: string;
  /** Accent glow colour for luminous highlights. */
  glow: string;
  /** Very soft glow wash for large ambient effects. */
  glowSoft: string;
  /** Gradient end-point colours for luminous buttons and hero art. */
  gradientFrom: string;
  gradientTo: string;
};

export const fonts = {
  display: Platform.select({
    web: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    ios: "Georgia",
    default: "serif",
  }) as string,
  body: Platform.select({
    web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    ios: "System",
    default: "sans-serif",
  }) as string,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
  xxxl: 64,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const womenTheme: Theme = {
  section: "women",
  scheme: "light",
  label: "Naturals Women",
  // Warm ivory surfaces with deep purple accents (the established identity).
  bg: "#FAF7F3",
  bgAlt: "#F5EEF9",
  surface: "#FFFFFF",
  surfaceAlt: "#F7F1FB",
  ink: "#241B2D",
  inkSoft: "#4A3D55",
  muted: "#6B6075",
  primary: "#5B2A83",
  primaryText: "#FFFFFF",
  primarySoft: "#F1E7FA",
  primaryBorder: "#DCC9EC",
  accent: "#B08A5A",
  border: "#ECE3F1",
  borderStrong: "#D9C8E7",
  success: "#1E7A5B",
  successSoft: "#E6F5EF",
  danger: "#B23E54",
  dangerSoft: "#FCEBF0",
  navBg: "#F6F0FB",
  navBorder: "#E2D5EF",
  navActiveBg: "#FFFFFF",
  navActiveBorder: "#D8C2EA",
  navActiveInk: "#5B2A83",
  inputBg: "#FFFFFF",
  scrim: "rgba(32, 18, 43, 0.58)",
  glow: "rgba(91, 42, 131, 0.32)",
  glowSoft: "rgba(91, 42, 131, 0.07)",
  gradientFrom: "#5B2A83",
  gradientTo: "#B08A5A",
  imageOverlay: "rgba(36, 27, 45, 0.18)",
  shadowColor: "#3C1D51",
  shadowOpacity: 0.08,
  shadowRadius: 24,
  cardShadow: {
    shadowColor: "#3C1D51",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  glassBg: "rgba(255, 255, 255, 0.82)",
  glassBorder: "rgba(91, 42, 131, 0.16)",
};

export const menTheme: Theme = {
  section: "men",
  scheme: "dark",
  label: "Naturals Men",
  // Near-black surfaces with warm gold accents (the established identity).
  bg: "#0B0B0D",
  bgAlt: "#111114",
  surface: "#151518",
  surfaceAlt: "#1B1B20",
  ink: "#F5F1E8",
  inkSoft: "#D8D4CC",
  muted: "#A6A1A8",
  primary: "#C9A86A",
  primaryText: "#17140E",
  primarySoft: "rgba(201, 168, 106, 0.12)",
  primaryBorder: "rgba(201, 168, 106, 0.42)",
  accent: "#E6D3A9",
  border: "#29292F",
  borderStrong: "#3A3A42",
  success: "#83C3A4",
  successSoft: "rgba(131, 195, 164, 0.12)",
  danger: "#E7929E",
  dangerSoft: "rgba(231, 146, 158, 0.12)",
  navBg: "#0E121A",
  navBorder: "#252C38",
  navActiveBg: "rgba(201, 168, 106, 0.14)",
  navActiveBorder: "rgba(201, 168, 106, 0.55)",
  navActiveInk: "#E6D3A9",
  inputBg: "#1A1A1F",
  scrim: "rgba(0, 0, 0, 0.7)",
  glow: "rgba(201, 168, 106, 0.42)",
  glowSoft: "rgba(201, 168, 106, 0.10)",
  gradientFrom: "#C9A86A",
  gradientTo: "#E6D3A9",
  imageOverlay: "rgba(0, 0, 0, 0.42)",
  shadowColor: "#000000",
  shadowOpacity: 0.45,
  shadowRadius: 30,
  cardShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 6,
  },
  glassBg: "rgba(13, 12, 18, 0.82)",
  glassBorder: "rgba(201, 168, 106, 0.22)",
};

export const themes: Record<Section, Theme> = {
  women: womenTheme,
  men: menTheme,
};

export type Breakpoint = {
  width: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  gutter: number;
  maxWidth: number;
};

export function breakpointFor(width: number): Breakpoint {
  const isMobile = width < 720;
  const isTablet = width >= 720 && width < 1080;
  const isDesktop = width >= 1080;
  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    gutter: isMobile ? 18 : isTablet ? 28 : 40,
    maxWidth: 1200,
  };
}
