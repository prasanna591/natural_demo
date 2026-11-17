from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AdminLoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class DeveloperModeUpdate(BaseModel):
    enabled: bool


class DeveloperSettingsUpdate(BaseModel):
    settings: dict[str, str]

    @field_validator("settings")
    @classmethod
    def valid_settings(cls, value: dict[str, str]) -> dict[str, str]:
        limits = {
            "promo_banner_enabled": 5,
            "promo_banner_title": 120,
            "promo_banner_message": 300,
            "promo_banner_cta": 40,
        }
        for key, setting in value.items():
            if key not in limits:
                raise ValueError(f"Unsupported setting: {key}.")
            if len(setting) > limits[key]:
                raise ValueError(f"{key} must be at most {limits[key]} characters.")
            if key == "promo_banner_enabled" and setting not in {"true", "false"}:
                raise ValueError("promo_banner_enabled must be true or false.")
            if key in {"promo_banner_title", "promo_banner_cta"} and not setting.strip():
                raise ValueError(f"{key} cannot be empty.")
        return value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class SalonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    address: str
    phone: str
    opens_at: str
    closes_at: str
    image_url: str | None = None
    is_active: bool = True
    is_demo: bool
    average_rating: float | None = None
    review_count: int = 0


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class ServiceOut(BaseModel):
    id: int
    category_id: int
    category: str
    name: str
    description: str
    duration_minutes: int
    price: Decimal
    image_url: str | None = None
    audience: str
    is_active: bool = True
    is_demo: bool


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    title: str
    salon_id: int


class SlotOut(BaseModel):
    time: str
    staff: list[StaffOut]


class AvailabilityOut(BaseModel):
    date: date
    service_duration_minutes: int
    slots: list[SlotOut]


class BookingCreate(BaseModel):
    salon_id: int
    service_id: int
    staff_id: int | None = None
    date: date
    start_time: str
    offer_code: str | None = Field(default=None, max_length=32)

    @field_validator("start_time")
    @classmethod
    def valid_time(cls, value: str) -> str:
        from datetime import time

        try:
            time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Use a valid 24-hour time such as 10:30.") from exc
        if len(value) != 5:
            raise ValueError("Use a valid 24-hour time such as 10:30.")
        return value


class BookingOut(BaseModel):
    id: int
    reference: str
    status: str
    date: date
    start_time: str
    end_time: str
    salon: SalonOut
    service: ServiceOut
    stylist: StaffOut
    price: Decimal
    discount: Decimal
    total: Decimal
    offer_code: str | None
    customer_name: str | None = None
    customer_email: str | None = None


class OfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    title: str
    description: str
    discount_percent: int
    is_demo: bool


class ServiceCreate(BaseModel):
    category_id: int
    name: str = Field(min_length=2, max_length=140)
    description: str = Field(min_length=2, max_length=600)
    duration_minutes: int = Field(ge=15, le=480)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    image_url: str | None = None
    audience: str = Field(default="Everyone", max_length=32)
    is_active: bool = True


class ServiceUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = Field(default=None, min_length=2, max_length=140)
    description: str | None = Field(default=None, min_length=2, max_length=600)
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    image_url: str | None = None
    audience: str | None = Field(default=None, max_length=32)
    is_active: bool | None = None


class SalonCreate(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    city: str = Field(min_length=2, max_length=80)
    address: str = Field(min_length=2, max_length=240)
    phone: str = Field(min_length=3, max_length=40)
    opens_at: str = "10:00"
    closes_at: str = "21:00"
    image_url: str | None = None
    is_active: bool = True


class SalonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=140)
    city: str | None = Field(default=None, min_length=2, max_length=80)
    address: str | None = Field(default=None, min_length=2, max_length=240)
    phone: str | None = Field(default=None, min_length=3, max_length=40)
    opens_at: str | None = None
    closes_at: str | None = None
    image_url: str | None = None
    is_active: bool | None = None


class BookingUpdate(BaseModel):
    status: str | None = None
    salon_id: int | None = None
    service_id: int | None = None
    staff_id: int | None = None
    appointment_date: date | None = Field(default=None, alias="date")
    start_time: str | None = None


class MediaFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    original_name: str
    mime_type: str
    size: int
    url: str
    category: str
    uploaded_by: int | None = None
    created_at: datetime


class MediaUploadResponse(BaseModel):
    media: MediaFileOut


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subtitle: str | None = None
    description: str
    image_id: int | None = None
    image_url: str | None = None
    cta_label: str
    cta_url: str | None = None
    audience: str = "Everyone"
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool
    position: int
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime


class CampaignCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    subtitle: str | None = Field(default=None, max_length=300)
    description: str = Field(min_length=2, max_length=600)
    image_id: int | None = None
    image_url: str | None = None
    cta_label: str = Field(default="Explore", max_length=80)
    cta_url: str | None = Field(default=None, max_length=200)
    audience: str = Field(default="Everyone", max_length=32)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True
    position: int = 0


class CampaignUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    subtitle: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, min_length=2, max_length=600)
    image_id: int | None = None
    image_url: str | None = None
    cta_label: str | None = Field(default=None, max_length=80)
    cta_url: str | None = Field(default=None, max_length=200)
    audience: str | None = Field(default=None, max_length=32)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    position: int | None = None


class ServiceBranchPriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_id: int
    salon_id: int
    price: Decimal
    is_available: bool = True


class ServiceBranchPriceCreate(BaseModel):
    salon_id: int
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    is_available: bool = True


class ServiceBranchPriceUpdate(BaseModel):
    price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    is_available: bool | None = None


class AdminBranchServiceOut(BaseModel):
    service_id: int
    name: str
    category: str
    duration_minutes: int
    base_price: Decimal
    branch_price: Decimal | None = None
    is_available: bool = True
    has_override: bool = False
    is_active: bool = True


class AdminBranchServiceUpdate(BaseModel):
    price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    is_available: bool | None = None


class AnalyticsPoint(BaseModel):
    date: str
    bookings: int
    revenue: Decimal


class AnalyticsOut(BaseModel):
    total_bookings: int
    today: int
    upcoming: int
    pending: int
    completed: int
    cancelled: int
    revenue: Decimal
    range_total: int = 0
    range_pending: int = 0
    range_completed: int = 0
    range_cancelled: int = 0
    range_revenue: Decimal = Decimal("0")
    range_start: date | None = None
    range_end: date | None = None
    trend: list[AnalyticsPoint]
    status_breakdown: list[dict[str, object]]
    branch_breakdown: list[dict[str, object]]


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: int
    actor_name: str | None = None
    actor_email: str | None = None
    actor_role: str | None = None
    action: str
    entity: str
    entity_id: str
    detail: str | None = None
    created_at: datetime


class UserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: str = Field(min_length=1, max_length=24)


class PageContentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    value: str
    content_type: str
    updated_by: int | None = None
    updated_at: datetime


class PageContentUpdate(BaseModel):
    value: str
    content_type: str | None = "text"


class ReviewBase(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=160)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewCreate(ReviewBase):
    salon_id: int
    service_id: int | None = None


class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    title: str | None = Field(default=None, max_length=160)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewModerationUpdate(BaseModel):
    is_active: bool


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    salon_id: int
    service_id: int | None = None
    user_id: int
    rating: int
    title: str | None = None
    comment: str | None = None
    is_active: bool = True
    created_at: datetime
    customer_name: str | None = None


class ReviewSummary(BaseModel):
    salon_id: int
    average_rating: float | None = None
    review_count: int = 0

