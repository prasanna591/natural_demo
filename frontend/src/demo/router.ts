import type {
  Analytics,
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
import type { DemoState, DemoRequestResult, DemoTokenPayload } from "./types";
import { demoToken, parseDemoToken, DEMO_TOKEN_PREFIX } from "./types";
import { demoStore } from "./store";

const ADMIN_ROLES: DemoTokenPayload["role"][] = ["admin", "developer"];

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function error(message: string, status: number): never {
  throw new ApiError(message, status);
}

function parseBody(init: RequestInit): unknown {
  if (!init.body) return undefined;
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch {
      return init.body;
    }
  }
  return undefined;
}

function parseQuery(url: string): Record<string, string[]> {
  const [, qs] = url.split("?", 2);
  const out: Record<string, string[]> = {};
  if (!qs) return out;
  for (const pair of qs.split("&")) {
    const [k, v] = pair.split("=", 2).map((s) => decodeURIComponent(s));
    if (k == null) continue;
    (out[k] ??= []).push(v ?? "");
  }
  return out;
}

function firstQuery(qs: Record<string, string[]>, key: string): string | undefined {
  const values = qs[key];
  return values && values.length ? values[0] : undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export default class DemoRouter {
  private get state(): DemoState {
    return demoStore.getState();
  }

  private persist() {
    void demoStore.update(() => {});
  }

  private findUser(id: number) {
    return this.state.users.find((u) => u.id === id);
  }

  private authenticate(token: string | null) {
    const payload = parseDemoToken(token);
    if (!payload) error("Sign in to continue.", 401);
    const user = this.findUser(payload.userId);
    if (!user) error("Your session is invalid. Please sign in again.", 401);
    return user;
  }

  private requireAdmin(token: string | null) {
    const payload = parseDemoToken(token);
    if (!payload || !ADMIN_ROLES.includes(payload.role)) error("Administrator access is required.", 403);
    return payload;
  }

  private audit(action: string, entity: string, entity_id: string | number, actorId: number, detail?: string) {
    this.state.auditLogs.push({
      id: this.state.nextIds.auditLog++,
      actor_id: actorId,
      actor_name: this.findUser(actorId)?.name ?? null,
      actor_email: this.findUser(actorId)?.email ?? null,
      actor_role: this.findUser(actorId)?.role ?? null,
      action,
      entity,
      entity_id: String(entity_id),
      detail: detail ?? null,
      created_at: nowIso(),
    });
    this.persist();
  }

  private recomputeSummary(salonId: number): ReviewSummary {
    const rows = this.state.reviews.filter((r) => r.salon_id === salonId && r.is_active);
    const count = rows.length;
    const average = count ? rows.reduce((sum, r) => sum + r.rating, 0) / count : null;
    const summary: ReviewSummary = {
      salon_id: salonId,
      average_rating: average ? Math.round(average * 10) / 10 : null,
      review_count: count,
    };
    this.state.reviewSummaryBySalon[salonId] = summary;
    return summary;
  }

  /* ===================== Admin / developer (all methods) ===================== */
  private adminHandler(method: string, path: string, token: string | null, init: RequestInit): DemoRequestResult {
    const actor = this.requireAdmin(token);
    const body = parseBody(init);
    const qs = parseQuery(path);
    const base = path.split("?")[0];

    if (method === "GET" && base === "/admin/overview") {
      const today = new Date().toISOString().slice(0, 10);
      const total = this.state.bookings.length;
      const todayCount = this.state.bookings.filter((b) => b.date === today && b.status === "confirmed").length;
      return {
        status: 200,
        body: {
          total_bookings: total,
          today: todayCount,
          upcoming: this.state.bookings.filter((b) => b.status === "confirmed" && b.date > today).length,
          completed: this.state.bookings.filter((b) => b.status === "completed").length,
          cancelled: this.state.bookings.filter((b) => b.status === "cancelled").length,
          revenue: "0",
          revenue_rule: "Demo revenue placeholder.",
        },
      };
    }
    if (method === "GET" && base === "/admin/bookings") {
      let rows = clone(this.state.bookings);
      const status = firstQuery(qs, "status");
      const salon_id = firstQuery(qs, "salon_id");
      const search = firstQuery(qs, "search")?.toLowerCase();
      if (status) rows = rows.filter((b) => b.status === status);
      if (salon_id) rows = rows.filter((b) => b.salon.id === Number(salon_id));
      if (search) rows = rows.filter((b) => b.reference.toLowerCase().includes(search) || b.customer_name?.toLowerCase().includes(search));
      return { status: 200, body: rows };
    }
    if (method === "GET" && base === "/admin/analytics") {
      return {
        status: 200,
        body: {
          total_bookings: this.state.bookings.length,
          today: 0,
          upcoming: 0,
          pending: 0,
          completed: 0,
          cancelled: 0,
          revenue: "0",
          range_total: 0,
          range_pending: 0,
          range_completed: 0,
          range_cancelled: 0,
          range_revenue: "0",
          range_start: null,
          range_end: null,
          trend: [],
          status_breakdown: [],
          branch_breakdown: [],
        } as Analytics,
      };
    }
    if (method === "GET" && base === "/admin/services") return { status: 200, body: clone(this.state.services) };
    if (method === "GET" && base === "/admin/salons") return { status: 200, body: clone(this.state.salons) };
    if (method === "GET" && base === "/admin/campaigns") return { status: 200, body: clone(this.state.campaigns) };
    if (method === "POST" && base === "/admin/campaigns") {
      const cb = body as {
        title?: string; subtitle?: string; description?: string; image_id?: number | null; image_url?: string | null;
        cta_label?: string; cta_url?: string | null; audience?: string; start_date?: string | null; end_date?: string | null;
        is_active?: boolean; position?: number;
      };
      const campaign: Campaign = {
        id: this.state.nextIds.campaign++,
        title: cb.title ?? "Untitled campaign",
        subtitle: cb.subtitle ?? null,
        description: cb.description ?? "",
        image_id: cb.image_id ?? null,
        image_url: cb.image_url ?? null,
        cta_label: cb.cta_label ?? "Explore",
        cta_url: cb.cta_url ?? null,
        audience: cb.audience ?? "Everyone",
        start_date: cb.start_date ?? null,
        end_date: cb.end_date ?? null,
        is_active: cb.is_active ?? true,
        position: cb.position ?? 0,
        created_by: actor.userId,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      this.state.campaigns.push(campaign);
      this.audit("create", "campaign", campaign.id, actor.userId);
      return { status: 201, body: campaign };
    }
    const campPatch = base.match(/^\/admin\/campaigns\/(\d+)$/);
    if (campPatch && method === "PATCH") {
      const id = Number(campPatch[1]);
      const campaign = this.state.campaigns.find((c) => c.id === id);
      if (!campaign) error("Campaign not found.", 404);
      Object.assign(campaign, body);
      campaign.updated_at = nowIso();
      this.audit("update", "campaign", id, actor.userId);
      return { status: 200, body: { ...campaign } };
    }
    if (campPatch && method === "DELETE") {
      const id = Number(campPatch[1]);
      const idx = this.state.campaigns.findIndex((c) => c.id === id);
      if (idx === -1) error("Campaign not found.", 404);
      this.state.campaigns.splice(idx, 1);
      this.audit("delete", "campaign", id, actor.userId);
      return { status: 204, body: undefined, noContent: true };
    }
    if (method === "GET" && base === "/admin/media") return { status: 200, body: clone(this.state.media) };
    if (method === "POST" && base === "/admin/media/upload") {
      const media: MediaFile = {
        id: this.state.nextIds.media++,
        filename: `demo-${Date.now()}.png`,
        original_name: (body as { original_name?: string })?.original_name ?? "upload.png",
        mime_type: "image/png",
        size: 0,
        url: `/media/uploads/demo-${Date.now()}.png`,
        category: (body as { category?: string })?.category ?? "general",
        uploaded_by: actor.userId,
        created_at: nowIso(),
      };
      this.state.media.push(media);
      this.audit("upload", "media", media.id, actor.userId);
      return { status: 200, body: { media } };
    }
    if (method === "GET" && base === "/admin/content") return { status: 200, body: clone(this.state.content) };
    if (method === "GET" && base === "/admin/audit-logs") {
      const limit = Number(firstQuery(qs, "limit") ?? 100);
      const offset = Number(firstQuery(qs, "offset") ?? 0);
      return { status: 200, body: clone(this.state.auditLogs.slice().reverse().slice(offset, offset + limit)) };
    }
    if (method === "GET" && base === "/admin/users") {
      return {
        status: 200,
        body: clone(
          this.state.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, is_active: true, created_at: nowIso() })),
        ),
      };
    }
    if (method === "GET" && base === "/admin/reviews") {
      const salon_id = firstQuery(qs, "salon_id");
      const is_active = firstQuery(qs, "is_active");
      let rows = clone(this.state.reviews);
      if (salon_id) rows = rows.filter((r) => r.salon_id === Number(salon_id));
      if (is_active != null) rows = rows.filter((r) => r.is_active === (is_active === "true"));
      return { status: 200, body: rows };
    }
    const reviewMod = base.match(/^\/admin\/reviews\/(\d+)$/);
    if (reviewMod && method === "PATCH") {
      const reviewId = Number(reviewMod[1]);
      const review = this.state.reviews.find((r) => r.id === reviewId);
      if (!review) error("Review not found.", 404);
      const { is_active } = body as { is_active?: boolean };
      if (is_active == null) error("is_active is required.", 400);
      review.is_active = is_active;
      this.audit("moderate", "review", review.id, actor.userId);
      this.recomputeSummary(review.salon_id);
      return { status: 200, body: { ...review } };
    }
    if (method === "GET" && base === "/admin/settings") return { status: 200, body: { settings: { ...this.state.settings } } };
    if (method === "GET" && base === "/developer/diagnostics") {
      return {
        status: 200,
        body: {
          status: "ok",
          version: "1.0.0",
          started_at: nowIso(),
          server_time: nowIso(),
          uptime_seconds: 0,
          database_dialect: "demo",
          developer_mode: this.state.developerMode,
          counts: {
            users: this.state.users.length,
            admins: 1,
            developers: 1,
            bookings: this.state.bookings.length,
            salons: this.state.salons.length,
            services: this.state.services.length,
            campaigns: this.state.campaigns.length,
            media_files: this.state.media.length,
            page_content: this.state.content.length,
            audit_logs: this.state.auditLogs.length,
          },
          uploads: { files: 0, bytes: 0, directory: "demo" },
          config: { cors_origins: "*", access_token_minutes: 1440, admin_seed_configured: true, developer_seed_configured: true },
        } as Diagnostics,
      };
    }
    return { status: 404, body: { detail: `Unknown demo admin endpoint: ${method} ${path}` } };
  }

  /* ===================== main entry ===================== */
  handle(method: string, path: string, token: string | null, init: RequestInit): DemoRequestResult {
    const body = parseBody(init);
    const qs = parseQuery(path);
    const base = path.split("?")[0];

    // Admin/developer routes take priority for all methods.
    if (base.startsWith("/admin/") || base.startsWith("/developer/")) {
      return this.adminHandler(method, path, token, init);
    }

    /* ---------- Public GET ---------- */
    if (method === "GET") {
      if (base === "/services") {
        const salonId = firstQuery(qs, "salon_id");
        let rows = clone(this.state.services);
        if (salonId != null) {
          const sid = Number(salonId);
          const bps = this.state.branchPrices[sid] ?? [];
          rows = rows.filter((s) => s.is_active && bps.some((p) => p.service_id === s.id && p.is_available));
        } else {
          rows = rows.filter((s) => s.is_active);
        }
        return { status: 200, body: rows };
      }
      if (base === "/categories") return { status: 200, body: clone(this.state.categories) };
      if (base === "/salons" && !path.includes("/staff")) {
        return { status: 200, body: clone(this.state.salons.filter((s) => s.is_active)) };
      }
      if (base === "/offers") return { status: 200, body: clone(this.state.offers) };
      if (base === "/app/settings") return { status: 200, body: { ...this.state.settings } };
      if (base === "/public/content") {
        const content: Record<string, string> = {};
        for (const item of this.state.content) content[item.key] = item.value;
        return { status: 200, body: content };
      }
      if (base === "/public/campaigns") {
        const today = new Date().toISOString().slice(0, 10);
        const audience = firstQuery(qs, "audience");
        return {
          status: 200,
          body: clone(
            this.state.campaigns.filter(
              (c) =>
                c.is_active &&
                (!c.start_date || c.start_date <= today) &&
                (!c.end_date || c.end_date >= today) &&
                (!audience || c.audience === "Everyone" || c.audience === audience),
            ),
          ),
        };
      }
      const staffMatch = path.match(/^\/salons\/(\d+)\/staff$/);
      if (staffMatch) {
        const salonId = Number(staffMatch[1]);
        const staff: Stylist[] = [
          { id: 1, name: "Demo stylist 1", title: "Stylist · Demo profile", salon_id: salonId },
          { id: 2, name: "Demo stylist 2", title: "Stylist · Demo profile", salon_id: salonId },
        ];
        return { status: 200, body: staff };
      }
      if (base === "/availability") {
        const salonId = Number(firstQuery(qs, "salon_id"));
        const serviceId = Number(firstQuery(qs, "service_id"));
        const dateStr = firstQuery(qs, "date");
        const service = this.state.services.find((s) => s.id === serviceId);
        const salon = this.state.salons.find((s) => s.id === salonId);
        if (!salon || !service) return { status: 404, body: { detail: "Salon or service not found." } };
        const bp = (this.state.branchPrices[salonId] ?? []).find((p) => p.service_id === serviceId);
        if (!bp || !bp.is_available) return { status: 409, body: { detail: "That service is not available at this branch." } };
        const duration = service.duration_minutes;
        const day = dateStr ?? new Date().toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const now = new Date();
        if (day < today) return { status: 200, body: { date: day, service_duration_minutes: duration, slots: [] } };
        const slots: Slot[] = [];
        let cursor = new Date(`${day}T10:00:00`);
        const closingAt = new Date(`${day}T21:00:00`);
        while (new Date(cursor.getTime() + duration * 60000) <= closingAt) {
          const slotTime = cursor.getHours().toString().padStart(2, "0") + ":" + cursor.getMinutes().toString().padStart(2, "0");
          const slotEnd = new Date(cursor.getTime() + duration * 60000);
          if (day === today && slotEnd <= now) { cursor = slotEnd; continue; }
          const busy = new Set<number>();
          for (const b of this.state.bookings) {
            if (b.salon.id !== salonId || b.service.id !== serviceId || b.status !== "confirmed") continue;
            const bStart = new Date(`${b.date}T${b.start_time}`);
            const bServ = this.state.services.find((s) => s.id === b.service.id);
            const bEnd = new Date(bStart.getTime() + (bServ?.duration_minutes ?? 30) * 60000);
            if (bStart < slotEnd && bEnd > cursor) busy.add(b.stylist.id);
          }
          const available = [
            { id: 1, name: "Demo stylist 1", title: "Stylist · Demo profile", salon_id: salonId },
            { id: 2, name: "Demo stylist 2", title: "Stylist · Demo profile", salon_id: salonId },
          ].filter((s) => !busy.has(s.id));
          if (available.length) slots.push({ time: slotTime, staff: available });
          cursor = slotEnd;
        }
        return { status: 200, body: { date: day, service_duration_minutes: duration, slots } };
      }
      if (base === "/reviews") {
        const salonId = firstQuery(qs, "salon_id");
        const serviceId = firstQuery(qs, "service_id");
        let rows = this.state.reviews.filter((r) => r.is_active);
        if (salonId != null) rows = rows.filter((r) => r.salon_id === Number(salonId));
        if (serviceId != null) rows = rows.filter((r) => r.service_id === Number(serviceId));
        return { status: 200, body: clone(rows) };
      }
      if (base === "/reviews/summary") {
        const salonId = Number(firstQuery(qs, "salon_id"));
        return { status: 200, body: clone(this.state.reviewSummaryBySalon[salonId] ?? { salon_id: salonId, average_rating: null, review_count: 0 }) };
      }
      if (base === "/bookings") {
        const user = this.authenticate(token);
        const rows = this.state.bookings.filter((b) => b.customer_email === user.email);
        return { status: 200, body: clone(rows) };
      }
      return { status: 404, body: { detail: `Unknown demo GET endpoint: ${path}` } };
    }

    /* ---------- Auth / customer POST ---------- */
    if (method === "POST") {
      if (base === "/auth/register") {
        const { name, email, password } = body as { name?: string; email?: string; password?: string };
        if (!name || !email || !password) error("Name, email and password are required.", 400);
        if (this.state.users.find((u) => u.email === email)) error("An account with this email already exists.", 409);
        const id = this.state.nextIds.booking++;
        const user = { id, name, email, role: "customer" as const, passwordHash: password };
        this.state.users.push(user);
        this.audit("create", "user", id, id);
        return {
          status: 201,
          body: { access_token: demoToken("customer", id), token_type: "bearer", user: { id, name, email, role: "customer" } },
        };
      }
      if (base === "/auth/login") {
        const { email, password } = body as { email?: string; password?: string };
        const user = this.state.users.find((u) => u.email === email && u.role === "customer");
        if (!user || user.passwordHash !== password) error("Check your email and password.", 401);
        return { status: 200, body: { access_token: demoToken("customer", user.id), token_type: "bearer", user: { id: user.id, name: user.name, email: user.email, role: user.role } } };
      }
      if (base === "/auth/admin-login") {
        const { identifier, password } = body as { identifier?: string; password?: string };
        const user = this.state.users.find((u) => u.email === identifier && (u.role === "admin" || u.role === "developer"));
        if (!user || user.passwordHash !== password) error("Check your credentials.", 401);
        return { status: 200, body: { access_token: demoToken(user.role, user.id), token_type: "bearer", user: { id: user.id, name: user.name, email: user.email, role: user.role } } };
      }
      if (base === "/reviews") {
        const user = this.authenticate(token);
        const { salon_id, service_id, rating, title, comment } = body as { salon_id?: number; service_id?: number; rating?: number; title?: string; comment?: string };
        if (!salon_id || rating == null) error("Salon and rating are required.", 400);
        const existing = this.state.reviews.find((r) => r.user_id === user.id && r.salon_id === salon_id);
        if (existing) {
          if (!existing.is_active) error("Review is hidden and cannot be resubmitted.", 409);
          existing.rating = rating;
          existing.title = title ?? null;
          existing.comment = comment ?? null;
          existing.service_id = service_id ?? null;
          this.audit("update", "review", existing.id, user.id);
          this.recomputeSummary(salon_id);
          return { status: 201, body: { ...existing } };
        }
        const review: Review = {
          id: this.state.nextIds.review++,
          salon_id,
          service_id: service_id ?? null,
          user_id: user.id,
          rating,
          title: title ?? null,
          comment: comment ?? null,
          is_active: true,
          created_at: nowIso(),
          customer_name: user.name,
        };
        this.state.reviews.push(review);
        this.audit("create", "review", review.id, user.id);
        this.recomputeSummary(salon_id);
        return { status: 201, body: review };
      }
      if (base === "/bookings") {
        const user = this.authenticate(token);
        const { salon_id, service_id, staff_id, date, start_time, offer_code } = body as {
          salon_id?: number; service_id?: number; staff_id?: number; date?: string; start_time?: string; offer_code?: string | null;
        };
        if (!salon_id || !service_id || !start_time) error("Salon, treatment and time are required.", 400);
        const service = this.state.services.find((s) => s.id === service_id);
        const salon = this.state.salons.find((s) => s.id === salon_id);
        if (!salon || !service) error("Salon or service not found.", 404);
        const bp = (this.state.branchPrices[salon_id] ?? []).find((p) => p.service_id === service_id);
        if (!bp || !bp.is_available) error("That service is not available at this branch.", 409);
        const duration = service.duration_minutes;
        const bookingDate = date ?? new Date().toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const now = new Date();
        if (bookingDate < today || (bookingDate === today && new Date(`${bookingDate}T${start_time}`) <= now)) error("Choose a future time.", 409);
        const slotStart = new Date(`${bookingDate}T${start_time}`);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);
        let chosen: number | null = null;
        for (const sid of [1, 2]) {
          const conflict = this.state.bookings.some((b) => {
            if (b.salon.id !== salon_id || b.service.id !== service_id || b.stylist.id !== sid || b.status !== "confirmed") return false;
            const bStart = new Date(`${b.date}T${b.start_time}`);
            const bServ = this.state.services.find((s) => s.id === b.service.id);
            const bEnd = new Date(bStart.getTime() + (bServ?.duration_minutes ?? 30) * 60000);
            return bStart < slotEnd && bEnd > slotStart;
          });
          if (!conflict) { chosen = sid; break; }
        }
        if (chosen == null) error("That time is no longer available. Choose another slot.", 409);
        const booking: Booking = {
          id: this.state.nextIds.booking++,
          reference: `NTL-B${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
          status: "confirmed",
          date: bookingDate,
          start_time,
          end_time: slotEnd.toTimeString().slice(0, 5),
          salon: clone(salon),
          service: clone(service),
          stylist: { id: chosen, name: `Demo stylist ${chosen}`, title: "Stylist · Demo profile", salon_id },
          price: service.price,
          discount: "0.00",
          total: service.price,
          offer_code: offer_code ?? null,
          customer_name: user.name,
          customer_email: user.email,
        };
        this.state.bookings.push(booking);
        this.audit("create", "booking", booking.id, user.id);
        return { status: 201, body: booking };
      }
      const bookingCancel = path.match(/^\/bookings\/(\d+)\/cancel$/);
      if (bookingCancel) {
        const bookingId = Number(bookingCancel[1]);
        const user = this.authenticate(token);
        const booking = this.state.bookings.find((b) => b.id === bookingId);
        if (!booking) error("Booking not found.", 404);
        if (booking.customer_email !== user.email) error("You can only cancel your own booking.", 403);
        booking.status = "cancelled";
        this.audit("cancel", "booking", booking.id, user.id);
        return { status: 200, body: { ...booking } };
      }
      return { status: 404, body: { detail: `Unknown demo POST endpoint: ${path}` } };
    }

    /* ---------- PATCH/PUT/DELETE (customer reviews/bookings) ---------- */
    if (method === "PATCH" || method === "PUT" || method === "DELETE") {
      const reviewPatch = path.match(/^\/reviews\/(\d+)$/);
      if (reviewPatch && method === "PATCH") {
        const reviewId = Number(reviewPatch[1]);
        const user = this.authenticate(token);
        const review = this.state.reviews.find((r) => r.id === reviewId);
        if (!review) error("Review not found.", 404);
        if (review.user_id !== user.id) error("You can only edit your own review.", 403);
        const { rating, title, comment } = body as { rating?: number; title?: string | null; comment?: string | null };
        if (rating != null) review.rating = rating;
        if (title != null) review.title = title;
        if (comment != null) review.comment = comment;
        // is_active intentionally ignored for customers.
        this.audit("update", "review", review.id, user.id);
        this.recomputeSummary(review.salon_id);
        return { status: 200, body: { ...review } };
      }
      const reviewDelete = path.match(/^\/reviews\/(\d+)$/);
      if (reviewDelete && method === "DELETE") {
        const reviewId = Number(reviewDelete[1]);
        const user = this.authenticate(token);
        const review = this.state.reviews.find((r) => r.id === reviewId);
        if (!review) error("Review not found.", 404);
        if (review.user_id !== user.id) error("You can only delete your own review.", 403);
        review.is_active = false;
        this.audit("delete", "review", review.id, user.id);
        this.recomputeSummary(review.salon_id);
        return { status: 204, body: undefined, noContent: true };
      }
      const bookingPut = path.match(/^\/bookings\/(\d+)$/);
      if (bookingPut && method === "PUT") {
        const bookingId = Number(bookingPut[1]);
        const user = this.authenticate(token);
        const booking = this.state.bookings.find((b) => b.id === bookingId);
        if (!booking) error("Booking not found.", 404);
        if (booking.customer_email !== user.email) error("You can only edit your own booking.", 403);
        if (booking.status !== "confirmed") error("Only confirmed bookings can be changed.", 409);
        const { salon_id, service_id, staff_id, date, start_time } = body as {
          salon_id?: number; service_id?: number; staff_id?: number; date?: string; start_time?: string;
        };
        if (salon_id != null) {
          const s = this.state.salons.find((x) => x.id === salon_id);
          if (s) booking.salon = clone(s);
        }
        if (service_id != null) {
          const s = this.state.services.find((x) => x.id === service_id);
          if (s) booking.service = clone(s);
        }
        if (staff_id != null) {
          booking.stylist = { id: staff_id, name: `Demo stylist ${staff_id}`, title: "Stylist · Demo profile", salon_id: booking.salon.id };
        }
        if (date != null) booking.date = date;
        if (start_time != null) booking.start_time = start_time;
        const duration = booking.service.duration_minutes;
        const slotStart = new Date(`${booking.date}T${booking.start_time}`);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);
        booking.end_time = slotEnd.toTimeString().slice(0, 5);
        this.audit("reschedule", "booking", booking.id, user.id);
        return { status: 200, body: { ...booking } };
      }
    }

    return { status: 404, body: { detail: `Unknown demo endpoint: ${method} ${path}` } };
  }
}

let routerInstance: DemoRouter | null = null;
export function demoRequest(method: string, path: string, token: string | null, init: RequestInit): DemoRequestResult {
  if (!routerInstance) routerInstance = new DemoRouter();
  const result = routerInstance.handle(method, path, token, init);
  // Persist in-place mutations made by the router against the store's state.
  void demoStore.update(() => {});
  return result;
}
