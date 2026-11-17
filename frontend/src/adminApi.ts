
import { API_URL, request } from "./http";
import type { Booking, Salon, Service, User } from "./api";

/* ===================== Admin dashboard types ===================== */

export type Campaign = {
  id: number;
  title: string;
  subtitle: string | null;
  description: string;
  image_id: number | null;
  image_url: string | null;
  cta_label: string;
  cta_url: string | null;
  audience: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  position: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type MediaFile = {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  category: string;
  uploaded_by: number | null;
  created_at: string;
};

export type AnalyticsPoint = { date: string; bookings: number; revenue: string };

export type Analytics = {
  total_bookings: number;
  today: number;
  upcoming: number;
  pending: number;
  completed: number;
  cancelled: number;
  revenue: string;
  range_total: number;
  range_pending: number;
  range_completed: number;
  range_cancelled: number;
  range_revenue: string;
  range_start: string | null;
  range_end: string | null;
  trend: AnalyticsPoint[];
  status_breakdown: Array<{ status: string; count: number }>;
  branch_breakdown: Array<{ branch: string; bookings: number }>;
};

export type BranchPrice = {
  id: number;
  service_id: number;
  salon_id: number;
  price: string;
  is_available: boolean;
};

export type BranchService = {
  service_id: number;
  name: string;
  category: string;
  duration_minutes: number;
  base_price: string;
  branch_price: string | null;
  is_available: boolean;
  has_override: boolean;
  is_active: boolean;
};

export type PageContent = {
  id: number;
  key: string;
  value: string;
  content_type: string;
  updated_by: number | null;
  updated_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: number;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string;
  detail: string | null;
  created_at: string;
};

export type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

/** Raw settings returned by the admin/developer endpoints (all values are strings). */
export type AppSettingsFull = {
  promo_banner_enabled: string;
  promo_banner_title: string;
  promo_banner_message: string;
  promo_banner_cta: string;
};

export type Diagnostics = {
  status: string;
  version: string;
  started_at: string;
  server_time: string;
  uptime_seconds: number;
  database_dialect: string;
  developer_mode: boolean;
  counts: Record<string, number>;
  uploads: { files: number; bytes: number; directory: string };
  config: {
    cors_origins: string;
    access_token_minutes: number;
    admin_seed_configured: boolean;
    developer_seed_configured: boolean;
  };
};

/* ===================== Admin request wrappers ===================== */

export function adminRequest<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  return request<T>(path, token, init);
}

/** A gallery/camera asset returned by expo-image-picker on Android and iOS. */
export type NativeUploadFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

/** Web keeps using a real File/Blob; native passes the picker descriptor. */
export type UploadFile = File | Blob | NativeUploadFile;

function appendUpload(form: FormData, file: UploadFile, fallbackName: string) {
  const descriptor = file as NativeUploadFile;
  if (typeof descriptor?.uri === "string" && descriptor.uri) {
    // React Native's FormData understands { uri, name, type } file objects.
    form.append("file", descriptor as unknown as Blob, descriptor.name || fallbackName);
    return;
  }
  if (typeof File !== "undefined" && file instanceof File) {
    form.append("file", file, file.name || fallbackName);
    return;
  }
  form.append("file", file as Blob, fallbackName);
}

export async function uploadMedia(
  token: string | null,
  file: UploadFile,
  category: string,
): Promise<{ media: MediaFile }> {
  const form = new FormData();
  appendUpload(form, file, `upload-${Date.now()}.jpg`);
  form.append("category", category);
  return request<{ media: MediaFile }>("/admin/media/upload", token, {
    method: "POST",
    body: form,
  });
}

export async function replaceMedia(
  token: string | null,
  mediaId: number,
  file: UploadFile,
  category?: string,
): Promise<{ media: MediaFile }> {
  const form = new FormData();
  appendUpload(form, file, `upload-${Date.now()}.jpg`);
  if (category) form.append("category", category);
  return request<{ media: MediaFile }>(`/admin/media/${mediaId}/replace`, token, {
    method: "POST",
    body: form,
  });
}

export function buildImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url}`;
}

/* ===================== Admin mutations ===================== */

export async function fetchAnalytics(token: string, range?: string, start?: string, end?: string): Promise<Analytics> {
  const params = new URLSearchParams();
  if (range) params.set("range", range);
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return request<Analytics>(`/admin/analytics${qs}`, token);
}

export async function fetchAdminBookings(
  token: string,
  filters: {
    date?: string;
    status?: string;
    salon_id?: number;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Booking[]> {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.status) params.set("status", filters.status);
  if (filters.salon_id != null) params.set("salon_id", String(filters.salon_id));
  if (filters.search) params.set("search", filters.search);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return request<Booking[]>(`/admin/bookings${qs}`, token);
}

export async function updateBooking(
  token: string,
  bookingId: number,
  payload: Record<string, unknown>,
): Promise<Booking> {
  return request<Booking>(`/admin/bookings/${bookingId}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteBooking(token: string, bookingId: number): Promise<void> {
  return request<void>(`/admin/bookings/${bookingId}`, token, { method: "DELETE" });
}

export async function fetchSalons(token: string): Promise<Salon[]> {
  return request<Salon[]>(`/admin/salons`, token);
}

export async function createSalon(token: string, payload: Record<string, unknown>): Promise<Salon> {
  return request<Salon>(`/admin/salons`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSalon(token: string, salonId: number, payload: Record<string, unknown>): Promise<Salon> {
  return request<Salon>(`/admin/salons/${salonId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateSalon(token: string, salonId: number): Promise<{ detail: string; salon: Salon }> {
  return request<{ detail: string; salon: Salon }>(`/admin/salons/${salonId}`, token, { method: "DELETE" });
}

export async function fetchAdminServices(token: string, q?: string): Promise<Service[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<Service[]>(`/admin/services${qs}`, token);
}

export async function createService(token: string, payload: Record<string, unknown>): Promise<Service> {
  return request<Service>(`/admin/services`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateService(
  token: string,
  serviceId: number,
  payload: Record<string, unknown>,
): Promise<Service> {
  return request<Service>(`/admin/services/${serviceId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateService(token: string, serviceId: number): Promise<{ detail: string; service: Service }> {
  return request<{ detail: string; service: Service }>(`/admin/services/${serviceId}`, token, { method: "DELETE" });
}

export async function fetchBranchPrices(token: string, serviceId: number): Promise<BranchPrice[]> {
  return request<BranchPrice[]>(`/admin/services/${serviceId}/branch-prices`, token);
}

export async function createBranchPrice(
  token: string,
  serviceId: number,
  payload: { salon_id: number; price: string; is_available?: boolean },
): Promise<BranchPrice> {
  return request<BranchPrice>(`/admin/services/${serviceId}/branch-prices`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBranchPrice(
  token: string,
  serviceId: number,
  salonId: number,
  payload: { price?: string; is_available?: boolean },
): Promise<BranchPrice> {
  return request<BranchPrice>(`/admin/services/${serviceId}/branch-prices/${salonId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBranchPrice(token: string, serviceId: number, salonId: number): Promise<void> {
  return request<void>(`/admin/services/${serviceId}/branch-prices/${salonId}`, token, { method: "DELETE" });
}

export async function fetchBranchServices(token: string, salonId: number, q?: string): Promise<BranchService[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<BranchService[]>(`/admin/salons/${salonId}/services${qs}`, token);
}

export async function updateBranchService(
  token: string,
  salonId: number,
  serviceId: number,
  payload: { price?: string; is_available?: boolean },
): Promise<BranchService> {
  return request<BranchService>(`/admin/salons/${salonId}/services/${serviceId}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchCampaigns(token: string): Promise<Campaign[]> {
  return request<Campaign[]>(`/admin/campaigns`, token);
}

export async function createCampaign(token: string, payload: Record<string, unknown>): Promise<Campaign> {
  return request<Campaign>(`/admin/campaigns`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCampaign(token: string, campaignId: number, payload: Record<string, unknown>): Promise<Campaign> {
  return request<Campaign>(`/admin/campaigns/${campaignId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCampaign(token: string, campaignId: number): Promise<void> {
  return request<void>(`/admin/campaigns/${campaignId}`, token, { method: "DELETE" });
}

export async function fetchContent(token: string): Promise<PageContent[]> {
  return request<PageContent[]>(`/admin/content`, token);
}

export async function updateContent(token: string, key: string, payload: { value: string; content_type?: string }): Promise<PageContent> {
  return request<PageContent>(`/admin/content/${key}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAuditLogs(token: string, limit = 100, offset = 0): Promise<AuditLog[]> {
  return request<AuditLog[]>(`/admin/audit-logs?limit=${limit}&offset=${offset}`, token);
}

export async function fetchUsers(token: string): Promise<StaffUser[]> {
  return request<StaffUser[]>(`/admin/users`, token);
}

export async function updateUserRole(token: string, userId: number, role: string): Promise<User> {
  return request<User>(`/admin/users/${userId}/role`, token, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function completeBooking(token: string, bookingId: number): Promise<Booking> {
  return request<Booking>(`/admin/bookings/${bookingId}/complete`, token, { method: "POST" });
}

export async function fetchPublicContent(): Promise<Record<string, string>> {
  return request<Record<string, string>>(`/public/content`, null);
}

export async function fetchPublicCampaigns(audience?: string): Promise<Campaign[]> {
  const qs = audience ? `?audience=${encodeURIComponent(audience)}` : "";
  return request<Campaign[]>(`/public/campaigns${qs}`, null);
}

export async function fetchAdminSettings(token: string): Promise<{ settings: AppSettingsFull }> {
  return request<{ settings: AppSettingsFull }>(`/admin/settings`, token);
}

export async function updateAdminSettings(
  token: string,
  settings: Record<string, string>,
): Promise<{ settings: AppSettingsFull }> {
  return request<{ settings: AppSettingsFull }>(`/admin/settings`, token, {
    method: "PATCH",
    body: JSON.stringify({ settings }),
  });
}

export async function fetchDiagnostics(token: string): Promise<Diagnostics> {
  return request<Diagnostics>(`/developer/diagnostics`, token);
}
