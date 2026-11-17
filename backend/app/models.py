from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Column,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .timeutils import utc_now


staff_services = Table(
    "staff_services",
    Base.metadata,
    Column("staff_id", ForeignKey("staff.id", ondelete="CASCADE"), primary_key=True),
    Column("service_id", ForeignKey("services.id", ondelete="CASCADE"), primary_key=True),
    # The composite primary key covers staff_id -> service_id lookups; this
    # reverse index covers "which stylists can perform this service".
    Index("ix_staff_services_service_staff", "service_id", "staff_id"),
)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(24), default="customer")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class Salon(Base):
    __tablename__ = "salons"
    __table_args__ = (
        Index("ix_salons_active_city_name", "is_active", "city", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(140))
    city: Mapped[str] = mapped_column(String(80), index=True)
    address: Mapped[str] = mapped_column(String(240))
    phone: Mapped[str] = mapped_column(String(40))
    opens_at: Mapped[str] = mapped_column(String(5), default="10:00")
    closes_at: Mapped[str] = mapped_column(String(5), default="21:00")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    staff: Mapped[list["Staff"]] = relationship(back_populates="salon")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)


class Service(Base):
    __tablename__ = "services"
    __table_args__ = (
        Index("ix_services_active_category_name", "is_active", "category_id", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(String(600))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    audience: Mapped[str] = mapped_column(String(32), default="Everyone")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    category: Mapped[Category] = relationship()


class Staff(Base):
    __tablename__ = "staff"
    __table_args__ = (
        Index("ix_staff_salon_active_name", "salon_id", "is_active", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    salon_id: Mapped[int] = mapped_column(ForeignKey("salons.id"))
    name: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(120), default="Stylist")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    salon: Mapped[Salon] = relationship(back_populates="staff")
    services: Mapped[list[Service]] = relationship(secondary=staff_services)


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        UniqueConstraint("reference", name="uq_booking_reference"),
        # Conflict checks and availability both filter by stylist, status and an
        # overlapping time window, then drop bookings outside the day.
        Index("ix_bookings_staff_status_starts", "staff_id", "status", "starts_at", "ends_at"),
        Index("ix_bookings_user_starts", "user_id", "starts_at"),
        Index("ix_bookings_salon_starts", "salon_id", "starts_at"),
        Index("ix_bookings_status_starts", "status", "starts_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(20))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    salon_id: Mapped[int] = mapped_column(ForeignKey("salons.id"))
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(24), default="confirmed")
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    offer_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    user: Mapped[User] = relationship()
    salon: Mapped[Salon] = relationship()
    service: Mapped[Service] = relationship()
    staff: Mapped[Staff] = relationship()


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (
        Index("ix_offers_active_window", "active", "ends_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(300))
    discount_percent: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    max_uses: Mapped[int] = mapped_column(Integer, default=100)
    uses: Mapped[int] = mapped_column(Integer, default=0)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(String(600))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_actor_id", "actor_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str | None] = mapped_column(String(600), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    actor: Mapped["User"] = relationship()

    @property
    def actor_name(self) -> str | None:
        return self.actor.name if self.actor else None

    @property
    def actor_email(self) -> str | None:
        return self.actor.email if self.actor else None

    @property
    def actor_role(self) -> str | None:
        return self.actor.role if self.actor else None


class MediaFile(Base):
    __tablename__ = "media_files"
    __table_args__ = (
        Index("ix_media_files_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    original_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    url: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(40), default="general")
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    uploader: Mapped["User | None"] = relationship()


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        Index("ix_campaigns_active_position", "is_active", "position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    subtitle: Mapped[str | None] = mapped_column(String(300), nullable=True)
    description: Mapped[str] = mapped_column(String(600))
    image_id: Mapped[int | None] = mapped_column(ForeignKey("media_files.id", ondelete="SET NULL"), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cta_label: Mapped[str] = mapped_column(String(80), default="Explore")
    cta_url: Mapped[str | None] = mapped_column(String(200), nullable=True)
    audience: Mapped[str] = mapped_column(String(32), default="Everyone")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
    creator: Mapped["User | None"] = relationship()
    image: Mapped["MediaFile | None"] = relationship()


class ServiceBranchPrice(Base):
    __tablename__ = "service_branch_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"))
    salon_id: Mapped[int] = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("service_id", "salon_id", name="uq_service_branch_price"),
        # Branch catalog pages list every service for one salon, which is the
        # opposite leading column order from the unique constraint above.
        Index("ix_branch_prices_salon_service", "salon_id", "service_id"),
    )


class PageContent(Base):
    __tablename__ = "page_content"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    value: Mapped[str] = mapped_column(String(2000))
    content_type: Mapped[str] = mapped_column(String(40), default="text")
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    salon_id: Mapped[int] = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"))
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    comment: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("user_id", "salon_id", name="uq_user_salon_review"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
        Index("ix_reviews_salon_active_created", "salon_id", "is_active", "created_at"),
    )

    salon: Mapped["Salon"] = relationship()
    service: Mapped["Service | None"] = relationship()
    user: Mapped["User"] = relationship()
