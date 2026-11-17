from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
import os
import re
import secrets

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, status, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import case, func, or_, select, text
from sqlalchemy.orm import Session, joinedload
from starlette.middleware.gzip import GZipMiddleware

from . import metrics, models, schemas
from .auth import create_access_token, get_current_user, has_admin_access, hash_password, require_admin, require_developer, verify_password
from .cache import PUBLIC_LONG_TTL, PUBLIC_TTL, cache, invalidate_public_cache, public_key
from .database import Base, SessionLocal, engine, get_db
from .models import AppSetting, AuditLog, Booking, Campaign, Category, MediaFile, Offer, PageContent, Review, Salon, Service, ServiceBranchPrice, Staff, User
from .observability import ObservabilityMiddleware, configure_logging, request_id_var
from .rate_limit import RateLimitMiddleware
from .schema import ensure_schema
from .seed import seed_content, seed_data, seed_official_branch_prices, seed_official_services, seed_verified_branches
from .startup import startup_lock
from .timeutils import local_now, utc_now


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
APP_STARTED_AT = utc_now()


def _detect_image_extension(contents: bytes) -> str | None:
    """Identify a supported image from its magic bytes instead of trusting the filename."""
    if contents.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if contents.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if len(contents) >= 12 and contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return ".webp"
    return None


def _validate_image_upload(file: UploadFile, contents: bytes) -> str:
    original_name = file.filename or "upload"
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG and WebP images are supported.")
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Image file is too large (maximum 10 MB).")
    detected = _detect_image_extension(contents)
    if detected is None:
        raise HTTPException(status_code=400, detail="The file is not a valid JPG, PNG or WebP image.")
    if detected == ".jpg" and ext not in {".jpg", ".jpeg"}:
        raise HTTPException(status_code=400, detail="The file extension does not match the image content.")
    if detected != ".jpg" and ext != detected:
        raise HTTPException(status_code=400, detail="The file extension does not match the image content.")
    return detected


def _media_reference_urls(db: Session, media: MediaFile) -> None:
    """Detach a media record from catalog and campaign rows before it disappears."""
    for service in db.scalars(select(Service).where(Service.image_url == media.url)).all():
        service.image_url = None
    for salon in db.scalars(select(Salon).where(Salon.image_url == media.url)).all():
        salon.image_url = None
    for campaign in db.scalars(select(Campaign).where(Campaign.image_url == media.url)).all():
        campaign.image_url = None
    for campaign in db.scalars(select(Campaign).where(Campaign.image_id == media.id)).all():
        campaign.image_id = None


def _repoint_media_references(db: Session, old_url: str, new_url: str) -> None:
    for service in db.scalars(select(Service).where(Service.image_url == old_url)).all():
        service.image_url = new_url
    for salon in db.scalars(select(Salon).where(Salon.image_url == old_url)).all():
        salon.image_url = new_url
    for campaign in db.scalars(select(Campaign).where(Campaign.image_url == old_url)).all():
        campaign.image_url = new_url


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    # Multi-worker deployments should run ``python -m app.bootstrap`` once and
    # then set RUN_STARTUP_MIGRATIONS=false on the workers. When enabled, the
    # startup lock keeps concurrent workers from racing Alembic and seeding.
    if _truthy(os.getenv("RUN_STARTUP_MIGRATIONS", "true")):
        with startup_lock():
            ensure_schema()
            with SessionLocal() as db:
                seed_data(db)
                seed_official_services(db)
                seed_verified_branches(db)
                seed_official_branch_prices(db)
                seed_content(db)
    yield


app = FastAPI(
    title="Naturals Salon API",
    version="1.0.0",
    description="Customer booking and salon management API for the Naturals demo application.",
    lifespan=lifespan,
)

# Middleware order matters. The last middleware added is the outermost one, so
# CORS wraps error responses, request IDs wrap rate-limit rejections, and
# compression sits closest to the application.
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(ObservabilityMiddleware)
_dev_origins = "http://localhost:8000,http://127.0.0.1:8000,http://localhost:19006,http://127.0.0.1:19006"
raw_origins = os.getenv("CORS_ORIGINS", _dev_origins)
allow_credentials = _truthy(os.getenv("CORS_ALLOW_CREDENTIALS", "true"))
origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
if "*" in origins and allow_credentials and os.getenv("ENV") != "production":
    raise RuntimeError("CORS wildcard origin is not allowed with credentials unless ENV=production.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

ACTIVE_BOOKING_STATUSES = ("confirmed",)
SLOT_INTERVAL_MINUTES = 30
PUBLIC_SETTING_DEFAULTS = {
    "promo_banner_enabled": "false",
    "promo_banner_title": "Your next ritual, made special",
    "promo_banner_message": "Browse treatments and find a time that works for you.",
    "promo_banner_cta": "Explore offers",
}
DEVELOPER_MODE_KEY = "developer_mode_enabled"


def _read_app_settings(db: Session, defaults: dict[str, str]) -> dict[str, str]:
    rows = db.scalars(select(AppSetting).where(AppSetting.key.in_(defaults))).all()
    values = defaults.copy()
    values.update({row.key: row.value for row in rows})
    return values


def _write_app_setting(db: Session, key: str, value: str, actor: User) -> None:
    setting = db.get(AppSetting, key)
    if setting is None:
        setting = AppSetting(key=key, value=value, updated_by=actor.id)
        db.add(setting)
    else:
        setting.value = value
        setting.updated_by = actor.id
    db.add(AuditLog(actor_id=actor.id, action="update", entity="app_setting", entity_id=key))


def service_out(service: Service, price: Decimal | None = None) -> schemas.ServiceOut:
    description = service.description
    if price is not None and Decimal(price) != Decimal(service.price):
        # Keep the leading price note honest when a branch override is applied.
        description = re.sub(
            r"^(Starting price|Published price|Price range|Branch starting price): [^.]+\.\s*",
            f"Branch starting price: ₹{Decimal(price):,.0f}. ",
            description,
            count=1,
        )
    return schemas.ServiceOut(
        id=service.id,
        category_id=service.category_id,
        category=service.category.name,
        name=service.name,
        description=description,
        duration_minutes=service.duration_minutes,
        price=price if price is not None else service.price,
        image_url=service.image_url,
        audience=service.audience,
        is_active=service.is_active,
        is_demo=service.is_demo,
    )


def _branch_price_row(db: Session, service_id: int, salon_id: int) -> ServiceBranchPrice | None:
    return db.scalar(
        select(ServiceBranchPrice).where(
            ServiceBranchPrice.service_id == service_id,
            ServiceBranchPrice.salon_id == salon_id,
        )
    )


def _price_from_branch_row(service: Service, row: ServiceBranchPrice | None) -> Decimal:
    if row is not None and row.is_available:
        return Decimal(row.price).quantize(Decimal("0.01"))
    return Decimal(service.price).quantize(Decimal("0.01"))


def _ensure_service_available_at_branch(
    db: Session, service: Service, salon_id: int
) -> ServiceBranchPrice | None:
    """Return the branch override (if any) while validating availability."""
    row = _branch_price_row(db, service.id, salon_id)
    if row is not None and not row.is_available:
        raise HTTPException(
            status_code=409,
            detail=f"{service.name} is not available at this branch.",
        )
    return row


def _audit(db: Session, actor: User, action: str, entity: str, entity_id: str | int, detail: str | None = None) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id,
            action=action,
            entity=entity,
            entity_id=str(entity_id),
            detail=detail,
        )
    )


def booking_out(booking: Booking, user: User | None = None) -> schemas.BookingOut:
    return schemas.BookingOut(
        id=booking.id,
        reference=booking.reference,
        status=booking.status,
        date=booking.starts_at.date(),
        start_time=booking.starts_at.strftime("%H:%M"),
        end_time=booking.ends_at.strftime("%H:%M"),
        salon=booking.salon,
        service=service_out(booking.service),
        stylist=booking.staff,
        price=booking.price,
        discount=booking.discount,
        total=booking.price - booking.discount,
        offer_code=booking.offer_code,
        customer_name=user.name if user else None,
        customer_email=user.email if user else None,
    )


def review_out(review: Review) -> schemas.ReviewOut:
    return schemas.ReviewOut(
        id=review.id,
        salon_id=review.salon_id,
        service_id=review.service_id,
        user_id=review.user_id,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        is_active=review.is_active,
        created_at=review.created_at,
        customer_name=review.user.name if review.user else None,
    )


def _attach_salon_ratings(db: Session, salons: list[Salon]) -> None:
    if not salons:
        return
    rows = db.execute(
        select(Review.salon_id, func.avg(Review.rating), func.count(Review.id))
        .where(
            Review.salon_id.in_([salon.id for salon in salons]),
            Review.is_active.is_(True),
        )
        .group_by(Review.salon_id)
    ).all()
    rating_map = {
        row[0]: (float(row[1]) if row[1] is not None else None, int(row[2] or 0))
        for row in rows
    }
    for salon in salons:
        average, count = rating_map.get(salon.id, (None, 0))
        salon.average_rating = average
        salon.review_count = count


def _eligible_staff(db: Session, salon_id: int, service_id: int) -> list[Staff]:
    return list(
        db.scalars(
            select(Staff)
            .join(Staff.services)
            .where(
                Staff.salon_id == salon_id,
                Staff.is_active.is_(True),
                Service.id == service_id,
                Service.is_active.is_(True),
            )
            .order_by(Staff.id)
        ).all()
    )


def _conflicting_staff_ids(
    db: Session,
    staff_ids: list[int],
    starts_at: datetime,
    ends_at: datetime,
    exclude_booking_id: int | None = None,
) -> set[int]:
    """One query returns every stylist busy during the requested interval."""
    if not staff_ids:
        return set()
    query = (
        select(Booking.staff_id)
        .where(
            Booking.staff_id.in_(staff_ids),
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.starts_at < ends_at,
            Booking.ends_at > starts_at,
        )
        .distinct()
    )
    if exclude_booking_id is not None:
        query = query.where(Booking.id != exclude_booking_id)
    return set(db.scalars(query).all())


def _day_conflicts(
    db: Session,
    staff_ids: list[int],
    day_start: datetime,
    day_end: datetime,
    exclude_booking_id: int | None = None,
) -> dict[int, list[tuple[datetime, datetime]]]:
    """Load every confirmed booking for the day once instead of per slot."""
    conflicts: dict[int, list[tuple[datetime, datetime]]] = {}
    if not staff_ids:
        return conflicts
    query = select(Booking.staff_id, Booking.starts_at, Booking.ends_at).where(
        Booking.staff_id.in_(staff_ids),
        Booking.status.in_(ACTIVE_BOOKING_STATUSES),
        Booking.starts_at < day_end,
        Booking.ends_at > day_start,
    )
    if exclude_booking_id is not None:
        query = query.where(Booking.id != exclude_booking_id)
    for staff_id, starts_at, ends_at in db.execute(query).all():
        conflicts.setdefault(staff_id, []).append((starts_at, ends_at))
    return conflicts


def _available_staff(
    db: Session,
    salon: Salon,
    service: Service,
    appointment_date: date,
    start_time: time,
    exclude_booking_id: int | None = None,
) -> list[Staff]:
    starts_at = datetime.combine(appointment_date, start_time)
    ends_at = starts_at + timedelta(minutes=service.duration_minutes)
    opening = time.fromisoformat(salon.opens_at)
    closing = time.fromisoformat(salon.closes_at)
    if start_time < opening or ends_at.time() > closing:
        return []
    today = local_now().date()
    now = local_now()
    if appointment_date < today or (appointment_date == today and starts_at <= now):
        return []
    eligible = _eligible_staff(db, salon.id, service.id)
    busy = _conflicting_staff_ids(
        db, [person.id for person in eligible], starts_at, ends_at, exclude_booking_id
    )
    return [person for person in eligible if person.id not in busy]


def _validate_offer(db: Session, code: str | None, now: datetime) -> Offer | None:
    if not code:
        return None
    offer = db.scalar(select(Offer).where(func.upper(Offer.code) == code.strip().upper()))
    if (
        offer is None
        or not offer.active
        or not offer.starts_at <= now <= offer.ends_at
        or offer.uses >= offer.max_uses
    ):
        raise HTTPException(status_code=400, detail="That offer code is invalid, expired, or no longer available.")
    return offer


def _lock_booking_capacity(db: Session, salon_id: int) -> None:
    if engine.dialect.name == "sqlite":
        db.execute(text("BEGIN IMMEDIATE"))
    else:
        db.scalar(select(Salon.id).where(Salon.id == salon_id).with_for_update())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/live")
def health_live() -> dict[str, str]:
    """Process liveness. Does not touch the database."""
    return {"status": "alive"}


@app.get("/health/ready")
def health_ready():
    """Readiness probe used by a load balancer before sending traffic."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - readiness must never raise
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": "unavailable"},
        )
    return {
        "status": "ready",
        "database": "ok",
        "cache_entries": cache.stats()["entries"],
    }


@app.get("/metrics", response_class=PlainTextResponse)
def metrics_endpoint(request: Request):
    """Prometheus text exposition. Optionally protected by METRICS_TOKEN."""
    token = os.getenv("METRICS_TOKEN")
    if token and request.headers.get("authorization") != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Metrics token required.")
    return PlainTextResponse(
        metrics.render_prometheus(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@app.post("/auth/register", response_model=schemas.AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)) -> schemas.AuthResponse:
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.AuthResponse(access_token=create_access_token(user), user=user)


@app.post("/auth/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)) -> schemas.AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is inactive.")
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Use the administrator sign-in option for this account.")
    return schemas.AuthResponse(access_token=create_access_token(user), user=user)


@app.post("/auth/admin-login", response_model=schemas.AuthResponse)
def admin_login(payload: schemas.AdminLoginRequest, db: Session = Depends(get_db)) -> schemas.AuthResponse:
    identifier = payload.identifier.strip().casefold()
    matches = list(
        db.scalars(
            select(User).where(
                (func.lower(User.email) == identifier)
                | (func.lower(User.name) == identifier)
            )
        ).all()
    )
    user = matches[0] if len(matches) == 1 else None
    if (
        user is None
        or user.role not in {"admin", "developer"}
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Administrator username or password is incorrect.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is inactive.")
    return schemas.AuthResponse(access_token=create_access_token(user), user=user)


@app.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@app.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    user.name = payload.name.strip()
    db.commit()
    db.refresh(user)
    return user


@app.get("/categories", response_model=list[schemas.CategoryOut])
def categories(db: Session = Depends(get_db)) -> list[schemas.CategoryOut]:
    def load() -> list[schemas.CategoryOut]:
        rows = db.scalars(select(Category).order_by(Category.name)).all()
        return [schemas.CategoryOut.model_validate(row) for row in rows]

    return cache.get_or_set(public_key("categories"), PUBLIC_LONG_TTL, load)


@app.get("/services", response_model=list[schemas.ServiceOut])
def services(
    q: str | None = None,
    category: str | None = None,
    audience: str | None = None,
    salon_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[schemas.ServiceOut]:
    def load() -> list[schemas.ServiceOut]:
        query = select(Service).options(joinedload(Service.category)).where(Service.is_active.is_(True))
        if q:
            pattern = f"%{q.strip()}%"
            query = query.where(or_(Service.name.ilike(pattern), Service.description.ilike(pattern)))
        if category:
            query = query.join(Service.category).where(Category.slug == category.lower())
        if audience:
            query = query.where(or_(Service.audience == "Everyone", Service.audience == audience))
        items = db.scalars(query.order_by(Service.category_id, Service.name)).unique().all()
        if salon_id is None:
            return [service_out(item) for item in items]

        salon = db.get(Salon, salon_id)
        if salon is None or not salon.is_active:
            raise HTTPException(status_code=404, detail="Salon not found.")
        branch_rows = {
            row.service_id: row
            for row in db.scalars(
                select(ServiceBranchPrice).where(
                    ServiceBranchPrice.salon_id == salon_id,
                    ServiceBranchPrice.service_id.in_([item.id for item in items] or [-1]),
                )
            ).all()
        }
        result: list[schemas.ServiceOut] = []
        for item in items:
            row = branch_rows.get(item.id)
            if row is not None and not row.is_available:
                continue
            result.append(service_out(item, Decimal(row.price) if row is not None else None))
        return result

    key = public_key("services", q or "", category or "", audience or "", salon_id or 0)
    return cache.get_or_set(key, PUBLIC_TTL, load)


@app.get("/services/{service_id}", response_model=schemas.ServiceOut)
def service_detail(service_id: int, db: Session = Depends(get_db)) -> schemas.ServiceOut:
    def load() -> schemas.ServiceOut:
        item = db.scalar(
            select(Service)
            .options(joinedload(Service.category))
            .where(Service.id == service_id, Service.is_active.is_(True))
        )
        if item is None:
            raise HTTPException(status_code=404, detail="Service not found.")
        return service_out(item)

    return cache.get_or_set(public_key("service", service_id), PUBLIC_TTL, load)


@app.get("/salons", response_model=list[schemas.SalonOut])
def salons(city: str | None = None, q: str | None = None, db: Session = Depends(get_db)) -> list[schemas.SalonOut]:
    def load() -> list[schemas.SalonOut]:
        query = select(Salon).where(Salon.is_active.is_(True))
        if city:
            query = query.where(Salon.city.ilike(f"%{city.strip()}%"))
        if q:
            query = query.where(or_(Salon.name.ilike(f"%{q.strip()}%"), Salon.city.ilike(f"%{q.strip()}%")))
        items = list(db.scalars(query.order_by(Salon.is_demo, Salon.city, Salon.name)).all())
        _attach_salon_ratings(db, items)
        return [schemas.SalonOut.model_validate(salon) for salon in items]

    return cache.get_or_set(public_key("salons", city or "", q or ""), PUBLIC_TTL, load)


@app.get("/salons/{salon_id}", response_model=schemas.SalonOut)
def salon_detail(salon_id: int, db: Session = Depends(get_db)) -> schemas.SalonOut:
    def load() -> schemas.SalonOut:
        salon = db.get(Salon, salon_id)
        if salon is None or not salon.is_active:
            raise HTTPException(status_code=404, detail="Salon not found.")
        _attach_salon_ratings(db, [salon])
        return schemas.SalonOut.model_validate(salon)

    return cache.get_or_set(public_key("salon", salon_id), PUBLIC_TTL, load)


@app.get("/salons/{salon_id}/staff", response_model=list[schemas.StaffOut])
def salon_staff(
    salon_id: int,
    service_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.StaffOut]:
    def load() -> list[schemas.StaffOut]:
        query = select(Staff).where(Staff.salon_id == salon_id, Staff.is_active.is_(True))
        if service_id is not None:
            query = query.join(Staff.services).where(Service.id == service_id)
        rows = db.scalars(query.order_by(Staff.name)).unique().all()
        return [schemas.StaffOut.model_validate(person) for person in rows]

    return cache.get_or_set(public_key("staff", salon_id, service_id or 0), PUBLIC_TTL, load)


@app.get("/reviews/summary", response_model=schemas.ReviewSummary)
def review_summary(
    salon_id: int = Query(alias="salon_id"),
    db: Session = Depends(get_db),
) -> schemas.ReviewSummary:
    def load() -> schemas.ReviewSummary:
        row = db.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(
                Review.salon_id == salon_id,
                Review.is_active.is_(True),
            )
        ).one()
        average, count = row
        return schemas.ReviewSummary(
            salon_id=salon_id,
            average_rating=round(float(average), 2) if average is not None else None,
            review_count=int(count or 0),
        )

    return cache.get_or_set(public_key("review-summary", salon_id), PUBLIC_TTL, load)


@app.get("/reviews", response_model=list[schemas.ReviewOut])
def list_reviews(
    salon_id: int | None = Query(default=None),
    service_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[schemas.ReviewOut]:
    def load() -> list[schemas.ReviewOut]:
        query = select(Review).options(joinedload(Review.user)).where(Review.is_active.is_(True))
        if salon_id is not None:
            query = query.where(Review.salon_id == salon_id)
        if service_id is not None:
            query = query.where(Review.service_id == service_id)
        items = db.scalars(
            query.order_by(Review.created_at.desc()).offset(offset).limit(limit)
        ).all()
        return [review_out(item) for item in items]

    key = public_key("reviews", salon_id or 0, service_id or 0, limit, offset)
    return cache.get_or_set(key, PUBLIC_TTL, load)


@app.post("/reviews", response_model=schemas.ReviewOut, status_code=status.HTTP_201_CREATED)
def create_or_update_review(
    payload: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ReviewOut:
    salon = db.get(Salon, payload.salon_id)
    if salon is None or not salon.is_active:
        raise HTTPException(status_code=404, detail="Salon not found.")
    if payload.service_id is not None:
        service = db.get(Service, payload.service_id)
        if service is None or not service.is_active:
            raise HTTPException(status_code=404, detail="Service not found.")
    existing = db.scalar(
        select(Review).where(Review.user_id == user.id, Review.salon_id == payload.salon_id)
    )
    now = utc_now()
    if existing is None:
        review = Review(
            salon_id=payload.salon_id,
            service_id=payload.service_id,
            user_id=user.id,
            rating=payload.rating,
            title=payload.title,
            comment=payload.comment,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(review)
        db.flush()
        db.add(AuditLog(actor_id=user.id, action="create", entity="review", entity_id=str(review.id)))
    else:
        if not existing.is_active:
            raise HTTPException(status_code=409, detail="Review is hidden and cannot be resubmitted.")
        existing.rating = payload.rating
        existing.title = payload.title
        existing.comment = payload.comment
        existing.service_id = payload.service_id
        existing.updated_at = now
        review = existing
        db.add(AuditLog(actor_id=user.id, action="update", entity="review", entity_id=str(review.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(review)
    return review_out(review)


@app.patch("/reviews/{review_id}", response_model=schemas.ReviewOut)
def update_review(
    review_id: int,
    payload: schemas.ReviewUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.ReviewOut:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")
    if review.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own review.")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update.")
    for key, value in data.items():
        setattr(review, key, value)
    review.updated_at = utc_now()
    db.add(AuditLog(actor_id=user.id, action="update", entity="review", entity_id=str(review.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(review)
    return review_out(review)


@app.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")
    if review.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own review.")
    review.is_active = False
    review.updated_at = utc_now()
    db.add(AuditLog(actor_id=user.id, action="delete", entity="review", entity_id=str(review.id)))
    db.commit()
    invalidate_public_cache()
    return None


@app.get("/admin/reviews", response_model=list[schemas.ReviewOut])
def admin_list_reviews(
    salon_id: int | None = Query(default=None),
    service_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[schemas.ReviewOut]:
    query = select(Review).options(joinedload(Review.user))
    if salon_id is not None:
        query = query.where(Review.salon_id == salon_id)
    if service_id is not None:
        query = query.where(Review.service_id == service_id)
    if is_active is not None:
        query = query.where(Review.is_active.is_(is_active))
    items = db.scalars(
        query.order_by(Review.created_at.desc()).offset(offset).limit(limit)
    ).all()
    return [review_out(item) for item in items]


@app.patch("/admin/reviews/{review_id}", response_model=schemas.ReviewOut)
def admin_update_review(
    review_id: int,
    payload: schemas.ReviewModerationUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> schemas.ReviewOut:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update.")
    for key, value in data.items():
        setattr(review, key, value)
    review.updated_at = utc_now()
    db.add(AuditLog(actor_id=admin.id, action="moderate", entity="review", entity_id=str(review.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(review)
    return review_out(review)


@app.delete("/admin/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found.")
    db.add(AuditLog(actor_id=admin.id, action="delete", entity="review", entity_id=str(review.id)))
    db.delete(review)
    db.commit()
    invalidate_public_cache()
    return None


@app.get("/availability", response_model=schemas.AvailabilityOut)
def availability(
    salon_id: int,
    service_id: int,
    appointment_date: date = Query(alias="date"),
    db: Session = Depends(get_db),
) -> schemas.AvailabilityOut:
    salon = db.get(Salon, salon_id)
    service = db.get(Service, service_id)
    if salon is None or not salon.is_active:
        raise HTTPException(status_code=404, detail="Salon not found.")
    if service is None or not service.is_active:
        raise HTTPException(status_code=404, detail="Service not found.")
    _ensure_service_available_at_branch(db, service, salon.id)
    opening = time.fromisoformat(salon.opens_at)
    closing = time.fromisoformat(salon.closes_at)
    if appointment_date < local_now().date():
        return schemas.AvailabilityOut(
            date=appointment_date, service_duration_minutes=service.duration_minutes, slots=[]
        )

    eligible = _eligible_staff(db, salon.id, service.id)
    if not eligible:
        return schemas.AvailabilityOut(
            date=appointment_date, service_duration_minutes=service.duration_minutes, slots=[]
        )

    day_start = datetime.combine(appointment_date, time.min)
    day_end = day_start + timedelta(days=1)
    conflicts = _day_conflicts(db, [person.id for person in eligible], day_start, day_end)
    staff_out = [
        schemas.StaffOut(id=person.id, name=person.name, title=person.title, salon_id=person.salon_id)
        for person in eligible
    ]

    slots: list[schemas.SlotOut] = []
    cursor = datetime.combine(appointment_date, opening)
    closing_at = datetime.combine(appointment_date, closing)
    service_length = timedelta(minutes=service.duration_minutes)
    now = local_now()
    while cursor + service_length <= closing_at:
        slot_end = cursor + service_length
        if cursor > now:
            available = [
                person_out
                for person, person_out in zip(eligible, staff_out)
                if not any(
                    booking_start < slot_end and booking_end > cursor
                    for booking_start, booking_end in conflicts.get(person.id, ())
                )
            ]
            if available:
                slots.append(
                    schemas.SlotOut(time=cursor.strftime("%H:%M"), staff=list(available))
                )
        cursor += timedelta(minutes=SLOT_INTERVAL_MINUTES)
    return schemas.AvailabilityOut(
        date=appointment_date, service_duration_minutes=service.duration_minutes, slots=slots
    )


@app.post("/bookings", response_model=schemas.BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: schemas.BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.BookingOut:
    salon = db.get(Salon, payload.salon_id)
    service = db.scalar(
        select(Service).options(joinedload(Service.category)).where(Service.id == payload.service_id)
    )
    if salon is None or not salon.is_active:
        raise HTTPException(status_code=404, detail="Salon not found.")
    if service is None or not service.is_active:
        raise HTTPException(status_code=404, detail="Service not found.")
    try:
        starts_time = time.fromisoformat(payload.start_time)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Choose a valid appointment time.") from exc

    try:
        _lock_booking_capacity(db, salon.id)
        available = _available_staff(db, salon, service, payload.date, starts_time)
        if not available:
            raise HTTPException(status_code=409, detail="That time is no longer available. Choose another slot.")
        staff = next((person for person in available if person.id == payload.staff_id), None) if payload.staff_id else available[0]
        if staff is None:
            raise HTTPException(status_code=409, detail="That stylist is no longer available. Choose another option.")

        branch_row = _ensure_service_available_at_branch(db, service, salon.id)
        offer = _validate_offer(db, payload.offer_code, utc_now())
        price = _price_from_branch_row(service, branch_row)
        discount = (
            (price * Decimal(offer.discount_percent) / Decimal(100)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if offer
            else Decimal("0.00")
        )
        starts_at = datetime.combine(payload.date, starts_time)
        booking = Booking(
            reference=f"NTL-{secrets.token_hex(4).upper()}",
            user_id=user.id,
            salon_id=salon.id,
            service_id=service.id,
            staff_id=staff.id,
            starts_at=starts_at,
            ends_at=starts_at + timedelta(minutes=service.duration_minutes),
            status="confirmed",
            price=price,
            discount=discount,
            offer_code=offer.code if offer else None,
        )
        db.add(booking)
        if offer:
            offer.uses += 1
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    return _load_booking(db, booking.id, user.id)


def _load_booking(db: Session, booking_id: int, user_id: int | None = None) -> schemas.BookingOut:
    query = (
        select(Booking)
        .options(
            joinedload(Booking.salon),
            joinedload(Booking.service).joinedload(Service.category),
            joinedload(Booking.staff),
            joinedload(Booking.user),
        )
        .where(Booking.id == booking_id)
    )
    if user_id is not None:
        query = query.where(Booking.user_id == user_id)
    booking = db.scalar(query)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking_out(booking, booking.user)


@app.get("/bookings", response_model=list[schemas.BookingOut])
def my_bookings(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[schemas.BookingOut]:
    items = db.scalars(
        select(Booking)
        .options(
            joinedload(Booking.salon),
            joinedload(Booking.service).joinedload(Service.category),
            joinedload(Booking.staff),
        )
        .where(Booking.user_id == user.id)
        .order_by(Booking.starts_at.desc())
        .offset(offset)
        .limit(limit)
    ).unique().all()
    return [booking_out(item) for item in items]


@app.get("/bookings/{booking_id}", response_model=schemas.BookingOut)
def booking_detail(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.BookingOut:
    booking = db.get(Booking, booking_id)
    if booking is None or (not has_admin_access(user) and booking.user_id != user.id):
        raise HTTPException(status_code=404, detail="Booking not found.")
    return _load_booking(db, booking_id, None if has_admin_access(user) else user.id)


def _get_owned_booking(db: Session, booking_id: int, user: User) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None or (not has_admin_access(user) and booking.user_id != user.id):
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed bookings can be changed.")
    if booking.starts_at <= local_now():
        raise HTTPException(status_code=409, detail="Past appointments can no longer be changed.")
    return booking


@app.post("/bookings/{booking_id}/cancel", response_model=schemas.BookingOut)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.BookingOut:
    booking = _get_owned_booking(db, booking_id, user)
    booking.status = "cancelled"
    if booking.offer_code:
        offer = db.scalar(select(Offer).where(Offer.code == booking.offer_code))
        if offer:
            offer.uses = max(0, offer.uses - 1)
    db.add(AuditLog(actor_id=user.id, action="cancel", entity="booking", entity_id=str(booking.id)))
    db.commit()
    return _load_booking(db, booking.id, None if has_admin_access(user) else user.id)


@app.put("/bookings/{booking_id}", response_model=schemas.BookingOut)
def reschedule_booking(
    booking_id: int,
    payload: schemas.BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> schemas.BookingOut:
    booking = _get_owned_booking(db, booking_id, user)
    try:
        new_time = time.fromisoformat(payload.start_time)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Choose a valid appointment time.") from exc
    _lock_booking_capacity(db, payload.salon_id)
    salon = db.get(Salon, payload.salon_id)
    service = db.scalar(
        select(Service).options(joinedload(Service.category)).where(Service.id == payload.service_id)
    )
    if salon is None or not salon.is_active or service is None or not service.is_active:
        raise HTTPException(status_code=404, detail="The selected salon or service is unavailable.")
    branch_row = _ensure_service_available_at_branch(db, service, salon.id)
    available = _available_staff(
        db, salon, service, payload.date, new_time, exclude_booking_id=booking.id
    )
    staff = next((person for person in available if person.id == payload.staff_id), None) if payload.staff_id else (available[0] if available else None)
    if staff is None:
        db.rollback()
        raise HTTPException(status_code=409, detail="That time or stylist is no longer available.")
    booking.salon_id = salon.id
    booking.service_id = service.id
    booking.staff_id = staff.id
    booking.starts_at = datetime.combine(payload.date, new_time)
    booking.ends_at = booking.starts_at + timedelta(minutes=service.duration_minutes)
    booking.price = _price_from_branch_row(service, branch_row)
    booking.discount = Decimal("0.00")
    booking.offer_code = None
    db.add(AuditLog(actor_id=user.id, action="reschedule", entity="booking", entity_id=str(booking.id)))
    db.commit()
    return _load_booking(db, booking.id, None if has_admin_access(user) else user.id)


@app.get("/offers", response_model=list[schemas.OfferOut])
def offers(db: Session = Depends(get_db)) -> list[schemas.OfferOut]:
    def load() -> list[schemas.OfferOut]:
        now = utc_now()
        rows = db.scalars(
            select(Offer).where(
                Offer.active.is_(True),
                Offer.starts_at <= now,
                Offer.ends_at >= now,
                Offer.uses < Offer.max_uses,
            )
        ).all()
        return [schemas.OfferOut.model_validate(row) for row in rows]

    return cache.get_or_set(public_key("offers"), PUBLIC_TTL, load)


@app.get("/app/settings")
def public_app_settings(db: Session = Depends(get_db)) -> dict[str, str | bool]:
    def load() -> dict[str, str | bool]:
        settings = _read_app_settings(db, PUBLIC_SETTING_DEFAULTS)
        return {
            "promo_banner_enabled": settings["promo_banner_enabled"] == "true",
            "promo_banner_title": settings["promo_banner_title"],
            "promo_banner_message": settings["promo_banner_message"],
            "promo_banner_cta": settings["promo_banner_cta"],
        }

    return cache.get_or_set(public_key("app-settings"), PUBLIC_TTL, load)


@app.get("/public/content")
def public_content(db: Session = Depends(get_db)) -> dict[str, str]:
    def load() -> dict[str, str]:
        rows = db.scalars(select(PageContent).order_by(PageContent.key)).all()
        return {row.key: row.value for row in rows}

    return cache.get_or_set(public_key("content"), PUBLIC_LONG_TTL, load)


@app.get("/admin/settings")
def admin_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, dict[str, str]]:
    return {"settings": _read_app_settings(db, PUBLIC_SETTING_DEFAULTS)}


@app.patch("/admin/settings")
def update_admin_settings(
    payload: schemas.DeveloperSettingsUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict[str, dict[str, str]]:
    for key, value in payload.settings.items():
        _write_app_setting(db, key, value, admin)
    db.commit()
    invalidate_public_cache()
    return {"settings": _read_app_settings(db, PUBLIC_SETTING_DEFAULTS)}


@app.get("/developer/mode")
def developer_mode(
    db: Session = Depends(get_db),
    _: User = Depends(require_developer),
) -> dict[str, bool]:
    setting = db.get(AppSetting, DEVELOPER_MODE_KEY)
    return {"enabled": setting is not None and setting.value == "true"}


@app.post("/developer/mode")
def update_developer_mode(
    payload: schemas.DeveloperModeUpdate,
    db: Session = Depends(get_db),
    developer: User = Depends(require_developer),
) -> dict[str, bool]:
    _write_app_setting(db, DEVELOPER_MODE_KEY, str(payload.enabled).lower(), developer)
    db.commit()
    return {"enabled": payload.enabled}


@app.get("/developer/settings")
def developer_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_developer),
) -> dict[str, dict[str, str]]:
    mode = db.get(AppSetting, DEVELOPER_MODE_KEY)
    if mode is None or mode.value != "true":
        raise HTTPException(status_code=403, detail="Enable Developer Mode to access application settings.")
    return {"settings": _read_app_settings(db, PUBLIC_SETTING_DEFAULTS)}


@app.patch("/developer/settings")
def update_developer_settings(
    payload: schemas.DeveloperSettingsUpdate,
    db: Session = Depends(get_db),
    developer: User = Depends(require_developer),
) -> dict[str, dict[str, str]]:
    mode = db.get(AppSetting, DEVELOPER_MODE_KEY)
    if mode is None or mode.value != "true":
        raise HTTPException(status_code=403, detail="Enable Developer Mode to edit application settings.")
    for key, value in payload.settings.items():
        _write_app_setting(db, key, value, developer)
    db.commit()
    invalidate_public_cache()
    return {"settings": _read_app_settings(db, PUBLIC_SETTING_DEFAULTS)}


@app.get("/developer/diagnostics")
def developer_diagnostics(
    db: Session = Depends(get_db),
    _: User = Depends(require_developer),
) -> dict:
    """Operational snapshot for developers. Never exposes secrets or password hashes."""
    now = utc_now()
    uptime_seconds = max(0, int((now - APP_STARTED_AT).total_seconds()))
    upload_files = 0
    upload_bytes = 0
    for name in os.listdir(UPLOAD_DIR):
        path = os.path.join(UPLOAD_DIR, name)
        if os.path.isfile(path):
            upload_files += 1
            upload_bytes += os.path.getsize(path)
    counts = {
        "users": int(db.scalar(select(func.count(User.id))) or 0),
        "admins": int(db.scalar(select(func.count(User.id)).where(User.role == "admin")) or 0),
        "developers": int(db.scalar(select(func.count(User.id)).where(User.role == "developer")) or 0),
        "bookings": int(db.scalar(select(func.count(Booking.id))) or 0),
        "salons": int(db.scalar(select(func.count(Salon.id))) or 0),
        "services": int(db.scalar(select(func.count(Service.id))) or 0),
        "campaigns": int(db.scalar(select(func.count(Campaign.id))) or 0),
        "media_files": int(db.scalar(select(func.count(MediaFile.id))) or 0),
        "page_content": int(db.scalar(select(func.count(PageContent.id))) or 0),
        "audit_logs": int(db.scalar(select(func.count(AuditLog.id))) or 0),
    }
    mode = db.get(AppSetting, DEVELOPER_MODE_KEY)
    return {
        "status": "ok",
        "version": app.version,
        "started_at": APP_STARTED_AT.isoformat(),
        "server_time": now.isoformat(),
        "uptime_seconds": uptime_seconds,
        "database_dialect": engine.dialect.name,
        "developer_mode": mode is not None and mode.value == "true",
        "counts": counts,
        "uploads": {"files": upload_files, "bytes": upload_bytes, "directory": UPLOAD_DIR},
        "config": {
            "cors_origins": os.getenv("CORS_ORIGINS", "*"),
            "access_token_minutes": int(os.getenv("ACCESS_TOKEN_MINUTES", "1440")),
            "admin_seed_configured": bool(os.getenv("ADMIN_EMAIL")),
            "developer_seed_configured": bool(os.getenv("DEVELOPER_EMAIL")),
        },
    }


@app.get("/admin/overview")
def admin_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    today = local_now().date()
    today_start = datetime.combine(today, time.min)
    tomorrow_start = today_start + timedelta(days=1)
    now = local_now()
    completed = Booking.status == "completed"
    row = db.execute(
        select(
            func.count(Booking.id),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Booking.starts_at >= today_start)
                            & (Booking.starts_at < tomorrow_start),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Booking.starts_at >= now)
                            & (Booking.status == "confirmed"),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((completed, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Booking.status == "cancelled", 1), else_=0)), 0),
            func.coalesce(func.sum(case((completed, Booking.price - Booking.discount), else_=0)), 0),
        )
    ).one()
    return {
        "total_bookings": int(row[0] or 0),
        "today": int(row[1] or 0),
        "upcoming": int(row[2] or 0),
        "completed": int(row[3] or 0),
        "cancelled": int(row[4] or 0),
        "revenue": Decimal(row[5] or 0),
        "revenue_rule": "Confirmed completed appointments only; demo prices are included.",
    }


@app.get("/admin/bookings", response_model=list[schemas.BookingOut])
def admin_bookings(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    booking_date: date | None = Query(default=None, alias="date"),
    status: str | None = Query(default=None),
    salon_id: int | None = Query(default=None),
    q: str | None = Query(default=None, alias="search"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[schemas.BookingOut]:
    query = select(Booking).options(
        joinedload(Booking.salon),
        joinedload(Booking.service).joinedload(Service.category),
        joinedload(Booking.staff),
        joinedload(Booking.user),
    )
    if booking_date:
        day_start = datetime.combine(booking_date, time.min)
        query = query.where(
            Booking.starts_at >= day_start,
            Booking.starts_at < day_start + timedelta(days=1),
        )
    if status:
        query = query.where(Booking.status == status)
    if salon_id is not None:
        query = query.where(Booking.salon_id == salon_id)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.join(Booking.user).where(
            or_(
                Booking.reference.ilike(pattern),
                User.name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
    items = db.scalars(query.order_by(Booking.starts_at.desc()).offset(offset).limit(limit)).unique().all()
    return [booking_out(item, item.user) for item in items]


@app.post("/admin/services", response_model=schemas.ServiceOut, status_code=status.HTTP_201_CREATED)
def admin_create_service(
    payload: schemas.ServiceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> schemas.ServiceOut:
    category = db.get(Category, payload.category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    service = Service(**payload.model_dump(), is_demo=False)
    db.add(service)
    db.flush()
    db.add(AuditLog(actor_id=admin.id, action="create", entity="service", entity_id=str(service.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(service)
    return service_out(service)


@app.patch("/admin/services/{service_id}", response_model=schemas.ServiceOut)
def admin_update_service(
    service_id: int,
    payload: schemas.ServiceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> schemas.ServiceOut:
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found.")
    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"] is not None:
        category = db.get(Category, update_data["category_id"])
        if category is None:
            raise HTTPException(status_code=404, detail="Category not found.")
    for key, value in update_data.items():
        setattr(service, key, value)
    db.add(AuditLog(actor_id=admin.id, action="update", entity="service", entity_id=str(service.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(service)
    return service_out(service)


@app.post("/admin/bookings/{booking_id}/complete", response_model=schemas.BookingOut)
def admin_complete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> schemas.BookingOut:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed appointments can be completed.")
    booking.status = "completed"
    db.add(AuditLog(actor_id=admin.id, action="complete", entity="booking", entity_id=str(booking.id)))
    db.commit()
    return _load_booking(db, booking.id)


@app.get("/admin/analytics", response_model=schemas.AnalyticsOut)
def admin_analytics(
    range: str = Query(default="month", alias="range"),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> schemas.AnalyticsOut:
    today = local_now().date()
    now = local_now()
    if range == "today":
        window_start = today
        window_end = today
    elif range == "week":
        window_start = today - timedelta(days=6)
        window_end = today
    elif range == "month":
        window_start = today - timedelta(days=29)
        window_end = today
    elif range == "custom":
        if start is None or end is None:
            raise HTTPException(status_code=400, detail="start and end are required for a custom range.")
        if start > end:
            raise HTTPException(status_code=400, detail="The start date must be on or before the end date.")
        if (end - start).days > 366:
            raise HTTPException(status_code=400, detail="Choose a custom range of 366 days or fewer.")
        window_start = start
        window_end = end
    else:
        window_start = today - timedelta(days=29)
        window_end = today

    today_start = datetime.combine(today, time.min)
    tomorrow_start = today_start + timedelta(days=1)
    window_start_dt = datetime.combine(window_start, time.min)
    window_end_dt = datetime.combine(window_end + timedelta(days=1), time.min)
    completed = Booking.status == "completed"

    # One aggregate scan replaces seven separate COUNT queries. The expressions
    # use raw timestamps (not date()) so the starts_at index remains usable.
    totals = db.execute(
        select(
            func.count(Booking.id),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Booking.starts_at >= today_start)
                            & (Booking.starts_at < tomorrow_start),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        ((Booking.starts_at >= now) & (Booking.status == "confirmed"), 1),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        ((Booking.status == "confirmed") & (Booking.starts_at >= today_start), 1),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((completed, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Booking.status == "cancelled", 1), else_=0)), 0),
            func.coalesce(func.sum(case((completed, Booking.price - Booking.discount), else_=0)), 0),
        )
    ).one()
    total = int(totals[0] or 0)
    today_count = int(totals[1] or 0)
    upcoming = int(totals[2] or 0)
    pending = int(totals[3] or 0)
    completed_count = int(totals[4] or 0)
    cancelled = int(totals[5] or 0)
    revenue = totals[6] or 0

    in_window = (
        Booking.starts_at >= window_start_dt,
        Booking.starts_at < window_end_dt,
    )

    range_row = db.execute(
        select(
            func.count(Booking.id),
            func.coalesce(
                func.sum(
                    case(
                        ((Booking.status == "confirmed") & (Booking.starts_at >= now), 1),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((completed, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Booking.status == "cancelled", 1), else_=0)), 0),
            func.coalesce(func.sum(case((completed, Booking.price - Booking.discount), else_=0)), 0),
        ).where(*in_window)
    ).one()
    range_total = int(range_row[0] or 0)
    range_pending = int(range_row[1] or 0)
    range_completed = int(range_row[2] or 0)
    range_cancelled = int(range_row[3] or 0)
    range_revenue = range_row[4] or 0

    trend_rows = db.execute(
        select(func.date(Booking.starts_at).label("day"), func.count(Booking.id).label("count"))
        .where(*in_window)
        .group_by(func.date(Booking.starts_at))
        .order_by(func.date(Booking.starts_at))
    ).all()
    revenue_rows = db.execute(
        select(
            func.date(Booking.starts_at).label("day"),
            func.coalesce(func.sum(Booking.price - Booking.discount), 0).label("revenue"),
        )
        .where(*in_window, Booking.status == "completed")
        .group_by(func.date(Booking.starts_at))
    ).all()
    trend_map = {str(row[0]): int(row[1]) for row in trend_rows}
    revenue_map = {str(row[0]): Decimal(row[1]) for row in revenue_rows}
    trend: list[schemas.AnalyticsPoint] = []
    cursor = window_start
    while cursor <= window_end:
        key = cursor.isoformat()
        trend.append(
            schemas.AnalyticsPoint(
                date=key,
                bookings=trend_map.get(key, 0),
                revenue=revenue_map.get(key, Decimal("0")),
            )
        )
        cursor += timedelta(days=1)

    status_rows = db.execute(
        select(Booking.status, func.count(Booking.id)).where(*in_window).group_by(Booking.status)
    ).all()
    status_breakdown = [{"status": row[0], "count": int(row[1])} for row in status_rows]

    branch_rows = db.execute(
        select(Salon.name, func.count(Booking.id))
        .join(Booking, Booking.salon_id == Salon.id)
        .where(*in_window)
        .group_by(Salon.id, Salon.name)
        .order_by(func.count(Booking.id).desc())
    ).all()
    branch_breakdown = [{"branch": row[0], "bookings": int(row[1])} for row in branch_rows]

    return schemas.AnalyticsOut(
        total_bookings=total,
        today=today_count,
        upcoming=upcoming,
        pending=pending,
        completed=completed_count,
        cancelled=cancelled,
        revenue=Decimal(revenue),
        range_total=range_total,
        range_pending=range_pending,
        range_completed=range_completed,
        range_cancelled=range_cancelled,
        range_revenue=Decimal(range_revenue),
        range_start=window_start,
        range_end=window_end,
        trend=trend,
        status_breakdown=status_breakdown,
        branch_breakdown=branch_breakdown,
    )


@app.put("/admin/bookings/{booking_id}", response_model=schemas.BookingOut)
def admin_update_booking(
    booking_id: int,
    payload: schemas.BookingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> schemas.BookingOut:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    data = payload.model_dump(exclude_unset=True, by_alias=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    if "status" in data:
        new_status = data.pop("status")
        if new_status not in {"confirmed", "completed", "cancelled"}:
            raise HTTPException(status_code=400, detail="Invalid booking status.")
        booking.status = new_status
        db.add(AuditLog(actor_id=admin.id, action=f"status_{new_status}", entity="booking", entity_id=str(booking.id)))

    reschedule_keys = {"salon_id", "service_id", "date", "start_time", "staff_id"}
    if any(key in data for key in reschedule_keys):
        target_salon_id = data.get("salon_id", booking.salon_id)
        target_service_id = data.get("service_id", booking.service_id)
        target_date = data.get("date", booking.starts_at.date())
        target_time = data.get("start_time", booking.starts_at.strftime("%H:%M"))
        target_staff_id = data.get("staff_id", booking.staff_id)
        try:
            new_time = time.fromisoformat(target_time)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Choose a valid appointment time.") from exc
        _lock_booking_capacity(db, target_salon_id)
        salon = db.get(Salon, target_salon_id)
        service = db.get(Service, target_service_id)
        if salon is None or not salon.is_active or service is None or not service.is_active:
            raise HTTPException(status_code=404, detail="The selected salon or service is unavailable.")
        branch_row = _ensure_service_available_at_branch(db, service, salon.id)
        available = _available_staff(db, salon, service, target_date, new_time, exclude_booking_id=booking.id)
        staff = (
            next((person for person in available if person.id == target_staff_id), None)
            if target_staff_id
            else (available[0] if available else None)
        )
        if staff is None:
            raise HTTPException(status_code=409, detail="That time or stylist is no longer available.")
        booking.salon_id = salon.id
        booking.service_id = service.id
        booking.staff_id = staff.id
        booking.starts_at = datetime.combine(target_date, new_time)
        booking.ends_at = booking.starts_at + timedelta(minutes=service.duration_minutes)
        booking.price = _price_from_branch_row(service, branch_row)
        booking.discount = Decimal("0.00")
        booking.offer_code = None
        db.add(AuditLog(actor_id=admin.id, action="reschedule", entity="booking", entity_id=str(booking.id)))
        for key in reschedule_keys:
            data.pop(key, None)

    for key, value in data.items():
        setattr(booking, key, value)
    db.commit()
    return _load_booking(db, booking.id)


@app.delete("/admin/bookings/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    db.add(AuditLog(actor_id=admin.id, action="delete", entity="booking", entity_id=str(booking.id)))
    db.delete(booking)
    db.commit()
    return None


@app.get("/admin/salons", response_model=list[schemas.SalonOut])
def admin_list_salons(
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[Salon]:
    return list(
        db.scalars(
            select(Salon).order_by(Salon.city, Salon.name).offset(offset).limit(limit)
        ).all()
    )


@app.post("/admin/salons", response_model=schemas.SalonOut, status_code=status.HTTP_201_CREATED)
def admin_create_salon(
    payload: schemas.SalonCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Salon:
    salon = Salon(**payload.model_dump())
    db.add(salon)
    db.flush()
    db.add(AuditLog(actor_id=admin.id, action="create", entity="salon", entity_id=str(salon.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(salon)
    return salon


@app.patch("/admin/salons/{salon_id}", response_model=schemas.SalonOut)
def admin_update_salon(
    salon_id: int,
    payload: schemas.SalonUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Salon:
    salon = db.get(Salon, salon_id)
    if salon is None:
        raise HTTPException(status_code=404, detail="Salon not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(salon, key, value)
    db.add(AuditLog(actor_id=admin.id, action="update", entity="salon", entity_id=str(salon.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(salon)
    return salon


@app.delete("/admin/salons/{salon_id}")
def admin_deactivate_salon(
    salon_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    salon = db.get(Salon, salon_id)
    if salon is None:
        raise HTTPException(status_code=404, detail="Salon not found.")
    salon.is_active = False
    db.add(AuditLog(actor_id=admin.id, action="deactivate", entity="salon", entity_id=str(salon.id)))
    db.commit()
    invalidate_public_cache()
    return {"detail": "Branch deactivated.", "salon": schemas.SalonOut.model_validate(salon)}


@app.get("/admin/services", response_model=list[schemas.ServiceOut])
def admin_list_services(
    q: str | None = None,
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[schemas.ServiceOut]:
    query = select(Service).options(joinedload(Service.category))
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Service.name.ilike(pattern), Service.description.ilike(pattern)))
    items = db.scalars(
        query.order_by(Service.category_id, Service.name).offset(offset).limit(limit)
    ).unique().all()
    return [service_out(item) for item in items]


@app.delete("/admin/services/{service_id}")
def admin_deactivate_service(
    service_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found.")
    service.is_active = False
    db.add(AuditLog(actor_id=admin.id, action="deactivate", entity="service", entity_id=str(service.id)))
    db.commit()
    invalidate_public_cache()
    return {"detail": "Service deactivated.", "service": service_out(service)}


@app.get("/admin/services/{service_id}/branch-prices", response_model=list[schemas.ServiceBranchPriceOut])
def list_branch_prices(
    service_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found.")
    return list(
        db.scalars(
            select(ServiceBranchPrice).where(ServiceBranchPrice.service_id == service_id).order_by(ServiceBranchPrice.salon_id)
        ).all()
    )


@app.post("/admin/services/{service_id}/branch-prices", response_model=schemas.ServiceBranchPriceOut, status_code=status.HTTP_201_CREATED)
def create_branch_price(
    service_id: int,
    payload: schemas.ServiceBranchPriceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found.")
    salon = db.get(Salon, payload.salon_id)
    if salon is None:
        raise HTTPException(status_code=404, detail="Salon not found.")
    existing = db.scalar(
        select(ServiceBranchPrice).where(
            ServiceBranchPrice.service_id == service_id,
            ServiceBranchPrice.salon_id == payload.salon_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="A branch price already exists for this service and salon. Use PATCH to update it.")
    row = ServiceBranchPrice(
        service_id=service_id,
        salon_id=payload.salon_id,
        price=payload.price,
        is_available=payload.is_available,
    )
    db.add(row)
    db.add(AuditLog(actor_id=admin.id, action="create", entity="service_branch_price", entity_id=str(row.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(row)
    return row


@app.patch("/admin/services/{service_id}/branch-prices/{salon_id}", response_model=schemas.ServiceBranchPriceOut)
def update_branch_price(
    service_id: int,
    salon_id: int,
    payload: schemas.ServiceBranchPriceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    row = db.scalar(
        select(ServiceBranchPrice).where(
            ServiceBranchPrice.service_id == service_id,
            ServiceBranchPrice.salon_id == salon_id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Branch price not found.")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update.")
    if data.get("price") is not None:
        row.price = data["price"]
    if data.get("is_available") is not None:
        row.is_available = data["is_available"]
    db.add(AuditLog(actor_id=admin.id, action="update", entity="service_branch_price", entity_id=f"{service_id}:{salon_id}"))
    db.commit()
    invalidate_public_cache()
    db.refresh(row)
    return row


@app.delete("/admin/services/{service_id}/branch-prices/{salon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch_price(
    service_id: int,
    salon_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    row = db.scalar(
        select(ServiceBranchPrice).where(
            ServiceBranchPrice.service_id == service_id,
            ServiceBranchPrice.salon_id == salon_id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Branch price not found.")
    db.add(AuditLog(actor_id=admin.id, action="delete", entity="service_branch_price", entity_id=f"{service_id}:{salon_id}"))
    db.delete(row)
    db.commit()
    invalidate_public_cache()
    return None


@app.get("/admin/salons/{salon_id}/services", response_model=list[schemas.AdminBranchServiceOut])
def admin_branch_services(
    salon_id: int,
    q: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[schemas.AdminBranchServiceOut]:
    salon = db.get(Salon, salon_id)
    if salon is None:
        raise HTTPException(status_code=404, detail="Salon not found.")
    query = select(Service).options(joinedload(Service.category))
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Service.name.ilike(pattern), Service.description.ilike(pattern)))
    services = db.scalars(query.order_by(Service.category_id, Service.name)).unique().all()
    rows = {
        row.service_id: row
        for row in db.scalars(
            select(ServiceBranchPrice).where(
                ServiceBranchPrice.salon_id == salon_id,
                ServiceBranchPrice.service_id.in_([item.id for item in services] or [-1]),
            )
        ).all()
    }
    result: list[schemas.AdminBranchServiceOut] = []
    for service in services:
        row = rows.get(service.id)
        result.append(
            schemas.AdminBranchServiceOut(
                service_id=service.id,
                name=service.name,
                category=service.category.name,
                duration_minutes=service.duration_minutes,
                base_price=Decimal(service.price),
                branch_price=Decimal(row.price) if row is not None else None,
                is_available=row.is_available if row is not None else True,
                has_override=row is not None,
                is_active=service.is_active,
            )
        )
    return result


@app.put(
    "/admin/salons/{salon_id}/services/{service_id}",
    response_model=schemas.AdminBranchServiceOut,
)
def admin_update_branch_service(
    salon_id: int,
    service_id: int,
    payload: schemas.AdminBranchServiceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> schemas.AdminBranchServiceOut:
    salon = db.get(Salon, salon_id)
    service = db.scalar(
        select(Service).options(joinedload(Service.category)).where(Service.id == service_id)
    )
    if salon is None:
        raise HTTPException(status_code=404, detail="Salon not found.")
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found.")
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update.")
    row = _branch_price_row(db, service_id, salon_id)
    if row is None:
        row = ServiceBranchPrice(
            service_id=service_id,
            salon_id=salon_id,
            price=data.get("price") if data.get("price") is not None else service.price,
            is_available=True if data.get("is_available") is None else data["is_available"],
        )
        db.add(row)
    else:
        if data.get("price") is not None:
            row.price = data["price"]
        if data.get("is_available") is not None:
            row.is_available = data["is_available"]
    db.flush()
    _audit(db, admin, "update", "service_branch_price", f"{service_id}:{salon_id}")
    db.commit()
    invalidate_public_cache()
    db.refresh(row)
    return schemas.AdminBranchServiceOut(
        service_id=service.id,
        name=service.name,
        category=service.category.name,
        duration_minutes=service.duration_minutes,
        base_price=Decimal(service.price),
        branch_price=Decimal(row.price),
        is_available=row.is_available,
        has_override=True,
        is_active=service.is_active,
    )


@app.post("/admin/media/upload", response_model=schemas.MediaUploadResponse)
def admin_upload_media(
    file: UploadFile = File(...),
    category: str = Form(default="general"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    original_name = file.filename or "upload"
    contents = file.file.read()
    ext = _validate_image_upload(file, contents)
    filename = f"{secrets.token_hex(8)}{ext}"
    disk_path = os.path.join(UPLOAD_DIR, filename)
    with open(disk_path, "wb") as buffer:
        buffer.write(contents)
    url = f"/media/uploads/{filename}"
    media = MediaFile(
        filename=filename,
        original_name=original_name,
        mime_type=file.content_type or "application/octet-stream",
        size=len(contents),
        url=url,
        category=category,
        uploaded_by=admin.id,
    )
    db.add(media)
    db.flush()
    db.add(AuditLog(actor_id=admin.id, action="upload", entity="media", entity_id=str(media.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(media)
    return schemas.MediaUploadResponse(media=media)


@app.post("/admin/media/{media_id}/replace", response_model=schemas.MediaUploadResponse)
def admin_replace_media(
    media_id: int,
    file: UploadFile = File(...),
    category: str | None = Form(default=None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    media = db.get(MediaFile, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media file not found.")
    original_name = file.filename or "upload"
    contents = file.file.read()
    ext = _validate_image_upload(file, contents)
    filename = f"{secrets.token_hex(8)}{ext}"
    disk_path = os.path.join(UPLOAD_DIR, filename)
    with open(disk_path, "wb") as buffer:
        buffer.write(contents)
    old_url = media.url
    new_url = f"/media/uploads/{filename}"
    _repoint_media_references(db, old_url, new_url)
    media.filename = filename
    media.original_name = original_name
    media.mime_type = file.content_type or "application/octet-stream"
    media.size = len(contents)
    media.url = new_url
    if category:
        media.category = category
    _audit(db, admin, "replace", "media", media.id, detail=f"{old_url} -> {new_url}")
    db.commit()
    invalidate_public_cache()
    db.refresh(media)
    try:
        os.remove(os.path.join(UPLOAD_DIR, os.path.basename(old_url)))
    except FileNotFoundError:
        pass
    return schemas.MediaUploadResponse(media=media)


@app.get("/admin/media", response_model=list[schemas.MediaFileOut])
def admin_list_media(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return list(
        db.scalars(
            select(MediaFile)
            .order_by(MediaFile.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


@app.delete("/admin/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_media(
    media_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    media = db.get(MediaFile, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media file not found.")
    _media_reference_urls(db, media)
    try:
        os.remove(os.path.join(UPLOAD_DIR, media.filename))
    except FileNotFoundError:
        pass
    db.add(AuditLog(actor_id=admin.id, action="delete", entity="media", entity_id=str(media.id)))
    db.delete(media)
    db.commit()
    invalidate_public_cache()
    return None


@app.get("/admin/campaigns", response_model=list[schemas.CampaignOut])
def admin_list_campaigns(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return list(
        db.scalars(
            select(Campaign)
            .order_by(Campaign.position.asc(), Campaign.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


@app.post("/admin/campaigns", response_model=schemas.CampaignOut, status_code=status.HTTP_201_CREATED)
def admin_create_campaign(
    payload: schemas.CampaignCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    campaign = Campaign(**payload.model_dump(), created_by=admin.id)
    db.add(campaign)
    db.flush()
    db.add(AuditLog(actor_id=admin.id, action="create", entity="campaign", entity_id=str(campaign.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(campaign)
    return campaign


@app.patch("/admin/campaigns/{campaign_id}", response_model=schemas.CampaignOut)
def admin_update_campaign(
    campaign_id: int,
    payload: schemas.CampaignUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    db.add(AuditLog(actor_id=admin.id, action="update", entity="campaign", entity_id=str(campaign.id)))
    db.commit()
    invalidate_public_cache()
    db.refresh(campaign)
    return campaign


@app.delete("/admin/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    db.add(AuditLog(actor_id=admin.id, action="delete", entity="campaign", entity_id=str(campaign.id)))
    db.delete(campaign)
    db.commit()
    invalidate_public_cache()
    return None


@app.get("/public/campaigns", response_model=list[schemas.CampaignOut])
def public_campaigns(
    audience: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    def load() -> list[schemas.CampaignOut]:
        today = local_now().date()
        query = select(Campaign).where(
            Campaign.is_active.is_(True),
            or_(Campaign.start_date.is_(None), Campaign.start_date <= today),
            or_(Campaign.end_date.is_(None), Campaign.end_date >= today),
        )
        if audience:
            query = query.where(or_(Campaign.audience == "Everyone", Campaign.audience == audience))
        rows = db.scalars(
            query.order_by(Campaign.position.asc(), Campaign.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return [schemas.CampaignOut.model_validate(row) for row in rows]

    key = public_key("campaigns", audience or "", limit, offset)
    return cache.get_or_set(key, PUBLIC_TTL, load)


@app.get("/admin/content", response_model=list[schemas.PageContentOut])
def admin_list_content(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return list(
        db.scalars(
            select(PageContent)
            .order_by(PageContent.key)
            .offset(offset)
            .limit(limit)
        ).all()
    )


@app.patch("/admin/content/{key}", response_model=schemas.PageContentOut)
def admin_update_content(
    key: str,
    payload: schemas.PageContentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    content = db.scalar(select(PageContent).where(PageContent.key == key))
    if content is None:
        content = PageContent(key=key, value=payload.value, content_type=payload.content_type or "text", updated_by=admin.id)
        db.add(content)
    else:
        content.value = payload.value
        if payload.content_type is not None:
            content.content_type = payload.content_type
        content.updated_by = admin.id
    db.add(AuditLog(actor_id=admin.id, action="update", entity="page_content", entity_id=key))
    db.commit()
    invalidate_public_cache()
    db.refresh(content)
    return content


@app.get("/admin/audit-logs", response_model=list[schemas.AuditLogOut])
def admin_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return list(
        db.scalars(
            select(AuditLog)
            .options(joinedload(AuditLog.actor))
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )


@app.get("/admin/users", response_model=list[schemas.UserListItem])
def admin_list_users(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return list(
        db.scalars(
            select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)
        ).all()
    )


@app.patch("/admin/users/{user_id}/role", response_model=schemas.UserOut)
def admin_update_user_role(
    user_id: int,
    payload: schemas.UserRoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    new_role = payload.role
    if new_role not in {"customer", "admin", "developer"}:
        raise HTTPException(status_code=400, detail="Invalid role.")
    if user.role == "developer" and admin.role != "developer":
        raise HTTPException(status_code=403, detail="Only a developer can modify a developer account.")
    if new_role == "developer" and admin.role != "developer":
        raise HTTPException(status_code=403, detail="Only a developer can assign the developer role.")
    if user.id == admin.id and new_role != admin.role:
        raise HTTPException(status_code=400, detail="You cannot change your own role.")
    user.role = new_role
    db.add(AuditLog(actor_id=admin.id, action="role_change", entity="user", entity_id=str(user.id)))
    db.commit()
    db.refresh(user)
    return user
