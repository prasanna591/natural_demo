import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL, ApiError, request } from "./http";
import type { Section } from "./theme";

export { API_URL, ApiError, request };
export * from "./adminApi";

export type Category = { id: number; name: string; slug: string };

export type Service = {
  id: number;
  category_id: number;
  category: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
  image_url: string | null;
  audience: string;
  is_active: boolean;
  is_demo: boolean;
};

export type Salon = {
  id: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  opens_at: string;
  closes_at: string;
  image_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  average_rating: number | null;
  review_count: number;
};

export type Stylist = { id: number; name: string; title: string; salon_id: number };
export type Slot = { time: string; staff: Stylist[] };
export type User = { id: number; name: string; email: string; role: string };

export type Booking = {
  id: number;
  reference: string;
  status: string;
  date: string;
  start_time: string;
  end_time: string;
  salon: Salon;
  service: Service;
  stylist: Stylist;
  price: string;
  discount: string;
  total: string;
  offer_code: string | null;
  customer_name: string | null;
  customer_email: string | null;
};

export type Offer = {
  code: string;
  title: string;
  description: string;
  discount_percent: number;
  is_demo: boolean;
};

export type Review = {
  id: number;
  salon_id: number;
  service_id: number | null;
  user_id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string;
  customer_name: string | null;
};

export type ReviewCreate = {
  salon_id: number;
  service_id?: number | null;
  rating: number;
  title?: string | null;
  comment?: string | null;
};

export type ReviewUpdate = {
  rating?: number;
  title?: string | null;
  comment?: string | null;
  is_active?: boolean;
};

export type ReviewSummary = {
  salon_id: number;
  average_rating: number | null;
  review_count: number;
};

export type AppSettings = {
  promo_banner_enabled: boolean;
  promo_banner_title: string;
  promo_banner_message: string;
  promo_banner_cta: string;
};

export type DeveloperSettings = {
  promo_banner_enabled: string;
  promo_banner_title: string;
  promo_banner_message: string;
  promo_banner_cta: string;
};

export type Tab = "Home" | "Explore" | "Salons" | "Bookings" | "Offers" | "Profile" | "About" | "Admin" | "Reviews" | "TryOn";
export type AuthMode = "login" | "register" | "admin" | null;

export async function tokenGet() {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem("naturals-token") ?? null;
  return SecureStore.getItemAsync("naturals-token");
}

export async function tokenSet(value: string | null) {
  if (Platform.OS === "web") {
    if (value) globalThis.localStorage?.setItem("naturals-token", value);
    else globalThis.localStorage?.removeItem("naturals-token");
    return;
  }
  if (value) await SecureStore.setItemAsync("naturals-token", value);
  else await SecureStore.deleteItemAsync("naturals-token");
}

export async function sectionGet(): Promise<Section | null> {
  try {
    const value =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem("naturals-section")
        : await SecureStore.getItemAsync("naturals-section");
    return value === "men" || value === "women" ? value : null;
  } catch {
    return null;
  }
}

export async function sectionSet(value: Section) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem("naturals-section", value);
    return;
  }
  await SecureStore.setItemAsync("naturals-section", value);
}

export function money(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "₹0";
  return `₹${numeric.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Published services keep the numeric price as the listed or starting value.
// The description carries range and "starting" details, so the UI can show a
// friendlier label without a schema change.
export function servicePriceLabel(service: Service) {
  const range = service.description.match(/^Price range: (₹[\d,]+)[–-](₹[\d,]+)\./);
  if (range) return `${range[1]}–${range[2]}`;
  if (service.description.startsWith("Starting price:") || service.description.startsWith("Branch starting price:")) {
    return `From ${money(service.price)}`;
  }
  return money(service.price);
}

export function todayString(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return dateFromIso(value).toLocaleDateString("en-IN", options);
}

export function longDate(value: string) {
  return formatDate(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function timeLabel(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minuteText} ${suffix}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function sectionAudience(section: Section) {
  return section === "men" ? "Men" : "Women";
}

export function serviceInSection(service: Service, section: Section) {
  return service.audience === "Everyone" || service.audience === sectionAudience(section);
}

export function isUpcoming(booking: Booking) {
  if (booking.status !== "confirmed") return false;
  const date = dateFromIso(booking.date);
  const [hour, minute] = booking.start_time.split(":").map(Number);
  date.setHours(hour, minute, 0, 0);
  return date.getTime() >= Date.now();
}

export function sortBookings(rows: Booking[]) {
  return [...rows].sort((a, b) => `${b.date}T${b.start_time}`.localeCompare(`${a.date}T${a.start_time}`));
}

export async function fetchReviews(
  salon_id?: number,
  service_id?: number,
): Promise<Review[]> {
  const params = new URLSearchParams();
  if (salon_id != null) params.set("salon_id", String(salon_id));
  if (service_id != null) params.set("service_id", String(service_id));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return request<Review[]>(`/reviews${qs}`, null);
}

export async function fetchReviewSummary(salon_id: number): Promise<ReviewSummary> {
  return request<ReviewSummary>(`/reviews/summary?salon_id=${salon_id}`, null);
}

export async function createReview(payload: ReviewCreate, token: string): Promise<Review> {
  return request<Review>("/reviews", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReviewApi(
  reviewId: number,
  payload: ReviewUpdate,
  token: string,
): Promise<Review> {
  return request<Review>(`/reviews/${reviewId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteReview(reviewId: number, token: string): Promise<void> {
  return request<void>(`/reviews/${reviewId}`, token, { method: "DELETE" });
}

export async function fetchAdminReviews(
  token: string,
  salon_id?: number,
): Promise<Review[]> {
  const qs = salon_id != null ? `?salon_id=${salon_id}` : "";
  return request<Review[]>(`/admin/reviews${qs}`, token);
}

export async function updateAdminReview(
  reviewId: number,
  payload: ReviewUpdate,
  token: string,
): Promise<Review> {
  return request<Review>(`/admin/reviews/${reviewId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminReview(reviewId: number, token: string): Promise<void> {
  return request<void>(`/admin/reviews/${reviewId}`, token, { method: "DELETE" });
}

export function ratingStars(rating: number | null): { filled: number; empty: number } | null {
  if (rating == null) return null;
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return { filled, empty: 5 - filled };
}

export function ratingLabel(rating: number | null, count: number): string {
  if (rating == null) return "No reviews yet";
  return `${rating.toFixed(1)} (${count} ${count === 1 ? "review" : "reviews"})`;
}

export function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
