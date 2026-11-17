import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_DEMO_STATE, DemoState, DemoUser } from "./types";
import type { ReviewSummary } from "../api";
import snapshot from "./data.json";

const STORAGE_KEY = "naturals-demo-state";

type SnapshotBody = { status: number; body: unknown };

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function snapshotBody(path: string): unknown {
  const entry = (snapshot as Record<string, SnapshotBody>)[path];
  return entry ? entry.body : undefined;
}

function seedFromSnapshot(): DemoState {
  const state: DemoState = JSON.parse(JSON.stringify(EMPTY_DEMO_STATE));
  const services = asArray(snapshotBody("/services"));
  if (services.length) state.services = services as DemoState["services"];
  const salons = asArray(snapshotBody("/salons"));
  if (salons.length) state.salons = salons as DemoState["salons"];
  const categories = asArray(snapshotBody("/categories"));
  if (categories.length) state.categories = categories as DemoState["categories"];
  const offers = asArray(snapshotBody("/offers"));
  if (offers.length) state.offers = offers as DemoState["offers"];
  const campaigns = asArray(snapshotBody("/public/campaigns"));
  if (campaigns.length) state.campaigns = campaigns as DemoState["campaigns"];
  const content = snapshotBody("/public/content");
  if (content && typeof content === "object") state.content = Object.entries(content as Record<string, unknown>).map(([key, value]) => ({
    id: 0,
    key,
    value: String(value),
    content_type: "text",
    updated_by: null,
    updated_at: new Date().toISOString(),
  }));
  const settings = snapshotBody("/app/settings");
  if (settings && typeof settings === "object") state.settings = settings as Record<string, string>;
  // Ensure every active service is bookable at every active salon in demo mode.
  const branchPrices: Record<number, DemoState["branchPrices"][number]> = {};
  for (const salon of state.salons) {
    const rows: DemoState["branchPrices"][number] = [];
    for (const service of state.services) {
      if (service.is_active) {
        rows.push({ id: 0, service_id: service.id, salon_id: salon.id, price: service.price, is_available: true });
      }
    }
    branchPrices[salon.id] = rows;
  }
  state.branchPrices = branchPrices;
  const reviews = asArray(snapshotBody("/reviews"));
  if (reviews.length) state.reviews = reviews as DemoState["reviews"];
  const bookings = asArray(snapshotBody("/bookings"));
  if (bookings.length) state.bookings = bookings as DemoState["bookings"];
  const summary = snapshotBody("/reviews/summary");
  if (summary && typeof summary === "object") {
    const s = summary as { salon_id?: number };
    if (typeof s.salon_id === "number") {
      state.reviewSummaryBySalon[s.salon_id] = summary as ReviewSummary;
    }
  }
  // Advance id cursors past seeded data so new records never collide.
  const maxBy = (arr: { id: number }[], def: number) => (arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : def);
  state.nextIds.booking = maxBy(state.bookings, state.nextIds.booking);
  state.nextIds.review = maxBy(state.reviews, state.nextIds.review);
  state.nextIds.campaign = maxBy(state.campaigns, state.nextIds.campaign);
  state.nextIds.media = maxBy(state.media, state.nextIds.media);
  state.nextIds.auditLog = maxBy(state.auditLogs, state.nextIds.auditLog);

  // Seed demo users so documented credentials work offline.
  state.users = [
    { id: 1, name: "Naturals Admin", email: "admin@naturals.example", role: "admin", passwordHash: "Admin@123" },
    { id: 2, name: "Naturals Developer", email: "developer@naturals.example", role: "developer", passwordHash: "Dev@123" },
    { id: 3, name: "Demo Customer", email: "demo@naturals.example", role: "customer", passwordHash: "Demo@123" },
  ];
  return state;
}

export class DemoStore {
  private state: DemoState;
  private listeners: Array<(state: DemoState) => void> = [];
  private hydrated = false;

  constructor() {
    this.state = seedFromSnapshot();
  }

  async hydrate(): Promise<DemoState> {
    if (this.hydrated) return this.state;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DemoState>;
        this.state = { ...EMPTY_DEMO_STATE, ...parsed };
      } else {
        this.state = seedFromSnapshot();
        await this.persist(this.state);
      }
    } catch {
      this.state = seedFromSnapshot();
    }
    this.hydrated = true;
    return this.state;
  }

  getState(): DemoState {
    return this.state;
  }

  async update(transformer: (draft: DemoState) => void): Promise<DemoState> {
    transformer(this.state);
    await this.persist(this.state);
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  private async persist(state: DemoState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // AsyncStorage unavailable in some environments; keep in-memory state.
    }
  }

  async resetDemo(): Promise<DemoState> {
    this.state = seedFromSnapshot();
    await this.persist(this.state);
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  subscribe(listener: (state: DemoState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const demoStore = new DemoStore();
