import type {
  Analytics,
  AppSettings,
  AuditLog,
  BranchPrice,
  BranchService,
  Campaign,
  Category,
  DeveloperSettings,
  Diagnostics,
  MediaFile,
  Offer,
  PageContent,
  Review,
  ReviewSummary,
  Service,
  Salon,
  Slot,
  Stylist,
  User,
  Booking,
} from "../api";

export type DemoRole = "customer" | "admin" | "developer";

export interface DemoUser {
  id: number;
  name: string;
  email: string;
  role: DemoRole;
  /** Never exposed to the client; used only to verify login in the demo router. */
  passwordHash: string;
}

export interface DemoTokenPayload {
  role: DemoRole;
  userId: number;
}

export interface DemoState {
  users: DemoUser[];
  bookings: Booking[];
  reviews: Review[];
  reviewSummaryBySalon: Record<number, ReviewSummary>;
  services: Service[];
  salons: Salon[];
  campaigns: Campaign[];
  content: PageContent[];
  settings: Record<string, string>;
  developerSettings: DeveloperSettings;
  developerMode: boolean;
  media: MediaFile[];
  auditLogs: AuditLog[];
  offers: Offer[];
  categories: Category[];
  branchPrices: Record<number, BranchPrice[]>; // keyed by service_id
  branchServiceOverrides: Record<string, BranchService>; // keyed by `${salon_id}:${service_id}`
  nextIds: {
    booking: number;
    review: number;
    campaign: number;
    media: number;
    auditLog: number;
  };
}

export interface DemoRequestResult<T = unknown> {
  status: number;
  body: T;
  /** Present when the response has no body (e.g. 204). */
  noContent?: boolean;
}

export const DEMO_TOKEN_PREFIX = "demo";

export function demoToken(role: DemoRole, userId: number): string {
  return `${DEMO_TOKEN_PREFIX}.${role}.${userId}`;
}

export function parseDemoToken(token: string | null): DemoTokenPayload | null {
  if (!token || !token.startsWith(`${DEMO_TOKEN_PREFIX}.`)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, role, userId] = parts;
  if (!(role === "customer" || role === "admin" || role === "developer")) return null;
  const id = Number(userId);
  if (!Number.isFinite(id)) return null;
  return { role: role as DemoRole, userId: id };
}

export const EMPTY_DEMO_STATE: DemoState = {
  users: [],
  bookings: [],
  reviews: [],
  reviewSummaryBySalon: {},
  services: [],
  salons: [],
  campaigns: [],
  content: [],
  settings: {},
  developerSettings: {
    promo_banner_enabled: "false",
    promo_banner_title: "",
    promo_banner_message: "",
    promo_banner_cta: "",
  },
  developerMode: false,
  media: [],
  auditLogs: [],
  offers: [],
  categories: [],
  branchPrices: {},
  branchServiceOverrides: {},
  nextIds: { booking: 1, review: 1, campaign: 1, media: 1, auditLog: 1 },
};

export type DemoSlot = Slot;
