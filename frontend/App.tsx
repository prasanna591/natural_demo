import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, Platform, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Analytics,
  ApiError,
  AppSettings,
  AppSettingsFull,
  AuditLog,
  Booking,
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
  ReviewCreate,
  ReviewSummary,
  ReviewUpdate,
  Salon,
  Service,
  Slot,
  StaffUser,
  Stylist,
  Tab,
  UploadFile,
  User,
  buildImageUrl,
  createReview,
  deleteReview as deleteReviewApi,
  fetchAdminReviews,
  fetchAdminSettings,
  fetchBranchServices,
  fetchDiagnostics,
  fetchReviewSummary,
  fetchReviews,
  fetchPublicCampaigns,
  fetchPublicContent,
  isUpcoming,
  ratingLabel,
  ratingStars,
  replaceMedia,
  request,
  sectionAudience,
  sectionGet,
  sectionSet,
  serviceInSection,
  sortBookings,
  tokenGet,
  tokenSet,
  todayString,
  updateAdminReview,
  updateAdminSettings,
  updateBranchService,
  updateReviewApi,
  deleteAdminReview,
  uploadMedia,
} from "./src/api";
import { useNaturals, NaturalsContext, type DialogState, type ToastState, type NaturalsContextValue, type CampaignFormFields, type SalonFormFields, type ServiceFormFields } from "./src/context";
import { BottomNav, Footer, Header, PageShell, bottomNavSpace } from "./src/layout";
import { DialogModal, LoadingScreen, ServiceDetailModal, ToastView } from "./src/modals";
import { ErrorBoundary } from "./src/ErrorBoundary";
import { AdminScreen } from "./src/screens/Admin";
import { AuthScreen } from "./src/screens/Auth";
import { BookingScreen, BookingSelectionBar } from "./src/screens/Booking";
import { TryOnScreen } from "./src/screens/TryOn";
import { AboutScreen } from "./src/screens/About";
import { BookingsScreen } from "./src/screens/Bookings";
import { ExploreScreen } from "./src/screens/Explore";
import { HomeScreen } from "./src/screens/Home";
import { LandingScreen } from "./src/screens/LandingScreen";
import { OffersScreen } from "./src/screens/Offers";
import { ProfileScreen } from "./src/screens/Profile";
import { ReviewsScreen } from "./src/screens/Reviews";
import { SalonsScreen } from "./src/screens/Salons";
import { breakpointFor, themes, type Section } from "./src/theme";
import { ErrorNote } from "./src/ui";

/**
 * Snapshot stored on each browser history entry so the web Back button can
 * restore the exact in-app screen (tab + back-stack) instead of dumping the
 * user on a blank page or an unrelated earlier route.
 */
type BrowserNavState = {
  __naturals: true;
  epoch: number;
  tab: Tab;
  stack: Tab[];
};

const APP_TABS: Tab[] = ["Home", "Explore", "Salons", "Bookings", "Offers", "Profile", "About", "Admin", "Reviews", "TryOn"];

function isTab(value: unknown): value is Tab {
  return typeof value === "string" && (APP_TABS as string[]).includes(value);
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  promo_banner_enabled: false,
  promo_banner_title: "Your next ritual, made special",
  promo_banner_message: "Browse treatments and find a time that works for you.",
  promo_banner_cta: "Explore offers",
};

const DEFAULT_DEVELOPER_SETTINGS: DeveloperSettings = {
  promo_banner_enabled: "false",
  promo_banner_title: DEFAULT_APP_SETTINGS.promo_banner_title,
  promo_banner_message: DEFAULT_APP_SETTINGS.promo_banner_message,
  promo_banner_cta: DEFAULT_APP_SETTINGS.promo_banner_cta,
};

const DEFAULT_ADMIN_SETTINGS: AppSettingsFull = {
  promo_banner_enabled: "false",
  promo_banner_title: DEFAULT_APP_SETTINGS.promo_banner_title,
  promo_banner_message: DEFAULT_APP_SETTINGS.promo_banner_message,
  promo_banner_cta: DEFAULT_APP_SETTINGS.promo_banner_cta,
};

function rankForSection(service: Service, section: Section) {
  const name = service.name.toLowerCase();
  if (section === "men") {
    if (service.category === "Men's grooming") return 0;
    if (name.includes("haircut") || name.includes("cut")) return 1;
    if (name.includes("facial") || name.includes("skin")) return 2;
    if (name.includes("massage") || name.includes("body")) return 3;
    return 4;
  }
  if (name.includes("spa")) return 0;
  if (name.includes("haircut") || name.includes("cut")) return 1;
  if (name.includes("facial") || name.includes("skin")) return 2;
  if (name.includes("bridal")) return 3;
  if (name.includes("massage") || name.includes("body")) return 4;
  return 5;
}

function AppContent() {
  const { width } = useWindowDimensions();
  const bp = useMemo(() => breakpointFor(width), [width]);

  const [section, setSectionState] = useState<Section>("women");
  const t = themes[section];

  const [tab, setTab] = useState<Tab>("Home");

  /**
   * Navigation history.
   *
   * The app uses a single active `tab` value. Without a history stack every
   * navigation collapsed into that one value, so the hardware back button had
   * no choice but to jump to Home. `navHistory` keeps the tabs the guest came
   * from, which lets Back retrace the real path (Services -> Bookings -> Back
   * returns to Services) and keeps repeated navigations from stacking
   * duplicate entries. `tabRef` mirrors `tab` synchronously so navigation
   * helpers always read the tab that is actually on screen.
   */
  const navHistory = useRef<Tab[]>([]);
  const tabRef = useRef<Tab>("Home");
  // Bumped whenever the in-app stack is reset (section switch, logout, session
  // restore). Older browser entries carry a different epoch and are ignored so
  // Back can never resurrect a screen from before the reset.
  const epochRef = useRef(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [tabPressNonce, setTabPressNonce] = useState(0);

  const applyTab = useCallback((nextTab: Tab) => {
    tabRef.current = nextTab;
    setTab(nextTab);
    setCanGoBack(navHistory.current.length > 0 || nextTab !== "Home");
  }, []);

  const browserState = useCallback((): BrowserNavState => ({
    __naturals: true,
    epoch: epochRef.current,
    tab: tabRef.current,
    stack: [...navHistory.current],
  }), []);

  // Replace the current browser entry (used for the initial seed and whenever
  // the in-app stack is reset). Pushing instead would grow history for actions
  // that are not navigations.
  const replaceBrowserEntry = useCallback(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.history) return;
    try {
      window.history.replaceState(browserState(), "");
    } catch {
      // History can be unavailable in sandboxed webviews; in that case the app
      // still works because navigation is driven by the in-app stack.
    }
  }, [browserState]);

  const pushBrowserEntry = useCallback(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.history) return;
    try {
      window.history.pushState(browserState(), "");
    } catch {
      // See replaceBrowserEntry: browser sync is a progressive enhancement.
    }
  }, [browserState]);

  const resetNavigation = useCallback(() => {
    navHistory.current = [];
    applyTab("Home");
    epochRef.current += 1;
    replaceBrowserEntry();
  }, [applyTab, replaceBrowserEntry]);

  const [showLanding, setShowLanding] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Mobile browsers keep the layout viewport at full height when the on-screen
  // keyboard opens, which can leave form buttons (like the sign-in submit)
  // hidden behind the keyboard with no way to scroll to them. Tracking the
  // visual viewport lets the shell shrink with the keyboard so every form
  // stays scrollable and its actions remain reachable.
  const [visualHeight, setVisualHeight] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const viewport = (globalThis as { visualViewport?: VisualViewport }).visualViewport;
    if (!viewport) return;
    const sync = () => setVisualHeight(Math.round(viewport.height));
    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, []);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [publicContent, setPublicContent] = useState<Record<string, string>>({});
  const [publicCampaigns, setPublicCampaigns] = useState<Campaign[]>([]);
  const [staffBySalon, setStaffBySalon] = useState<Record<number, Stylist[]>>({});
  const [branchServices, setBranchServices] = useState<Service[]>([]);
  const [branchServicesLoading, setBranchServicesLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [authMode, setAuthMode] = useState<"login" | "register" | "admin" | null>(null);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [editingName, setEditingName] = useState("");

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(0);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [salonId, setSalonId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState(todayString(1));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [staffId, setStaffId] = useState<number | null>(null);
  const [offerCode, setOfferCode] = useState("");

  const [lastConfirmed, setLastConfirmed] = useState<Booking | null>(null);

  const [adminStats, setAdminStats] = useState<Record<string, string | number> | null>(null);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
  const [adminServiceName, setAdminServiceName] = useState("");
  const [adminServicePrice, setAdminServicePrice] = useState("");
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);
  const [developerSettings, setDeveloperSettings] = useState<DeveloperSettings>(DEFAULT_DEVELOPER_SETTINGS);
  const [adminSettings, setAdminSettings] = useState<AppSettingsFull>({ ...DEFAULT_ADMIN_SETTINGS });
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  /* Dashboard state */
  const [adminSection, setAdminSection] = useState<"overview" | "appointments" | "services" | "branches" | "campaigns" | "media" | "content" | "audit" | "reviews" | "developer">("overview");

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsQuery = useRef<{ range?: string; start?: string; end?: string }>({ range: "month" });

  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsFilters, setBookingsFilters] = useState<{
    date?: string;
    status?: string;
    salon_id?: number;
    search?: string;
  }>({});

  const setBookingsFilter = useCallback((key: "date" | "status" | "salon_id" | "search", value: string | undefined) => {
    setBookingsFilters((current) => {
      if (key === "salon_id") {
        const numeric = value ? Number(value) : NaN;
        return { ...current, salon_id: Number.isFinite(numeric) ? numeric : undefined };
      }
      return { ...current, [key]: value };
    });
  }, []);

  const [adminServices, setAdminServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceForm, setServiceFormState] = useState<{
    category_id: number;
    name: string;
    description: string;
    duration_minutes: string;
    price: string;
    image_url: string;
    audience: string;
    is_active: boolean;
  }>({
    category_id: 1,
    name: "",
    description: "",
    duration_minutes: "45",
    price: "",
    image_url: "",
    audience: "Everyone",
    is_active: true,
  });
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [branchPrices, setBranchPrices] = useState<Record<number, BranchPrice[]>>({});
  const [branchServiceRows, setBranchServiceRows] = useState<BranchService[]>([]);
  const [branchServiceRowsLoading, setBranchServiceRowsLoading] = useState(false);

  const [adminSalons, setAdminSalons] = useState<Salon[]>([]);
  const [salonsLoading, setSalonsLoading] = useState(false);
  const [salonForm, setSalonFormState] = useState<{
    name: string;
    city: string;
    address: string;
    phone: string;
    opens_at: string;
    closes_at: string;
    image_url: string;
    is_active: boolean;
  }>({
    name: "",
    city: "",
    address: "",
    phone: "",
    opens_at: "10:00",
    closes_at: "21:00",
    image_url: "",
    is_active: true,
  });
  const [editingSalon, setEditingSalon] = useState<Salon | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignForm, setCampaignFormState] = useState<{
    title: string;
    subtitle: string;
    description: string;
    image_url: string;
    cta_label: string;
    cta_url: string;
    audience: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    position: number;
  }>({
    title: "",
    subtitle: "",
    description: "",
    image_url: "",
    cta_label: "Explore",
    cta_url: "",
    audience: "Everyone",
    start_date: "",
    end_date: "",
    is_active: true,
    position: 0,
  });
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const [media, setMedia] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaCategory, setMediaCategory] = useState("service");

  const [content, setContent] = useState<PageContent[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  /* Reviews */
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [adminReviews, setAdminReviews] = useState<Review[]>([]);
  const [adminReviewsLoading, setAdminReviewsLoading] = useState(false);

  const [toast, setToast] = useState<ToastState>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4400);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const clearError = useCallback(() => setError(""), []);
  const ask = useCallback((next: Exclude<DialogState, null>) => setDialog(next), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const loadPublic = useCallback(async () => {
    const [serviceRows, categoryRows, salonRows, offerRows, publicSettings, contentRows, campaignRows] = await Promise.all([
      request<Service[]>("/services", null),
      request<Category[]>("/categories", null),
      request<Salon[]>("/salons", null),
      request<Offer[]>("/offers", null).catch(() => [] as Offer[]),
      request<AppSettings>("/app/settings", null),
      fetchPublicContent().catch(() => ({}) as Record<string, string>),
      fetchPublicCampaigns().catch(() => [] as Campaign[]),
    ]);
    setServices(serviceRows);
    setCategories(categoryRows);
    setSalons(salonRows);
    setOffers(offerRows);
    setAppSettings(publicSettings);
    setPublicContent(contentRows);
    setPublicCampaigns(campaignRows);
    setSalonId((current) => current ?? salonRows.find((salon) => !salon.is_demo)?.id ?? salonRows[0]?.id ?? null);

    const pairs = await Promise.all(
      salonRows.map(async (salon) => {
        const people = await request<Stylist[]>(`/salons/${salon.id}/staff`, null).catch(() => [] as Stylist[]);
        return [salon.id, people] as const;
      }),
    );
    const staffMap: Record<number, Stylist[]> = {};
    pairs.forEach(([id, people]) => {
      staffMap[id] = people;
    });
    setStaffBySalon(staffMap);
  }, []);

  const loadBookings = useCallback(async (activeToken: string) => {
    return request<Booking[]>("/bookings", activeToken);
  }, []);

  const loadBranchServices = useCallback(async (targetSalonId?: number | null) => {
    const id = targetSalonId ?? salonId;
    if (!id) {
      setBranchServices([]);
      return;
    }
    setBranchServicesLoading(true);
    try {
      const rows = await request<Service[]>(`/services?salon_id=${id}`, null);
      setBranchServices(rows);
    } catch (reason) {
      setBranchServices([]);
      setError(messageOf(reason, "Could not load branch-specific treatments."));
    } finally {
      setBranchServicesLoading(false);
    }
  }, [salonId]);

  const loadAdmin = useCallback(async () => {
    if (!token) return;
    try {
      const [stats, rows] = await Promise.all([
        request<Record<string, string | number>>("/admin/overview", token),
        request<Booking[]>("/admin/bookings", token),
      ]);
      setAdminStats(stats);
      setAdminBookings(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load the admin dashboard."));
    }
  }, [token]);

  const loadDeveloperSettings = useCallback(async () => {
    if (!token) return;
    try {
      const mode = await request<{ enabled: boolean }>("/developer/mode", token);
      setDeveloperModeEnabled(mode.enabled);
      if (mode.enabled) {
        const result = await request<{ settings: DeveloperSettings }>("/developer/settings", token);
        setDeveloperSettings(result.settings);
      }
    } catch (reason) {
      setError(messageOf(reason, "Could not load developer settings."));
    }
  }, [token]);

  const setDeveloperMode = useCallback(async (enabled: boolean) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const mode = await request<{ enabled: boolean }>("/developer/mode", token, {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      setDeveloperModeEnabled(mode.enabled);
      if (mode.enabled) {
        const result = await request<{ settings: DeveloperSettings }>("/developer/settings", token);
        setDeveloperSettings(result.settings);
      }
      notify(mode.enabled ? "Developer Mode enabled." : "Developer Mode disabled.");
    } catch (reason) {
      setError(messageOf(reason, "Could not change Developer Mode."));
    } finally {
      setBusy(false);
    }
  }, [token, notify]);

  const saveDeveloperSettings = useCallback(async () => {
    if (!token || !developerModeEnabled) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ settings: DeveloperSettings }>("/developer/settings", token, {
        method: "PATCH",
        body: JSON.stringify({ settings: developerSettings }),
      });
      setDeveloperSettings(result.settings);
      await loadPublic();
      notify("Application settings saved.");
    } catch (reason) {
      setError(messageOf(reason, "Could not save application settings."));
    } finally {
      setBusy(false);
    }
  }, [token, developerModeEnabled, developerSettings, loadPublic, notify]);

  /* ===================== Analytics ===================== */
  const loadAnalytics = useCallback(
    async (range?: string, start?: string, end?: string) => {
      if (!token) return;
      if (range) analyticsQuery.current = { range, start, end };
      const query = analyticsQuery.current;
      setAnalyticsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query.range) params.set("range", query.range);
        if (query.start) params.set("start", query.start);
        if (query.end) params.set("end", query.end);
        const qs = params.toString() ? `?${params.toString()}` : "";
        const result = await request<Analytics>(`/admin/analytics${qs}`, token);
        setAnalytics(result);
      } catch (reason) {
        setError(messageOf(reason, "Could not load booking analytics."));
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [token],
  );

  /* ===================== Appointments ===================== */
  const loadAdminBookings = useCallback(async () => {
    if (!token) return;
    setBookingsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (bookingsFilters.date) params.set("date", bookingsFilters.date);
      if (bookingsFilters.status) params.set("status", bookingsFilters.status);
      if (bookingsFilters.salon_id != null) params.set("salon_id", String(bookingsFilters.salon_id));
      if (bookingsFilters.search) params.set("search", bookingsFilters.search);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const rows = await request<Booking[]>(`/admin/bookings${qs}`, token);
      setAdminBookings(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load appointments."));
    } finally {
      setBookingsLoading(false);
    }
  }, [token, bookingsFilters]);

  const saveBooking = useCallback(
    async (bookingId: number, payload: Record<string, unknown>) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const updated = await request<Booking>(
          `/admin/bookings/${bookingId}`,
          token,
          { method: "PUT", body: JSON.stringify(payload) },
        );
        setAdminBookings((current) =>
          current.map((b) => (b.id === updated.id ? updated : b)),
        );
        setAnalytics(null);
        notify("Appointment updated.");
      } catch (reason) {
        setError(messageOf(reason, "Could not update this appointment."));
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  const removeBooking = useCallback(
    async (bookingId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<void>(`/admin/bookings/${bookingId}`, token, { method: "DELETE" });
        setAdminBookings((current) => current.filter((b) => b.id !== bookingId));
        setAnalytics(null);
        notify("Appointment deleted.");
      } catch (reason) {
        setError(messageOf(reason, "Could not delete this appointment."));
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  /* ===================== Services ===================== */
  const loadAdminServices = useCallback(async () => {
    if (!token) return;
    setServicesLoading(true);
    setError("");
    try {
      const rows = await request<Service[]>(`/admin/services`, token);
      setAdminServices(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load services."));
    } finally {
      setServicesLoading(false);
    }
  }, [token]);

  const setServiceForm = useCallback((key: keyof ServiceFormFields, value: string | boolean) => {
    setServiceFormState((current) => ({
      ...current,
      [key]: key === "category_id" ? Number(value) || current.category_id : value,
    }));
  }, []);

  const saveService = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        category_id: serviceForm.category_id,
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim(),
        duration_minutes: Number(serviceForm.duration_minutes),
        price: Number(serviceForm.price),
        image_url: serviceForm.image_url.trim() || undefined,
        audience: serviceForm.audience,
        is_active: serviceForm.is_active,
      };
      let result: Service;
      if (editingService) {
        result = await request<Service>(
          `/admin/services/${editingService.id}`,
          token,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setAdminServices((current) =>
          current.map((s) => (s.id === result.id ? result : s)),
        );
        notify("Service updated.");
      } else {
        result = await request<Service>(`/admin/services`, token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setAdminServices((current) => [result, ...current]);
        notify("Service created and added to the catalogue.");
      }
      setEditingService(null);
      resetServiceForm();
      await loadPublic();
      if (salonId) await loadBranchServices(salonId);
    } catch (reason) {
      setError(messageOf(reason, "Could not save this service."));
    } finally {
      setBusy(false);
    }
  }, [token, serviceForm, editingService, notify, loadPublic, salonId, loadBranchServices]);

  const resetServiceForm = useCallback(() => {
    setServiceFormState({
      category_id: 1,
      name: "",
      description: "",
      duration_minutes: "45",
      price: "",
      image_url: "",
      audience: "Everyone",
      is_active: true,
    });
  }, []);

  const editService = useCallback((service: Service) => {
    setEditingService(service);
    setServiceFormState({
      category_id: service.category_id,
      name: service.name,
      description: service.description,
      duration_minutes: String(service.duration_minutes),
      price: String(service.price),
      image_url: service.image_url ?? "",
      audience: service.audience,
      is_active: service.is_active,
    });
  }, []);

  const clearServiceEdit = useCallback(() => {
    setEditingService(null);
    resetServiceForm();
  }, [resetServiceForm]);

  const deleteService = useCallback(
    async (serviceId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<void>(`/admin/services/${serviceId}`, token, { method: "DELETE" });
        setAdminServices((current) => current.filter((s) => s.id !== serviceId));
        if (editingService?.id === serviceId) clearServiceEdit();
        await loadPublic();
        if (salonId) await loadBranchServices(salonId);
        notify("Service deactivated.");
      } catch (reason) {
        setError(messageOf(reason, "Could not deactivate this service."));
      } finally {
        setBusy(false);
      }
    },
    [token, editingService, clearServiceEdit, loadPublic, salonId, loadBranchServices, notify],
  );

  /* ===================== Branch prices ===================== */
  const loadBranchPrices = useCallback(async (serviceId: number) => {
    if (!token) return;
    setError("");
    try {
      const rows = await request<BranchPrice[]>(`/admin/services/${serviceId}/branch-prices`, token);
      setBranchPrices((current) => ({ ...current, [serviceId]: rows }));
    } catch (reason) {
      setError(messageOf(reason, "Could not load branch prices."));
    }
  }, [token]);

  const saveBranchPrice = useCallback(
    async (serviceId: number, salonId: number, price: string, isAvailable = true) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const existing = branchPrices[serviceId]?.find((p) => p.salon_id === salonId);
        let result: BranchPrice;
        if (existing) {
          result = await request<BranchPrice>(
            `/admin/services/${serviceId}/branch-prices/${salonId}`,
            token,
            { method: "PATCH", body: JSON.stringify({ price, is_available: isAvailable }) },
          );
        } else {
          result = await request<BranchPrice>(
            `/admin/services/${serviceId}/branch-prices`,
            token,
            { method: "POST", body: JSON.stringify({ salon_id: salonId, price, is_available: isAvailable }) },
          );
        }
        setBranchPrices((current) => {
          const rows = existing
            ? current[serviceId]?.map((p) => (p.id === result.id ? result : p)) ?? []
            : [...(current[serviceId] ?? []), result];
          return { ...current, [serviceId]: rows };
        });
        await loadPublic();
        notify("Branch price saved.");
      } catch (reason) {
        setError(messageOf(reason, "Could not save branch price."));
      } finally {
        setBusy(false);
      }
    },
    [token, branchPrices, loadPublic, notify],
  );

  const removeBranchPrice = useCallback(
    async (serviceId: number, salonId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<void>(
          `/admin/services/${serviceId}/branch-prices/${salonId}`,
          token,
          { method: "DELETE" },
        );
        setBranchPrices((current) => {
          const rows = (current[serviceId] ?? []).filter((p) => p.salon_id !== salonId);
          return { ...current, [serviceId]: rows };
        });
        notify("Branch price removed.");
      } catch (reason) {
        setError(messageOf(reason, "Could not remove branch price."));
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  /* ===================== Branch service availability ===================== */
  const loadBranchServiceRows = useCallback(
    async (targetSalonId: number, search?: string) => {
      if (!token || !targetSalonId) return;
      setBranchServiceRowsLoading(true);
      setError("");
      try {
        const rows = await fetchBranchServices(token, targetSalonId, search?.trim() || undefined);
        setBranchServiceRows(rows);
      } catch (reason) {
        setBranchServiceRows([]);
        setError(messageOf(reason, "Could not load branch services."));
      } finally {
        setBranchServiceRowsLoading(false);
      }
    },
    [token],
  );

  const saveBranchServiceRow = useCallback(
    async (
      targetSalonId: number,
      targetServiceId: number,
      payload: { price?: string; is_available?: boolean },
    ) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const result = await updateBranchService(token, targetSalonId, targetServiceId, payload);
        setBranchServiceRows((current) =>
          current.map((row) => (row.service_id === result.service_id ? result : row)),
        );
        await loadBranchServices(targetSalonId);
        await loadPublic();
        notify("Branch service updated.");
      } catch (reason) {
        setError(messageOf(reason, "Could not update this branch service."));
      } finally {
        setBusy(false);
      }
    },
    [token, loadBranchServices, loadPublic, notify],
  );

  /* ===================== Salons / branches ===================== */
  const loadAdminSalons = useCallback(async () => {
    if (!token) return;
    setSalonsLoading(true);
    setError("");
    try {
      const rows = await request<Salon[]>(`/admin/salons`, token);
      setAdminSalons(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load branches."));
    } finally {
      setSalonsLoading(false);
    }
  }, [token]);

  const setSalonForm = useCallback((key: keyof SalonFormFields, value: string | boolean) => {
    setSalonFormState((current) => ({ ...current, [key]: value }));
  }, []);

  const saveSalon = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: salonForm.name.trim(),
        city: salonForm.city.trim(),
        address: salonForm.address.trim(),
        phone: salonForm.phone.trim(),
        opens_at: salonForm.opens_at,
        closes_at: salonForm.closes_at,
        image_url: salonForm.image_url.trim() || undefined,
        is_active: salonForm.is_active,
      };
      let result: Salon;
      if (editingSalon) {
        result = await request<Salon>(
          `/admin/salons/${editingSalon.id}`,
          token,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setAdminSalons((current) =>
          current.map((s) => (s.id === result.id ? result : s)),
        );
        notify("Branch updated.");
      } else {
        result = await request<Salon>(`/admin/salons`, token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setAdminSalons((current) => [result, ...current]);
        notify("Branch created.");
      }
      setEditingSalon(null);
      resetSalonForm();
      await loadPublic();
    } catch (reason) {
      setError(messageOf(reason, "Could not save this branch."));
    } finally {
      setBusy(false);
    }
  }, [token, salonForm, editingSalon, notify, loadPublic]);

  const resetSalonForm = useCallback(() => {
    setSalonFormState({
      name: "",
      city: "",
      address: "",
      phone: "",
      opens_at: "10:00",
      closes_at: "21:00",
      image_url: "",
      is_active: true,
    });
  }, []);

  const editSalon = useCallback((salon: Salon) => {
    setEditingSalon(salon);
    setSalonFormState({
      name: salon.name,
      city: salon.city,
      address: salon.address,
      phone: salon.phone,
      opens_at: salon.opens_at,
      closes_at: salon.closes_at,
      image_url: salon.image_url ?? "",
      is_active: salon.is_active,
    });
  }, []);

  const clearSalonEdit = useCallback(() => {
    setEditingSalon(null);
    resetSalonForm();
  }, [resetSalonForm]);

  const deactivateSalon = useCallback(
    async (salonId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<void>(`/admin/salons/${salonId}`, token, { method: "DELETE" });
        setAdminSalons((current) => current.filter((s) => s.id !== salonId));
        if (editingSalon?.id === salonId) clearSalonEdit();
        await loadPublic();
        notify("Branch deactivated.");
      } catch (reason) {
        setError(messageOf(reason, "Could not deactivate this branch."));
      } finally {
        setBusy(false);
      }
    },
    [token, editingSalon, clearSalonEdit, loadPublic, notify],
  );

  /* ===================== Campaigns ===================== */
  const loadCampaigns = useCallback(async () => {
    if (!token) return;
    setCampaignsLoading(true);
    setError("");
    try {
      const rows = await request<Campaign[]>(`/admin/campaigns`, token);
      setCampaigns(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load campaigns."));
    } finally {
      setCampaignsLoading(false);
    }
  }, [token]);

  const setCampaignForm = useCallback(
    (key: keyof CampaignFormFields, value: string | boolean | number) => {
      setCampaignFormState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const saveCampaign = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    setBusy(true);
    setError("");
    try {
      // Send null (not undefined) for cleared optional fields so PATCH actually
      // removes a banner, CTA link or date the admin deleted in the form.
      const payload = {
        title: campaignForm.title.trim(),
        subtitle: campaignForm.subtitle.trim() || null,
        description: campaignForm.description.trim(),
        image_url: campaignForm.image_url.trim() || null,
        cta_label: campaignForm.cta_label.trim() || "Explore",
        cta_url: campaignForm.cta_url.trim() || null,
        audience: campaignForm.audience,
        start_date: campaignForm.start_date || null,
        end_date: campaignForm.end_date || null,
        is_active: campaignForm.is_active,
        position: Number(campaignForm.position) || 0,
      };
      let result: Campaign;
      if (editingCampaign) {
        result = await request<Campaign>(
          `/admin/campaigns/${editingCampaign.id}`,
          token,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setCampaigns((current) =>
          current.map((c) => (c.id === result.id ? result : c)),
        );
        notify("Campaign updated.");
      } else {
        result = await request<Campaign>(`/admin/campaigns`, token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setCampaigns((current) => [result, ...current]);
        notify("Campaign created.");
      }
      setEditingCampaign(null);
      resetCampaignForm();
      await loadPublic();
      return true;
    } catch (reason) {
      setError(messageOf(reason, "Could not save this campaign."));
      return false;
    } finally {
      setBusy(false);
    }
  }, [token, campaignForm, editingCampaign, notify, loadPublic]);

  const resetCampaignForm = useCallback(() => {
    setCampaignFormState({
      title: "",
      subtitle: "",
      description: "",
      image_url: "",
      cta_label: "Explore",
      cta_url: "",
      audience: "Everyone",
      start_date: "",
      end_date: "",
      is_active: true,
      position: 0,
    });
  }, []);

  const editCampaign = useCallback((campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignFormState({
      title: campaign.title,
      subtitle: campaign.subtitle ?? "",
      description: campaign.description,
      image_url: campaign.image_url ?? "",
      cta_label: campaign.cta_label,
      cta_url: campaign.cta_url ?? "",
      audience: campaign.audience,
      start_date: campaign.start_date ?? "",
      end_date: campaign.end_date ?? "",
      is_active: campaign.is_active,
      position: campaign.position,
    });
  }, []);

  const clearCampaignEdit = useCallback(() => {
    setEditingCampaign(null);
    resetCampaignForm();
  }, [resetCampaignForm]);

  const removeCampaign = useCallback(
    async (campaignId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<void>(`/admin/campaigns/${campaignId}`, token, { method: "DELETE" });
        setCampaigns((current) => current.filter((c) => c.id !== campaignId));
        if (editingCampaign?.id === campaignId) clearCampaignEdit();
        await loadPublic();
        notify("Campaign deleted.");
      } catch (reason) {
        setError(messageOf(reason, "Could not delete this campaign."));
      } finally {
        setBusy(false);
      }
    },
    [token, editingCampaign, clearCampaignEdit, loadPublic, notify],
  );

  const setCampaignActive = useCallback(
    async (campaign: Campaign, active: boolean) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const result = await request<Campaign>(`/admin/campaigns/${campaign.id}`, token, {
          method: "PATCH",
          body: JSON.stringify({ is_active: active }),
        });
        setCampaigns((current) => current.map((c) => (c.id === result.id ? result : c)));
        await loadPublic();
        notify(active ? "Campaign activated." : "Campaign deactivated.");
      } catch (reason) {
        setError(messageOf(reason, "Could not update this campaign."));
      } finally {
        setBusy(false);
      }
    },
    [token, loadPublic, notify],
  );

  /* ===================== Media ===================== */
  const loadMedia = useCallback(async () => {
    if (!token) return;
    setMediaLoading(true);
    setError("");
    try {
      const rows = await request<MediaFile[]>("/admin/media", token);
      setMedia(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load media."));
    } finally {
      setMediaLoading(false);
    }
  }, [token]);

  const uploadMediaFile = useCallback(
    async (file: UploadFile, category?: string): Promise<MediaFile | null> => {
      if (!token) return null;
      setBusy(true);
      setError("");
      try {
        const result = await uploadMedia(token, file, category ?? mediaCategory);
        setMedia((current) => [result.media, ...current]);
        notify("Image uploaded.");
        return result.media;
      } catch (reason) {
        setError(messageOf(reason, "Could not upload this image."));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [token, mediaCategory, notify],
  );

  const replaceMediaFile = useCallback(
    async (mediaId: number, file: UploadFile, category?: string): Promise<MediaFile | null> => {
      if (!token) return null;
      setBusy(true);
      setError("");
      try {
        const result = await replaceMedia(token, mediaId, file, category);
        setMedia((current) =>
          current.map((item) => (item.id === result.media.id ? result.media : item)),
        );
        await loadPublic();
        notify("Image replaced.");
        return result.media;
      } catch (reason) {
        setError(messageOf(reason, "Could not replace this image."));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [token, loadPublic, notify],
  );

  const removeMedia = useCallback(
    async (mediaId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<void>(`/admin/media/${mediaId}`, token, { method: "DELETE" });
        setMedia((current) => current.filter((m) => m.id !== mediaId));
        await loadPublic();
        notify("Image deleted.");
      } catch (reason) {
        setError(messageOf(reason, "Could not delete this image."));
      } finally {
        setBusy(false);
      }
    },
    [token, loadPublic, notify],
  );

  /* ===================== Page content ===================== */
  const loadContent = useCallback(async () => {
    if (!token) return;
    setContentLoading(true);
    setError("");
    try {
      const rows = await request<PageContent[]>(`/admin/content`, token);
      setContent(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load page content."));
    } finally {
      setContentLoading(false);
    }
  }, [token]);

  const saveContent = useCallback(
    async (key: string, value: string, content_type = "text") => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<PageContent>(`/admin/content/${key}`, token, {
          method: "PATCH",
          body: JSON.stringify({ value, content_type }),
        });
        setContent((current) => {
          const existing = current.find((c) => c.key === key);
          const updated: PageContent = {
            id: existing?.id ?? 0,
            key,
            value,
            content_type,
            updated_by: existing?.updated_by ?? null,
            updated_at: new Date().toISOString(),
          };
          return existing
            ? current.map((c) => (c.key === key ? updated : c))
            : [...current, updated];
        });
        setPublicContent((current) => ({ ...current, [key]: value }));
        notify("Content saved.");
      } catch (reason) {
        setError(messageOf(reason, "Could not save this content."));
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  /* ===================== Audit logs ===================== */
  const loadAuditLogs = useCallback(async () => {
    if (!token) return;
    setAuditLogsLoading(true);
    setError("");
    try {
      const rows = await request<AuditLog[]>(`/admin/audit-logs?limit=100&offset=0`, token);
      setAuditLogs(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load audit logs."));
    } finally {
      setAuditLogsLoading(false);
    }
  }, [token]);

  /* ===================== Users ===================== */
  const loadUsers = useCallback(async () => {
    if (!token) return;
    setUsersLoading(true);
    setError("");
    try {
      const rows = await request<StaffUser[]>(`/admin/users`, token);
      setUsers(rows);
    } catch (reason) {
      setError(messageOf(reason, "Could not load users."));
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  const setUserRole = useCallback(
    async (userId: number, role: string) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await request<User>(`/admin/users/${userId}/role`, token, {
          method: "PATCH",
          body: JSON.stringify({ role }),
        });
        setUsers((current) =>
          current.map((u) => (u.id === userId ? { ...u, role } : u)),
        );
        notify("User role updated.");
      } catch (reason) {
        setError(messageOf(reason, "Could not update user role."));
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  /* ===================== Reviews ===================== */
  const loadReviews = useCallback(
    async (salonId: number, serviceId?: number) => {
      setReviewsLoading(true);
      setError("");
      try {
        const rows = await fetchReviews(salonId, serviceId);
        setReviews(rows);
        setUserReview(rows.find((review) => review.user_id === user?.id) ?? null);
      } catch (reason) {
        setReviews([]);
        setUserReview(null);
        setError(messageOf(reason, "Could not load reviews."));
      } finally {
        setReviewsLoading(false);
      }
    },
    [user?.id],
  );

  const loadReviewSummary = useCallback(async (salonId: number) => {
    setError("");
    try {
      const summary = await fetchReviewSummary(salonId);
      setReviewSummary(summary);
    } catch {
      setReviewSummary(null);
    }
  }, []);

  const addReview = useCallback(
    async (payload: ReviewCreate) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const created = await createReview(payload, token);
        setReviews((current) => {
          const exists = current.find((review) => review.user_id === user?.id);
          const next = exists
            ? current.map((review) => (review.user_id === user?.id ? created : review))
            : [created, ...current];
          return next;
        });
        setUserReview(created);
        await loadReviewSummary(payload.salon_id);
        notify("Review posted.");
      } catch (reason) {
        setError(messageOf(reason, "Could not post your review."));
      } finally {
        setBusy(false);
      }
    },
    [token, user?.id, loadReviewSummary],
  );

  const updateReview = useCallback(
    async (reviewId: number, payload: ReviewUpdate) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const updated = await updateReviewApi(reviewId, payload, token);
        setReviews((current) =>
          current.map((review) => (review.id === reviewId ? updated : review)),
        );
        setUserReview(updated);
        notify("Review updated.");
      } catch (reason) {
        setError(messageOf(reason, "Could not update your review."));
      } finally {
        setBusy(false);
      }
    },
    [token, updateReviewApi],
  );

  const deleteReview = useCallback(
    async (reviewId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await deleteReviewApi(reviewId, token);
        setReviews((current) => current.filter((review) => review.id !== reviewId));
        if (userReview?.id === reviewId) setUserReview(null);
        await loadReviewSummary((userReview?.salon_id ?? salonId) || 0);
        notify("Review removed.");
      } catch (reason) {
        setError(messageOf(reason, "Could not remove your review."));
      } finally {
        setBusy(false);
      }
    },
    [token, salonId, userReview, loadReviewSummary],
  );

  /* ===================== Admin reviews ===================== */
  const loadAdminReviews = useCallback(async () => {
    if (!token) return;
    setAdminReviewsLoading(true);
    setError("");
    try {
      const rows = await fetchAdminReviews(token);
      setAdminReviews(rows);
    } catch (reason) {
      setAdminReviews([]);
      setError(messageOf(reason, "Could not load reviews."));
    } finally {
      setAdminReviewsLoading(false);
    }
  }, [token]);

  const setReviewActive = useCallback(
    async (reviewId: number, active: boolean) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const updated = await updateAdminReview(reviewId, { is_active: active }, token);
        setAdminReviews((current) => current.map((review) => (review.id === reviewId ? updated : review)));
        notify(active ? "Review approved." : "Review hidden.");
      } catch (reason) {
        setError(messageOf(reason, "Could not update this review."));
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  const removeAdminReview = useCallback(
    async (reviewId: number) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        await deleteAdminReview(reviewId, token);
        setAdminReviews((current) => current.filter((review) => review.id !== reviewId));
        notify("Review deleted.");
      } catch (reason) {
        setError(messageOf(reason, "Could not delete this review."));
      } finally {
        setBusy(false);
      }
    },
    [token, notify],
  );

  /* ===================== Promotional banner settings ===================== */
  const loadAdminSettings = useCallback(async () => {
    if (!token) return;
    setAdminSettingsLoading(true);
    setError("");
    try {
      const result = await fetchAdminSettings(token);
      setAdminSettings({ ...DEFAULT_ADMIN_SETTINGS, ...result.settings });
    } catch (reason) {
      setError(messageOf(reason, "Could not load promotional settings."));
    } finally {
      setAdminSettingsLoading(false);
    }
  }, [token]);

  const saveAdminSettings = useCallback(
    async (settings: Record<string, string>) => {
      if (!token) return;
      setBusy(true);
      setError("");
      try {
        const result = await updateAdminSettings(token, settings);
        setAdminSettings({ ...DEFAULT_ADMIN_SETTINGS, ...result.settings });
        await loadPublic();
        notify("Promotional banner saved.");
      } catch (reason) {
        setError(messageOf(reason, "Could not save promotional settings."));
      } finally {
        setBusy(false);
      }
    },
    [token, loadPublic, notify],
  );

  /* ===================== Developer diagnostics ===================== */
  const loadDiagnostics = useCallback(async () => {
    if (!token) return;
    setDiagnosticsLoading(true);
    setError("");
    try {
      const result = await fetchDiagnostics(token);
      setDiagnostics(result);
    } catch (reason) {
      setError(messageOf(reason, "Could not load diagnostics."));
    } finally {
      setDiagnosticsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [storedToken, storedSection] = await Promise.all([tokenGet(), sectionGet()]);
        if (!alive) return;
        if (storedSection) setSectionState(storedSection);
        if (storedToken) {
          try {
            // Never trust the stored token on its own: validate it with the API.
            const me = await request<User>("/me", storedToken);
            if (!alive) return;
            // Valid session: restore it and skip the Welcome/Login screens.
            setToken(storedToken);
            setUser(me);
            setEditingName(me.name);
            setAuthMode(null);
            setShowLanding(false);
            resetNavigation();
            try {
              const rows = await loadBookings(storedToken);
              if (alive) setBookings(sortBookings(rows));
            } catch {
              // The session is valid; bookings can be retried from the app.
            }
          } catch (reason) {
            if (!alive) return;
            // Only an explicit rejection (401/403) means the session is expired
            // or invalid. A network/5xx failure must not sign the user out.
            if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
              await tokenSet(null);
              if (!alive) return;
              setToken(null);
              setUser(null);
              setBookings([]);
              setShowLanding(false);
              setError(messageOf(reason, "Your session has expired. Please sign in again."));
              setAuthMode("login");
            } else {
              setError(messageOf(reason, "We could not verify your session. Check your connection and try again."));
            }
          }
        }
        await loadPublic();
      } catch (reason) {
        if (alive) setError(messageOf(reason, "The Naturals API could not be reached. Check that the backend is running."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadBookings, loadPublic]);

  useEffect(() => {
    if (!bookingOpen || !salonId || !serviceId) {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    let active = true;
    setSlotsLoading(true);
    setSelectedTime("");
    setStaffId(null);
    request<{ slots: Slot[] }>(`/availability?salon_id=${salonId}&service_id=${serviceId}&date=${bookingDate}`, null)
      .then((result) => {
        if (active) setSlots(result.slots ?? []);
      })
      .catch((reason) => {
        if (active) {
          setSlots([]);
          setError(messageOf(reason, "Could not load available times. Try another day."));
        }
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bookingOpen, salonId, serviceId, bookingDate]);

  useEffect(() => {
    if (!salonId) {
      setBranchServices([]);
      return;
    }
    void loadBranchServices(salonId);
  }, [salonId, loadBranchServices]);

  useEffect(() => {
    if (salonId && (tab === "Salons" || tab === "Reviews")) {
      void loadReviews(salonId);
      void loadReviewSummary(salonId);
    } else {
      setReviews([]);
      setReviewSummary(null);
      setUserReview(null);
    }
  }, [salonId, tab, loadReviews, loadReviewSummary]);

  useEffect(() => {
    if (!salonId || branchServicesLoading) return;
    if (serviceId && !branchServices.some((service) => service.id === serviceId)) {
      setServiceId(null);
      setSelectedTime("");
      setStaffId(null);
    }
  }, [branchServices, branchServicesLoading, serviceId, salonId]);

  useEffect(() => {
    if (tab === "Admin" && (user?.role === "admin" || user?.role === "developer") && token) {
      void loadAdmin();
      void loadAnalytics();
    }
  }, [tab, token, user?.role, loadAdmin, loadAnalytics]);

  useEffect(() => {
    if (tab === "Admin" && user?.role === "developer" && token) void loadDeveloperSettings();
  }, [tab, token, user?.role, loadDeveloperSettings]);

  useEffect(() => {
    if (tab !== "Admin") return;
    if (adminSection === "appointments") void loadAdminBookings();
    if (adminSection === "services") void loadAdminServices();
    if (adminSection === "branches") void loadAdminSalons();
    if (adminSection === "campaigns") void loadCampaigns();
    if (adminSection === "media") void loadMedia();
    if (adminSection === "content") {
      void loadContent();
      void loadAdminSettings();
    }
    if (adminSection === "audit") void loadAuditLogs();
    if (adminSection === "reviews") void loadAdminReviews();
    if (adminSection === "developer") {
      void loadUsers();
      void loadDiagnostics();
    }
  }, [tab, adminSection, token, loadAdminBookings, loadAdminServices, loadAdminSalons, loadCampaigns, loadMedia, loadContent, loadAdminSettings, loadAuditLogs, loadUsers, loadDiagnostics]);

  /* Near-real-time dashboard refresh (polling, no WebSocket needed). */
  useEffect(() => {
    if (tab !== "Admin" || !token) return;
    if (user?.role !== "admin" && user?.role !== "developer") return;
    const timer = setInterval(() => {
      void loadAnalytics();
      if (adminSection === "appointments") void loadAdminBookings();
    }, 30000);
    return () => clearInterval(timer);
  }, [tab, token, user?.role, adminSection, loadAnalytics, loadAdminBookings]);

  /* Customers see the latest published campaigns whenever they return to a campaign surface. */
  useEffect(() => {
    if (tab !== "Home" && tab !== "Offers") return;
    let alive = true;
    const refreshCampaigns = () => {
      fetchPublicCampaigns()
        .then((rows) => {
          if (alive) setPublicCampaigns(rows);
        })
        .catch(() => {
          /* Keep the last good campaign list if the network blips. */
        });
    };
    refreshCampaigns();
    const timer = setInterval(refreshCampaigns, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tab]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc = (globalThis as unknown as { document?: any }).document;
    if (!doc) return;
    const id = "naturals-web-fonts";
    if (doc.getElementById(id)) return;
    const preconnect = doc.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.googleapis.com";
    const stylesheet = doc.createElement("link");
    stylesheet.id = id;
    stylesheet.rel = "stylesheet";
    stylesheet.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap";
    doc.head.append(preconnect, stylesheet);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc = (globalThis as unknown as { document?: any }).document;
    if (!doc) return;
    doc.body.style.backgroundColor = t.bg;
    doc.documentElement.style.backgroundColor = t.bg;
    doc.title = `Naturals ${section === "men" ? "Men" : "Women"} · Salon & wellness`;
  }, [section, t.bg]);

  const sectionServices = useMemo(
    () => services.filter((service) => serviceInSection(service, section)),
    [services, section],
  );

  const bookingServices = useMemo(() => {
    // Once a branch is chosen the server-filtered branch catalogue is the source
    // of truth: it already drops unavailable services and carries branch prices.
    const source = salonId ? branchServices : sectionServices;
    return source.filter((service) => serviceInSection(service, section));
  }, [branchServices, sectionServices, section, salonId]);

  const featuredServices = useMemo(
    () =>
      [...sectionServices].sort((a, b) => {
        const rank = rankForSection(a, section) - rankForSection(b, section);
        return rank !== 0 ? rank : a.id - b.id;
      }),
    [sectionServices, section],
  );

  const sectionCategories = useMemo(() => {
    const names = new Set(sectionServices.map((service) => service.category));
    return categories.filter((category) => names.has(category.name));
  }, [categories, sectionServices]);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sectionServices.filter((service) => {
      const inCategory = filter === "All" || service.category === filter;
      const inSearch =
        !term ||
        `${service.name} ${service.category} ${service.description}`.toLowerCase().includes(term);
      return inCategory && inSearch;
    });
  }, [filter, search, sectionServices]);

  const selectedSalon = useMemo(
    () => salons.find((salon) => salon.id === salonId) ?? salons.find((salon) => !salon.is_demo) ?? salons[0],
    [salonId, salons],
  );

  const bookingSalon = useMemo(
    () => salons.find((salon) => salon.id === salonId),
    [salonId, salons],
  );

  const bookingService = useMemo(() => {
    if (salonId) return branchServices.find((service) => service.id === serviceId) ?? null;
    return services.find((service) => service.id === serviceId) ?? null;
  }, [serviceId, branchServices, services, salonId]);

  const availableStaff = useMemo(
    () => slots.find((slot) => slot.time === selectedTime)?.staff ?? [],
    [selectedTime, slots],
  );

  const matchedOffer = useMemo(() => {
    const code = offerCode.trim().toUpperCase();
    if (!code) return undefined;
    return offers.find((offer) => offer.code.toUpperCase() === code);
  }, [offerCode, offers]);

  const estimatedDiscount = useMemo(() => {
    if (!bookingService || !matchedOffer) return 0;
    return Math.round(Number(bookingService.price) * (matchedOffer.discount_percent / 100) * 100) / 100;
  }, [bookingService, matchedOffer]);

  const estimatedTotal = Math.max(0, Number(bookingService?.price ?? 0) - estimatedDiscount);

  const upcomingBookings = useMemo(
    () =>
      sortBookings(bookings.filter((booking) => booking.status === "confirmed" && isUpcoming(booking))).sort((a, b) =>
        `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`),
      ),
    [bookings],
  );

  const pastBookings = useMemo(
    () => sortBookings(bookings.filter((booking) => booking.status !== "confirmed" || !isUpcoming(booking))),
    [bookings],
  );

  function switchSection(next: Section) {
    if (next === section) return;
    setSectionState(next);
    void sectionSet(next);
    setFilter("All");
    setSearch("");
    setSelectedService(null);
    setBookingOpen(false);
    setBookingStep(0);
    setRescheduleId(null);
    setSelectedTime("");
    setStaffId(null);
    setOfferCode("");
    setError("");
    resetNavigation();
    notify(`Now browsing Naturals ${next === "men" ? "Men" : "Women"}.`);
  }

  /**
   * Navigate to a tab and push the current one onto the history stack.
   * Tapping the tab that is already active never creates a duplicate entry;
   * instead it bumps `tabPressNonce` so the shell can scroll that tab to the
   * top (the expected behaviour for a repeated bottom-nav tap).
   */
  function go(nextTab: Tab) {
    setError("");
    if (nextTab === tabRef.current) {
      setTabPressNonce((value) => value + 1);
      return;
    }
    const stack = navHistory.current;
    if (stack[stack.length - 1] !== tabRef.current) stack.push(tabRef.current);
    if (stack.length > 40) stack.splice(0, stack.length - 40);
    applyTab(nextTab);
    // Mirror the in-app navigation into the browser history so the web/mobile
    // browser Back button retraces the same path as the in-app back button.
    pushBrowserEntry();
  }

  function exploreCategory(category: string) {
    setFilter(category);
    go("Explore");
  }

  function openAuth(mode: "login" | "register" | "admin") {
    setAuthMode(mode);
    setAuthEmail("");
    setAuthPassword("");
    setError("");
  }

  function closeAuth() {
    setAuthMode(null);
    setAuthPassword("");
    setError("");
  }

  function openService(service: Service) {
    setSelectedService(service);
  }

  function closeService() {
    setSelectedService(null);
  }

  function startBooking(service?: Service | null, booking?: Booking | null) {
    setError("");
    setRescheduleId(booking?.id ?? null);
    const targetSalon = booking?.salon.id ?? salonId ?? salons[0]?.id ?? null;
    const targetService = booking?.service.id ?? service?.id ?? null;
    setSalonId(targetSalon);
    setServiceId(targetService);
    setBookingDate(todayString(1));
    setSelectedTime("");
    setStaffId(null);
    setOfferCode("");
    setSelectedService(null);
    setBookingStep(targetService ? 2 : 1);
    setBookingOpen(true);
  }

  function startBookingAtSalon(salon: Salon) {
    startBooking();
    setSalonId(salon.id);
  }

  function startBookingWithOffer(code: string) {
    startBooking();
    setOfferCode(code);
  }

  function closeBooking() {
    setBookingOpen(false);
    setRescheduleId(null);
    setBookingStep(0);
    setSelectedTime("");
    setStaffId(null);
    setOfferCode("");
    setError("");
  }

  /**
   * Single source of truth for Back. The in-app back button and the Android
   * hardware button both call this, so they can never disagree. Overlays unwind
   * first, then admin sub-pages, then the tab history, and finally Home.
   * Returning false is what lets Android's back button leave the app from Home.
   */
  const goBack = useCallback((fromPopState = false): boolean => {
    if (dialog) {
      closeDialog();
      return true;
    }
    if (selectedService) {
      closeService();
      return true;
    }
    if (bookingOpen) {
      closeBooking();
      return true;
    }
    if (authMode) {
      closeAuth();
      return true;
    }
    if (tabRef.current === "Admin" && adminSection !== "overview") {
      setAdminSection("overview");
      return true;
    }
    // On the web the browser owns the back-stack. Delegate tab-level back to
    // it so our entries stay in sync; the resulting popstate restores the
    // previous snapshot. Overlays above were unwound locally (they are not
    // separate browser entries), which keeps the depths aligned.
    if (Platform.OS === "web" && !fromPopState && navHistory.current.length > 0) {
      window.history.back();
      return true;
    }
    const previous = navHistory.current.pop();
    if (previous) {
      applyTab(previous);
      setError("");
      return true;
    }
    if (tabRef.current !== "Home") {
      applyTab("Home");
      setError("");
      replaceBrowserEntry();
      return true;
    }
    return false;
  }, [dialog, selectedService, bookingOpen, authMode, adminSection, applyTab, replaceBrowserEntry]);

  // True whenever an in-app overlay or admin sub-page is on top of the tab
  // stack. Browser Back should close that layer instead of changing tabs.
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current = Boolean(
    dialog || selectedService || bookingOpen || authMode || (tab === "Admin" && adminSection !== "overview"),
  );

  // Seed the first browser entry so the very first Back press is app-owned.
  useEffect(() => {
    replaceBrowserEntry();
  }, [replaceBrowserEntry]);

  // Keep the web browser's Back/Forward controls in sync with the in-app stack.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as BrowserNavState | null;
      if (!state || state.__naturals !== true) {
        // Entry created outside this app (or before the seed). Keep the current
        // screen and re-tag the entry so the next Back press behaves.
        replaceBrowserEntry();
        return;
      }
      if (state.epoch !== epochRef.current) {
        // Stale entry from before a navigation reset (section switch/logout);
        // never restore a screen from a previous session.
        replaceBrowserEntry();
        return;
      }
      if (overlayOpenRef.current) {
        // Close just the overlay, then re-push so the browser depth matches the
        // app again (the overlay itself has no browser entry of its own).
        goBack(true);
        pushBrowserEntry();
        return;
      }
      navHistory.current = (Array.isArray(state.stack) ? state.stack.filter(isTab) : []).slice(-40);
      applyTab(isTab(state.tab) ? state.tab : "Home");
      setError("");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyTab, goBack, pushBrowserEntry, replaceBrowserEntry]);

  // Android hardware back: unwind the in-app stack before leaving the app.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => goBack());
    return () => subscription.remove();
  }, [goBack]);

  const canNavigateBack = canGoBack || (tab === "Admin" && adminSection !== "overview");

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const mode = authMode;
      const path = mode === "register" ? "/auth/register" : mode === "admin" ? "/auth/admin-login" : "/auth/login";
      const body =
        mode === "register"
          ? { name: authName.trim(), email: authEmail.trim(), password: authPassword }
          : mode === "admin"
            ? { identifier: authEmail.trim(), password: authPassword }
            : { email: authEmail.trim(), password: authPassword };
      const result = await request<{ access_token: string; user: User }>(path, null, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await tokenSet(result.access_token);
      setToken(result.access_token);
      setUser(result.user);
      setEditingName(result.user.name);
      const rows = await loadBookings(result.access_token);
      setBookings(sortBookings(rows));
      setAuthMode(null);
      setAuthPassword("");
      notify(mode === "register" ? "Account created. Welcome to Naturals." : `Welcome back, ${result.user.name.split(" ")[0]}.`);
      if (result.user.role !== "customer" && !bookingOpen) go("Admin");
    } catch (reason) {
      setError(messageOf(reason, "Could not sign in. Check your email and password."));
    } finally {
      setBusy(false);
    }
  }

  async function logOut() {
    await tokenSet(null);
    setToken(null);
    setUser(null);
    setBookings([]);
    setLastConfirmed(null);
    setEditingName("");
    setBookingOpen(false);
    // Return the customer to the Login screen, not the guest Home screen.
    setShowLanding(false);
    setAuthMode("login");
    setError("");
    resetNavigation();
    setAdminStats(null);
    setAdminBookings([]);
    setDeveloperModeEnabled(false);
    setDeveloperSettings(DEFAULT_DEVELOPER_SETTINGS);
    setAdminSettings({ ...DEFAULT_ADMIN_SETTINGS });
    setDiagnostics(null);
    setAdminSection("overview");
    notify("Signed out of Naturals.");
  }

  async function saveProfile() {
    if (!token) return;
    const name = editingName.trim();
    if (name.length < 2) {
      setError("Your name needs at least two characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await request<User>("/me", token, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setUser(updated);
      setEditingName(updated.name);
      notify("Profile saved.");
    } catch (reason) {
      setError(messageOf(reason, "Could not update your profile."));
    } finally {
      setBusy(false);
    }
  }

  async function submitBooking() {
    if (busy) return;
    if (!salonId) {
      setError("Choose a salon before confirming.");
      setBookingStep(0);
      return;
    }
    if (!serviceId) {
      setError("Choose a treatment before confirming.");
      setBookingStep(1);
      return;
    }
    if (!selectedTime) {
      setError("Choose an available time before confirming.");
      setBookingStep(2);
      return;
    }
    if (!user || !token) {
      openAuth("login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        salon_id: salonId,
        service_id: serviceId,
        staff_id: staffId,
        date: bookingDate,
        start_time: selectedTime,
        offer_code: offerCode.trim() ? offerCode.trim().toUpperCase() : null,
      };
      const result = rescheduleId
        ? await request<Booking>(`/bookings/${rescheduleId}`, token, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await request<Booking>("/bookings", token, {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setBookings((current) => {
        const exists = current.some((booking) => booking.id === result.id);
        const rows = exists ? current.map((booking) => (booking.id === result.id ? result : booking)) : [result, ...current];
        return sortBookings(rows);
      });
      setLastConfirmed(result);
      setBookingOpen(false);
      setBookingStep(0);
      setRescheduleId(null);
      setSelectedTime("");
      setStaffId(null);
      setOfferCode("");
      go("Bookings");
      notify(rescheduleId ? "Appointment rescheduled." : "Appointment confirmed.");
    } catch (reason) {
      setError(messageOf(reason, "Could not confirm this appointment."));
    } finally {
      setBusy(false);
    }
  }

  function cancelBooking(booking: Booking) {
    ask({
      title: "Cancel this appointment?",
      message: `${booking.service.name} at ${booking.salon.name}, ${booking.date} at ${booking.start_time}. The slot will be released immediately.`,
      confirmLabel: "Cancel appointment",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: () => {
        void (async () => {
          if (!token) return;
          setBusy(true);
          setError("");
          try {
            const result = await request<Booking>(`/bookings/${booking.id}/cancel`, token, { method: "POST" });
            setBookings((current) => sortBookings(current.map((item) => (item.id === result.id ? result : item))));
            notify("Appointment cancelled.");
          } catch (reason) {
            setError(messageOf(reason, "Could not cancel this appointment."));
          } finally {
            setBusy(false);
          }
        })();
      },
    });
  }

  async function completeBooking(booking: Booking) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await request(`/admin/bookings/${booking.id}/complete`, token, { method: "POST" });
      await loadAdmin();
      notify("Appointment marked complete.");
    } catch (reason) {
      setError(messageOf(reason, "Could not complete this appointment."));
    } finally {
      setBusy(false);
    }
  }

  async function createAdminService() {
    if (!token || !adminServiceName.trim() || !adminServicePrice.trim()) return;
    setBusy(true);
    setError("");
    try {
      const categoryId = categories.find((category) => category.slug === "hair")?.id;
      if (!categoryId) throw new Error("The Hair category is unavailable.");
      await request("/admin/services", token, {
        method: "POST",
        body: JSON.stringify({
          category_id: categoryId,
          name: adminServiceName.trim(),
          description: "Created by a Naturals administrator.",
          duration_minutes: 45,
          price: Number(adminServicePrice),
          audience: "Everyone",
          is_active: true,
        }),
      });
      setAdminServiceName("");
      setAdminServicePrice("");
      await loadPublic();
      await loadAdminServices();
      if (salonId) await loadBranchServices(salonId);
      notify("Service created and added to the catalogue.");
    } catch (reason) {
      setError(messageOf(reason, "Could not create this service."));
    } finally {
      setBusy(false);
    }
  }

  const value: NaturalsContextValue = {
    t,
    section,
    switchSection,
    bp,
    tab,
    go,
    canGoBack: canNavigateBack,
    goBack,
    tabPressNonce,
    showLanding,
    setShowLanding,
    services,
    categories,
    salons,
    offers,
    appSettings,
    publicContent,
    publicCampaigns,
    staffBySalon,
    branchServices,
    branchServicesLoading,
    sectionServices,
    bookingServices,
    featuredServices,
    sectionCategories,
    filteredServices,
    search,
    setSearch,
    filter,
    setFilter,
    exploreCategory,
    selectedSalon,
    user,
    token,
    bookings,
    upcomingBookings,
    pastBookings,
    loading,
    busy,
    error,
    setError,
    clearError,
    authMode,
    openAuth,
    closeAuth,
    authName,
    setAuthName,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    signIn,
    logOut,
    editingName,
    setEditingName,
    saveProfile,
    selectedService,
    openService,
    closeService,
    bookingOpen,
    rescheduleId,
    startBooking,
    startBookingAtSalon,
    startBookingWithOffer,
    closeBooking,
    bookingStep,
    setBookingStep,
    salonId,
    setSalonId,
    serviceId,
    setServiceId,
    bookingSalon,
    bookingService,
    bookingDate,
    setBookingDate,
    slots,
    slotsLoading,
    selectedTime,
    setSelectedTime,
    staffId,
    setStaffId,
    availableStaff,
    offerCode,
    setOfferCode,
    matchedOffer,
    estimatedDiscount,
    estimatedTotal,
    submitBooking,
    lastConfirmed,
    clearLastConfirmed: () => setLastConfirmed(null),
    cancelBooking,
    adminStats,
    adminBookings,
    adminServiceName,
    setAdminServiceName,
    adminServicePrice,
    setAdminServicePrice,
    loadAdmin,
    completeBooking,
    createAdminService,

    /* Dashboard */
    adminSection,
    setAdminSection,
    analytics,
    analyticsLoading,
    loadAnalytics,
    bookingsLoading,
    bookingsFilters,
    setBookingsFilter,
    loadAdminBookings,
    saveBooking,
    removeBooking,
    adminServices,
    servicesLoading,
    serviceForm,
    setServiceForm,
    loadAdminServices,
    saveService,
    editService,
    clearServiceEdit,
    deleteService,
    branchPrices,
    loadBranchPrices,
    saveBranchPrice,
    removeBranchPrice,
    branchServiceRows,
    branchServiceRowsLoading,
    loadBranchServiceRows,
    saveBranchServiceRow,
    adminSalons,
    salonsLoading,
    salonForm,
    setSalonForm,
    loadAdminSalons,
    saveSalon,
    editSalon,
    clearSalonEdit,
    deactivateSalon,
    campaigns,
    campaignsLoading,
    campaignForm,
    setCampaignForm,
    loadCampaigns,
    saveCampaign,
    editCampaign,
    clearCampaignEdit,
    removeCampaign,
    setCampaignActive,
    media,
    mediaLoading,
    mediaCategory,
    setMediaCategory,
    uploadMediaFile,
    replaceMediaFile,
    removeMedia,
    loadMedia,
    content,
    contentLoading,
    loadContent,
    saveContent,
    adminSettings,
    adminSettingsLoading,
    loadAdminSettings,
    saveAdminSettings,
    diagnostics,
    diagnosticsLoading,
    loadDiagnostics,
    auditLogs,
    auditLogsLoading,
    loadAuditLogs,
    users,
    usersLoading,
    loadUsers,
    setUserRole,

    /* Reviews */
    reviews,
    reviewSummary,
    userReview,
    reviewsLoading,
    loadReviews,
    loadReviewSummary,
    addReview,
    updateReview,
    deleteReview,

    /* Admin reviews */
    adminReviews,
    adminReviewsLoading,
    loadAdminReviews,
    setReviewActive,
    removeAdminReview,

    editingService,
    editingSalon,
    editingCampaign,
    developerModeEnabled,
    developerSettings,
    setDeveloperSettings,
    loadDeveloperSettings,
    setDeveloperMode,
    saveDeveloperSettings,
    toast,
    notify,
    dialog,
    ask,
    closeDialog,
    refreshPublic: loadPublic,
  };

  return (
    <NaturalsContext.Provider value={value}>
      <StatusBar style={t.scheme === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1, maxHeight: visualHeight ?? undefined }}>
        {loading ? <LoadingScreen /> : showLanding ? <LandingScreen /> : <Shell />}
      </View>
    </NaturalsContext.Provider>
  );
}

const KEEP_ALIVE_TABS: Tab[] = ["Home", "Explore", "Salons", "Offers", "Bookings", "Profile", "Reviews", "About", "TryOn"];

function renderTabScreen(screenTab: Tab) {
  switch (screenTab) {
    case "Home":
      return <HomeScreen />;
    case "Explore":
      return <ExploreScreen />;
    case "Salons":
      return <SalonsScreen />;
    case "Offers":
      return <OffersScreen />;
    case "Bookings":
      return <BookingsScreen />;
    case "Profile":
      return <ProfileScreen />;
    case "Reviews":
      return <ReviewsScreen />;
    case "About":
      return <AboutScreen />;
    case "TryOn":
      return <TryOnScreen />;
    default:
      return null;
  }
}

function Shell() {
  const { t, bp, error, clearError, authMode, bookingOpen, bookingStep, tab, section, tabPressNonce } = useNaturals();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // Tabs stay mounted once visited so local state (filters, sub-tabs, drafts,
  // the home carousel position) survives switching. Inactive screens are
  // hidden rather than unmounted, which also guarantees there is only ever one
  // live instance of a screen no matter how often it is opened.
  const [mountedTabs, setMountedTabs] = useState<Tab[]>(["Home"]);

  useEffect(() => {
    setMountedTabs((current) => {
      if (!KEEP_ALIVE_TABS.includes(tab) || current.includes(tab)) return current;
      return [...current, tab];
    });
  }, [tab]);

  const visibleTabs = KEEP_ALIVE_TABS.filter((item) => mountedTabs.includes(item) || item === tab);

  const scrollPositions = useRef<Record<string, number>>({});
  const scrollKey = bookingOpen ? "Booking" : tab;
  const scrollKeyRef = useRef(scrollKey);
  const restoringScroll = useRef(false);

  useEffect(() => {
    scrollKeyRef.current = scrollKey;
  }, [scrollKey]);

  // Restore the scroll offset that belongs to the screen being shown. This is
  // what makes returning to Services from Bookings feel like a real stack pop
  // rather than a brand-new page.
  useEffect(() => {
    restoringScroll.current = true;
    const target = scrollPositions.current[scrollKey] ?? 0;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: target, animated: false });
      restoringScroll.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [scrollKey]);

  // A repeated tap on the already-active tab is the conventional shortcut for
  // "take me back to the top of this screen".
  useEffect(() => {
    if (tabPressNonce === 0) return;
    scrollPositions.current[scrollKeyRef.current] = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [tabPressNonce]);

  // Switching Women/Men is a deliberate context reset, so start at the top.
  useEffect(() => {
    scrollPositions.current["Home"] = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [section]);

  // A short fade/rise whenever the visible route changes keeps transitions
  // calm without introducing a heavyweight navigation dependency.
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentOffset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    contentOpacity.setValue(0.55);
    contentOffset.setValue(6);
    const animation = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 190,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(contentOffset, {
        toValue: 0,
        duration: 190,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [tab, section, bookingOpen, contentOpacity, contentOffset]);

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (restoringScroll.current) return;
    scrollPositions.current[scrollKeyRef.current] = event.nativeEvent.contentOffset.y;
  };

  if (authMode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 18) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthScreen />
        </ScrollView>
        <ToastView />
        <DialogModal />
        <ServiceDetailModal />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "left", "right"]}>
      <Header />
      {bookingOpen && bookingStep === 1 ? <BookingSelectionBar /> : null}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: !bp.isDesktop && !bookingOpen ? bottomNavSpace(insets.bottom) : 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={64}
      >
        {error ? (
          <PageShell>
            <View style={{ marginTop: 14 }}>
              <ErrorNote message={error} onClose={clearError} />
            </View>
          </PageShell>
        ) : null}
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentOffset }],
          }}
        >
          {visibleTabs.map((screenTab) => (
            <View
              key={screenTab}
              style={{ display: !bookingOpen && tab === screenTab ? "flex" : "none" }}
              accessibilityElementsHidden={bookingOpen || tab !== screenTab}
              importantForAccessibility={bookingOpen || tab !== screenTab ? "no-hide-descendants" : "auto"}
            >
              {renderTabScreen(screenTab)}
            </View>
          ))}
          {!bookingOpen && tab === "Admin" ? <AdminScreen /> : null}
          {bookingOpen ? <BookingScreen /> : null}
        </Animated.View>
        {/* The footer is a web-only surface; mobile layouts use the bottom nav. */}
        {Platform.OS === "web" && !bookingOpen ? <Footer /> : null}
      </ScrollView>
      {!bookingOpen ? <BottomNav /> : null}
      <ToastView />
      <ServiceDetailModal />
      <DialogModal />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
