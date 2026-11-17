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
  scheme: "light",
  label: "Naturals Men",
  // Ivory surfaces with olive accents.
  bg: "#F5F1E9",
  bgAlt: "#FAF7EE",
  surface: "#FFFFFF",
  surfaceAlt: "#FFFFFF",
  ink: "#292C25",
  inkSoft: "#77766F",
  muted: "#77766F",
  primary: "#30372D",
  primaryText: "#FFFFFF",
  primarySoft: "rgba(48, 55, 45, 0.12)",
  primaryBorder: "rgba(48, 55, 45, 0.30)",
  accent: "#78836A",
  border: "#E5DED2",
  borderStrong: "#D4CCB8",
  success: "#4A6741",
  successSoft: "rgba(74, 103, 65, 0.12)",
  danger: "#B23E54",
  dangerSoft: "rgba(178, 62, 84, 0.12)",
  navBg: "#F5F1E9",
  navBorder: "#E5DED2",
  navActiveBg: "#FFFFFF",
  navActiveBorder: "#E5DED2",
  navActiveInk: "#30372D",
  inputBg: "#FFFFFF",
  scrim: "rgba(41, 44, 37, 0.5)",
  glow: "rgba(197, 166, 106, 0.3)",
  glowSoft: "rgba(197, 166, 106, 0.07)",
  gradientFrom: "#C5A66A",
  gradientTo: "#78836A",
  imageOverlay: "rgba(41, 44, 37, 0.15)",
  shadowColor: "rgba(0, 0, 0, 0.08)",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  cardShadow: {
    shadowColor: "rgba(0, 0, 0, 0.08)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  glassBg: "rgba(255, 255, 255, 0.85)",
  glassBorder: "rgba(48, 55, 45, 0.12)",
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
