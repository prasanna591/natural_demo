import { createContext, useContext } from "react";
import type {
  Analytics,
  AnalyticsPoint,
  AppSettings,
  AppSettingsFull,
  AuthMode,
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
} from "./api";
import type { Breakpoint, Section, Theme } from "./theme";

export type ToastState = { message: string; tone: "success" | "error" } | null;

export type DialogState = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
} | null;

export type NaturalsContextValue = {
  t: Theme;
  section: Section;
  switchSection: (section: Section) => void;
  bp: Breakpoint;

  tab: Tab;
  go: (tab: Tab) => void;
  /** True when the in-app stack has somewhere to return to. */
  canGoBack: boolean;
  /** Unified back handler used by the header button and Android hardware back. */
  goBack: () => void;
  /** Increments when the active tab is tapped again (scroll-to-top request). */
  tabPressNonce: number;

  showLanding: boolean;
  setShowLanding: (value: boolean) => void;

  services: Service[];
  categories: Category[];
  salons: Salon[];
  offers: Offer[];
  appSettings: AppSettings;
  publicContent: Record<string, string>;
  publicCampaigns: Campaign[];
  staffBySalon: Record<number, Stylist[]>;
  branchServices: Service[];
  branchServicesLoading: boolean;

  sectionServices: Service[];
  bookingServices: Service[];
  featuredServices: Service[];
  sectionCategories: Category[];
  filteredServices: Service[];

  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  exploreCategory: (category: string) => void;

  selectedSalon: Salon | undefined;

  user: User | null;
  token: string | null;
  bookings: Booking[];
  upcomingBookings: Booking[];
  pastBookings: Booking[];
  loading: boolean;
  busy: boolean;
  error: string;
  setError: (message: string) => void;
  clearError: () => void;

  authMode: AuthMode;
  openAuth: (mode: "login" | "register" | "admin") => void;
  closeAuth: () => void;
  authName: string;
  setAuthName: (value: string) => void;
  authEmail: string;
  setAuthEmail: (value: string) => void;
  authPassword: string;
  setAuthPassword: (value: string) => void;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;

  editingName: string;
  setEditingName: (value: string) => void;
  saveProfile: () => Promise<void>;

  selectedService: Service | null;
  openService: (service: Service) => void;
  closeService: () => void;

  bookingOpen: boolean;
  rescheduleId: number | null;
  startBooking: (service?: Service | null, booking?: Booking | null) => void;
  startBookingAtSalon: (salon: Salon) => void;
  startBookingWithOffer: (code: string) => void;
  closeBooking: () => void;
  bookingStep: number;
  setBookingStep: (step: number) => void;

  salonId: number | null;
  setSalonId: (id: number) => void;
  serviceId: number | null;
  setServiceId: (id: number | null) => void;
  bookingSalon: Salon | undefined;
  bookingService: Service | null;
  bookingDate: string;
  setBookingDate: (value: string) => void;
  slots: Slot[];
  slotsLoading: boolean;
  selectedTime: string;
  setSelectedTime: (value: string) => void;
  staffId: number | null;
  setStaffId: (value: number | null) => void;
  availableStaff: Stylist[];
  offerCode: string;
  setOfferCode: (value: string) => void;
  matchedOffer: Offer | undefined;
  estimatedDiscount: number;
  estimatedTotal: number;
  submitBooking: () => Promise<void>;

  lastConfirmed: Booking | null;
  clearLastConfirmed: () => void;
  cancelBooking: (booking: Booking) => void;

  adminStats: Record<string, string | number> | null;
  adminBookings: Booking[];
  adminServiceName: string;
  setAdminServiceName: (value: string) => void;
  adminServicePrice: string;
  setAdminServicePrice: (value: string) => void;
  loadAdmin: () => Promise<void>;
  completeBooking: (booking: Booking) => Promise<void>;
  createAdminService: () => Promise<void>;

  /* Admin dashboard sub-navigation */
  adminSection:
    | "overview"
    | "appointments"
    | "services"
    | "branches"
    | "campaigns"
    | "media"
    | "content"
    | "audit"
    | "reviews"
    | "developer";
  setAdminSection: (
    section:
      | "overview"
      | "appointments"
      | "services"
      | "branches"
      | "campaigns"
      | "media"
      | "content"
      | "audit"
      | "reviews"
      | "developer",
  ) => void;

  /* Analytics */
  analytics: Analytics | null;
  analyticsLoading: boolean;
  loadAnalytics: (range?: string, start?: string, end?: string) => Promise<void>;

  /* Appointments */
  bookingsLoading: boolean;
  bookingsFilters: {
    date?: string;
    status?: string;
    salon_id?: number;
    search?: string;
  };
  setBookingsFilter: (key: "date" | "status" | "salon_id" | "search", value: string | undefined) => void;
  loadAdminBookings: () => Promise<void>;
  saveBooking: (bookingId: number, payload: Record<string, unknown>) => Promise<void>;
  removeBooking: (bookingId: number) => Promise<void>;

  /* Services */
  adminServices: Service[];
  servicesLoading: boolean;
  serviceForm: { category_id: number; name: string; description: string; duration_minutes: string; price: string; image_url: string; audience: string; is_active: boolean };
  setServiceForm: (key: keyof ServiceFormFields, value: string | boolean) => void;
  loadAdminServices: () => Promise<void>;
  saveService: () => Promise<void>;
  editService: (service: Service) => void;
  clearServiceEdit: () => void;
  deleteService: (serviceId: number) => Promise<void>;

  /* Branch prices */
  branchPrices: Record<number, BranchPrice[]>;
  loadBranchPrices: (serviceId: number) => Promise<void>;
  saveBranchPrice: (serviceId: number, salonId: number, price: string, isAvailable?: boolean) => Promise<void>;
  removeBranchPrice: (serviceId: number, salonId: number) => Promise<void>;

  /* Branch services */
  branchServiceRows: BranchService[];
  branchServiceRowsLoading: boolean;
  loadBranchServiceRows: (salonId: number, search?: string) => Promise<void>;
  saveBranchServiceRow: (salonId: number, serviceId: number, payload: { price?: string; is_available?: boolean }) => Promise<void>;

  /* Salons / branches */
  adminSalons: Salon[];
  salonsLoading: boolean;
  salonForm: { name: string; city: string; address: string; phone: string; opens_at: string; closes_at: string; image_url: string; is_active: boolean };
  setSalonForm: (key: keyof SalonFormFields, value: string | boolean) => void;
  loadAdminSalons: () => Promise<void>;
  saveSalon: () => Promise<void>;
  editSalon: (salon: Salon) => void;
  clearSalonEdit: () => void;
  deactivateSalon: (salonId: number) => Promise<void>;

  /* Campaigns */
  campaigns: Campaign[];
  campaignsLoading: boolean;
  campaignForm: { title: string; subtitle: string; description: string; image_url: string; cta_label: string; cta_url: string; audience: string; start_date: string; end_date: string; is_active: boolean; position: number };
  setCampaignForm: (key: keyof CampaignFormFields, value: string | boolean | number) => void;
  loadCampaigns: () => Promise<void>;
  saveCampaign: () => Promise<boolean>;
  editCampaign: (campaign: Campaign) => void;
  clearCampaignEdit: () => void;
  removeCampaign: (campaignId: number) => Promise<void>;
  setCampaignActive: (campaign: Campaign, active: boolean) => Promise<void>;

  /* Media */
  media: MediaFile[];
  mediaLoading: boolean;
  mediaCategory: string;
  setMediaCategory: (value: string) => void;
  uploadMediaFile: (file: UploadFile, category?: string) => Promise<MediaFile | null>;
  replaceMediaFile: (mediaId: number, file: UploadFile, category?: string) => Promise<MediaFile | null>;
  removeMedia: (mediaId: number) => Promise<void>;
  loadMedia: () => Promise<void>;

  /* Page content */
  content: PageContent[];
  contentLoading: boolean;
  loadContent: () => Promise<void>;
  saveContent: (key: string, value: string, content_type?: string) => Promise<void>;

  /* Promotional banner settings (admin + developer) */
  adminSettings: AppSettingsFull;
  adminSettingsLoading: boolean;
  loadAdminSettings: () => Promise<void>;
  saveAdminSettings: (settings: Record<string, string>) => Promise<void>;

  /* Developer diagnostics */
  diagnostics: Diagnostics | null;
  diagnosticsLoading: boolean;
  loadDiagnostics: () => Promise<void>;

  /* Audit logs */
  auditLogs: AuditLog[];
  auditLogsLoading: boolean;
  loadAuditLogs: () => Promise<void>;

  /* Users / staff */
  users: StaffUser[];
  usersLoading: boolean;
  loadUsers: () => Promise<void>;
  setUserRole: (userId: number, role: string) => Promise<void>;

  /* Reviews */
  reviews: Review[];
  reviewSummary: ReviewSummary | null;
  userReview: Review | null;
  reviewsLoading: boolean;
  loadReviews: (salonId: number, serviceId?: number) => Promise<void>;
  loadReviewSummary: (salonId: number) => Promise<void>;
  addReview: (payload: ReviewCreate) => Promise<void>;
  updateReview: (reviewId: number, payload: ReviewUpdate) => Promise<void>;
  deleteReview: (reviewId: number) => Promise<void>;

  /* Admin reviews */
  adminReviews: Review[];
  adminReviewsLoading: boolean;
  loadAdminReviews: () => Promise<void>;
  setReviewActive: (reviewId: number, active: boolean) => Promise<void>;
  removeAdminReview: (reviewId: number) => Promise<void>;

  /* Selected editing records */
  editingService: Service | null;
  editingSalon: Salon | null;
  editingCampaign: Campaign | null;

  developerModeEnabled: boolean;
  developerSettings: DeveloperSettings;
  setDeveloperSettings: (value: DeveloperSettings) => void;
  loadDeveloperSettings: () => Promise<void>;
  setDeveloperMode: (enabled: boolean) => Promise<void>;
  saveDeveloperSettings: () => Promise<void>;

  toast: ToastState;
  notify: (message: string, tone?: "success" | "error") => void;
  dialog: DialogState;
  ask: (dialog: Exclude<DialogState, null>) => void;
  closeDialog: () => void;

  refreshPublic: () => Promise<void>;
};

export type ServiceFormFields = {
  category_id: number;
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  image_url: string;
  audience: string;
  is_active: boolean;
};

export type SalonFormFields = {
  name: string;
  city: string;
  address: string;
  phone: string;
  opens_at: string;
  closes_at: string;
  image_url: string;
  is_active: boolean;
};

export type CampaignFormFields = {
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
};

export const NaturalsContext = createContext<NaturalsContextValue | null>(null);

export function useNaturals() {
  const value = useContext(NaturalsContext);
  if (!value) throw new Error("NaturalsContext is missing.");
  return value;
}
