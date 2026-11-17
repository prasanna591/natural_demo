from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.gettempdir(), f'naturals-api-tests-{os.getpid()}.db')}"
os.environ["JWT_SECRET"] = "test-only-signing-secret"
os.environ["ADMIN_EMAIL"] = "admin@tests.example.com"
os.environ["ADMIN_PASSWORD"] = "Secure-test-admin-password-2026"

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.database import SessionLocal, engine
from app.models import User


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()
    try:
        os.remove(os.environ["DATABASE_URL"].removeprefix("sqlite:///"))
    except FileNotFoundError:
        pass


def register(client: TestClient, suffix: str) -> tuple[str, int]:
    response = client.post(
        "/auth/register",
        json={
            "name": f"Test Customer {suffix}",
            "email": f"customer-{suffix}@example.com",
            "password": "Secure-test-password-2026",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return data["access_token"], data["user"]["id"]


def demo_ids(client: TestClient) -> tuple[int, int]:
    return client.get("/salons").json()[0]["id"], client.get("/services").json()[0]["id"]


def booking_payload(client: TestClient, start_time: str = "10:00", day_offset: int = 2) -> dict:
    salon_id, service_id = demo_ids(client)
    eligible_staff = client.get(
        f"/salons/{salon_id}/staff?service_id={service_id}"
    ).json()
    return {
        "salon_id": salon_id,
        "service_id": service_id,
        "staff_id": eligible_staff[0]["id"],
        "date": (date.today() + timedelta(days=day_offset)).isoformat(),
        "start_time": start_time,
    }


def test_public_catalog_and_demo_labels(client: TestClient):
    services = client.get("/services").json()
    salons = client.get("/salons").json()
    assert services
    assert any(item["is_demo"] for item in services)
    assert any(not item["is_demo"] for item in services)
    assert salons
    verified = [item for item in salons if not item["is_demo"]]
    assert len([item for item in verified if item["city"] == "Chennai"]) == 39
    assert len([item for item in verified if item["city"] == "Madurai"]) == 6
    assert len([item for item in verified if item["city"] == "Salem"]) == 5
    assert len([item for item in verified if item["city"] == "Kumbakonam"]) == 1
    assert all(item["city"] in item["address"] for item in verified)
    assert all("Naturals - Seelanaickenpatty" != item["name"] for item in salons)
    assert any(item["is_demo"] for item in salons)

    admin_salons = client.get("/admin/salons", headers=admin_headers(client)).json()
    temporarily_closed = next(item for item in admin_salons if item["name"] == "Naturals - Seelanaickenpatty")
    assert temporarily_closed["is_active"] is False
    assert client.get("/health").json() == {"status": "ok"}


def test_published_services_member_prices_and_bharathi_salai_overrides(client: TestClient):
    services = client.get("/services").json()
    by_key = {(item["audience"], item["name"]): item for item in services}

    assert float(by_key[("Men", "Men's haircut")]["price"]) == 300
    assert by_key[("Men", "Men's haircut")]["description"].startswith("Starting price: ₹300.")
    assert float(by_key[("Men", "Shave")]["price"]) == 120
    assert "Member price: ₹100." in by_key[("Men", "Shave")]["description"]
    assert float(by_key[("Women", "Classic haircut")]["price"]) == 450
    assert "Member price: ₹400." in by_key[("Women", "Classic haircut")]["description"]
    assert float(by_key[("Women", "Moisturising hair spa")]["price"]) == 800
    assert "Price range: ₹800–₹900." in by_key[("Women", "Moisturising hair spa")]["description"]
    assert "Member price: ₹700–₹800." in by_key[("Women", "Moisturising hair spa")]["description"]
    assert by_key[("Men", "Men's haircut")]["is_demo"] is False

    bharathi = next(item for item in client.get("/salons").json() if item["name"] == "Naturals - Bharathi Salai")
    branch_catalogue = client.get(f"/services?salon_id={bharathi['id']}").json()
    for name, expected in [
        ("Facial", 900),
        ("Layer cut", 1100),
        ("Hair colouring", 1000),
        ("Waxing", 650),
        ("Hair wash and blow dry", 1000),
        ("Skin brightening", 3000),
        ("Bridal makeup package", 7999),
        ("Pedicure", 700),
        ("Membership card", 100),
    ]:
        matches = [item for item in branch_catalogue if item["name"] == name]
        assert matches, name
        assert all(float(item["price"]) == expected for item in matches), name

    # The override is branch-specific: another branch keeps the base Waxing price.
    madurai = next(item for item in client.get("/salons").json() if item["city"] == "Madurai")
    other_catalogue = client.get(f"/services?salon_id={madurai['id']}").json()
    waxing = next(item for item in other_catalogue if item["name"] == "Waxing")
    assert float(waxing["price"]) == 350
    branch_waxing = next(item for item in branch_catalogue if item["name"] == "Waxing")
    assert "Branch starting price: ₹650." in branch_waxing["description"]

    # New services are linked to sample teams so availability and booking work.
    men_haircut = by_key[("Men", "Men's haircut")]
    staff = client.get(
        f"/salons/{bharathi['id']}/staff?service_id={men_haircut['id']}"
    ).json()
    assert staff


def test_registration_booking_and_ownership(client: TestClient):
    token, _ = register(client, "booking")
    response = client.post("/bookings", json=booking_payload(client), headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201, response.text
    booking = response.json()
    assert booking["status"] == "confirmed"
    assert booking["reference"].startswith("NTL-")
    assert client.get("/bookings", headers={"Authorization": f"Bearer {token}"}).json()[0]["id"] == booking["id"]

    other_token, _ = register(client, "other")
    assert client.get(f"/bookings/{booking['id']}", headers={"Authorization": f"Bearer {other_token}"}).status_code == 404


def test_conflicting_capacity_and_cancel_release(client: TestClient):
    salon_id, service_id = demo_ids(client)
    payload = booking_payload(client, "11:00")
    payload["salon_id"] = salon_id
    payload["service_id"] = service_id
    token, _ = register(client, "conflict-a")
    other_token, _ = register(client, "conflict-b")
    first = client.post("/bookings", json=payload, headers={"Authorization": f"Bearer {token}"})
    second = client.post("/bookings", json=payload, headers={"Authorization": f"Bearer {other_token}"})
    assert first.status_code == 201
    assert second.status_code == 409
    cancelled = client.post(
        f"/bookings/{first.json()['id']}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert client.post("/bookings", json=payload, headers={"Authorization": f"Bearer {other_token}"}).status_code == 201


def test_overlapping_duration_and_unavailable_times_are_rejected(client: TestClient):
    token, _ = register(client, "overlap")
    first = booking_payload(client, "10:00", day_offset=5)
    second = booking_payload(client, "10:30", day_offset=5)
    assert client.post("/bookings", json=first, headers={"Authorization": f"Bearer {token}"}).status_code == 201
    overlap = client.post("/bookings", json=second, headers={"Authorization": f"Bearer {token}"})
    assert overlap.status_code == 409

    past = booking_payload(client, "10:00", day_offset=-1)
    assert client.post("/bookings", json=past, headers={"Authorization": f"Bearer {token}"}).status_code == 409
    outside_hours = booking_payload(client, "20:30", day_offset=5)
    assert client.post("/bookings", json=outside_hours, headers={"Authorization": f"Bearer {token}"}).status_code == 409


def test_reschedule_revalidates_and_releases_old_time(client: TestClient):
    token, _ = register(client, "reschedule-a")
    other_token, _ = register(client, "reschedule-b")
    initial = booking_payload(client, "11:00", day_offset=6)
    created = client.post("/bookings", json=initial, headers={"Authorization": f"Bearer {token}"})
    assert created.status_code == 201, created.text

    new_time = booking_payload(client, "12:00", day_offset=6)
    moved = client.put(
        f"/bookings/{created.json()['id']}",
        json=new_time,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["start_time"] == "12:00"

    old_slot = client.post("/bookings", json=initial, headers={"Authorization": f"Bearer {other_token}"})
    occupied_new_slot = client.post("/bookings", json=new_time, headers={"Authorization": f"Bearer {other_token}"})
    assert old_slot.status_code == 201
    assert occupied_new_slot.status_code == 409


def test_concurrent_requests_reserve_only_one_slot(client: TestClient):
    payload = booking_payload(client, "13:00")
    tokens = [register(client, "race-a")[0], register(client, "race-b")[0]]

    def create(token: str):
        return client.post("/bookings", json=payload, headers={"Authorization": f"Bearer {token}"})

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(create, tokens))
    assert sorted(response.status_code for response in responses) == [201, 409]


def test_admin_permissions_dashboard_and_service_management(client: TestClient):
    assert client.get("/admin/overview").status_code == 401
    customer_token, _ = register(client, "permissions")
    assert client.get("/admin/overview", headers={"Authorization": f"Bearer {customer_token}"}).status_code == 403

    login = client.post(
        "/auth/admin-login",
        json={"identifier": "admin@tests.example.com", "password": "Secure-test-admin-password-2026"},
    )
    assert login.status_code == 200
    admin_token = login.json()["access_token"]
    assert client.post(
        "/auth/login",
        json={"email": "admin@tests.example.com", "password": "Secure-test-admin-password-2026"},
    ).status_code == 403
    assert client.get(
        "/developer/mode",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).status_code == 403
    stats = client.get("/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
    assert stats.status_code == 200
    category_id = client.get("/categories").json()[0]["id"]
    created = client.post(
        "/admin/services",
        json={
            "category_id": category_id,
            "name": "Admin-created test service",
            "description": "Test record",
            "duration_minutes": 30,
            "price": "250.00",
            "audience": "Everyone",
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert created.status_code == 201
    assert created.json()["is_demo"] is False
    assert any(item["name"] == "Admin-created test service" for item in client.get("/services").json())


def test_developer_mode_settings_and_public_banner(client: TestClient):
    registration = client.post(
        "/auth/register",
        json={
            "name": "Authorized Developer",
            "email": "developer-settings@example.com",
            "password": "Secure-test-password-2026",
        },
    )
    assert registration.status_code == 201
    customer_token = registration.json()["access_token"]
    customer_login = client.post(
        "/auth/login",
        json={"email": "developer-settings@example.com", "password": "Secure-test-password-2026"},
    )
    assert customer_login.status_code == 200
    assert client.post(
        "/auth/admin-login",
        json={"identifier": "developer-settings@example.com", "password": "Secure-test-password-2026"},
    ).status_code == 401
    assert client.get(
        "/developer/mode",
        headers={"Authorization": f"Bearer {customer_token}"},
    ).status_code == 403
    assert client.post(
        "/developer/mode",
        json={"enabled": True},
        headers={"Authorization": f"Bearer {customer_token}"},
    ).status_code == 403

    with SessionLocal() as db:
        developer = db.query(User).filter_by(email="developer-settings@example.com").one()
        developer.role = "developer"
        db.commit()

    login = client.post(
        "/auth/admin-login",
        json={"identifier": "Authorized Developer", "password": "Secure-test-password-2026"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert client.get(
        "/admin/overview",
        headers={"Authorization": f"Bearer {token}"},
    ).status_code == 200
    assert client.get(
        "/developer/settings",
        headers={"Authorization": f"Bearer {token}"},
    ).status_code == 403
    assert client.post(
        "/developer/mode",
        json={"enabled": True},
        headers={"Authorization": f"Bearer {token}"},
    ).json() == {"enabled": True}

    updated = client.patch(
        "/developer/settings",
        json={
            "settings": {
                "promo_banner_enabled": "true",
                "promo_banner_title": "Test promotion",
                "promo_banner_message": "A saved customer-facing message.",
                "promo_banner_cta": "View offers",
            }
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert updated.status_code == 200, updated.text
    assert client.get("/app/settings").json() == {
        "promo_banner_enabled": True,
        "promo_banner_title": "Test promotion",
        "promo_banner_message": "A saved customer-facing message.",
        "promo_banner_cta": "View offers",
    }

    disabled = client.post(
        "/developer/mode",
        json={"enabled": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert disabled.status_code == 200
    assert client.get(
        "/developer/settings",
        headers={"Authorization": f"Bearer {token}"},
    ).status_code == 403
    invalid = client.patch(
        "/developer/settings",
        json={"settings": {"unknown_setting": "value"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert invalid.status_code == 422


def test_offer_is_validated_by_backend(client: TestClient):
    token, _ = register(client, "offer")
    payload = booking_payload(client, "15:00")
    payload["offer_code"] = "WELCOME10"
    response = client.post("/bookings", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201, response.text
    assert response.json()["offer_code"] == "WELCOME10"
    assert float(response.json()["discount"]) > 0

    invalid_payload = booking_payload(client, "16:00")
    invalid_payload["offer_code"] = "NOT-A-REAL-OFFER"
    rejected = client.post("/bookings", json=invalid_payload, headers={"Authorization": f"Bearer {token}"})
    assert rejected.status_code == 400


def admin_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/auth/admin-login",
        json={"identifier": "admin@tests.example.com", "password": "Secure-test-admin-password-2026"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"naturals-test-image"


def test_branch_pricing_and_availability_drive_customer_catalogue(client: TestClient):
    headers = admin_headers(client)
    salon_id, service_id = demo_ids(client)
    override_price = "1234.50"

    saved = client.put(
        f"/admin/salons/{salon_id}/services/{service_id}",
        json={"price": override_price, "is_available": True},
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    assert float(saved.json()["branch_price"]) == float(override_price)

    catalogue = client.get(f"/services?salon_id={salon_id}").json()
    branch_service = next(item for item in catalogue if item["id"] == service_id)
    assert float(branch_service["price"]) == float(override_price)
    # A different branch keeps its own price rather than inheriting the override.
    other_salon_id = next(salon["id"] for salon in client.get("/salons").json() if salon["id"] != salon_id)
    other_catalogue = client.get(f"/services?salon_id={other_salon_id}").json()
    other_service = next(item for item in other_catalogue if item["id"] == service_id)
    assert float(other_service["price"]) != float(override_price)

    hidden = client.put(
        f"/admin/salons/{salon_id}/services/{service_id}",
        json={"is_available": False},
        headers=headers,
    )
    assert hidden.status_code == 200, hidden.text
    assert hidden.json()["is_available"] is False
    assert all(item["id"] != service_id for item in client.get(f"/services?salon_id={salon_id}").json())

    token, _ = register(client, "branch-unavailable")
    unavailable_payload = booking_payload(client, "10:00", day_offset=8)
    unavailable_payload["salon_id"] = salon_id
    unavailable_payload["service_id"] = service_id
    blocked = client.post(
        "/bookings", json=unavailable_payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert blocked.status_code == 409
    assert "not available" in blocked.json()["detail"].lower()

    availability = client.get(
        f"/availability?salon_id={salon_id}&service_id={service_id}&date="
        f"{(date.today() + timedelta(days=8)).isoformat()}"
    )
    assert availability.status_code == 409

    restored = client.delete(
        f"/admin/services/{service_id}/branch-prices/{salon_id}", headers=headers
    )
    assert restored.status_code == 204
    assert any(item["id"] == service_id for item in client.get(f"/services?salon_id={salon_id}").json())


def test_cms_content_and_audience_filtered_campaigns(client: TestClient):
    headers = admin_headers(client)
    public_content = client.get("/public/content").json()
    assert public_content["home.hero.title.women"]
    assert "home.cta.title.women" in public_content

    updated = client.patch(
        "/admin/content/home.hero.title.women",
        json={"value": "Test CMS headline", "content_type": "text"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert client.get("/public/content").json()["home.hero.title.women"] == "Test CMS headline"

    today = date.today()
    created = client.post(
        "/admin/campaigns",
        json={
            "title": "Women's test campaign",
            "subtitle": "Automated coverage",
            "description": "Campaign used to verify audience and date filtering.",
            "cta_label": "Explore",
            "audience": "Women",
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": (today + timedelta(days=5)).isoformat(),
            "is_active": True,
            "position": 1,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    campaign = created.json()
    assert campaign["audience"] == "Women"

    women = client.get("/public/campaigns?audience=Women").json()
    men = client.get("/public/campaigns?audience=Men").json()
    everyone = client.get("/public/campaigns").json()
    assert any(item["id"] == campaign["id"] for item in women)
    assert all(item["id"] != campaign["id"] for item in men)
    assert any(item["id"] == campaign["id"] for item in everyone)

    expired = client.post(
        "/admin/campaigns",
        json={
            "title": "Expired test campaign",
            "description": "Should never reach the customer app.",
            "audience": "Everyone",
            "start_date": (today - timedelta(days=10)).isoformat(),
            "end_date": (today - timedelta(days=2)).isoformat(),
            "is_active": True,
        },
        headers=headers,
    )
    assert expired.status_code == 201, expired.text
    assert all(item["id"] != expired.json()["id"] for item in client.get("/public/campaigns").json())

    patched = client.patch(
        f"/admin/campaigns/{campaign['id']}",
        json={"is_active": False, "position": 9},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["is_active"] is False
    assert all(item["id"] != campaign["id"] for item in client.get("/public/campaigns").json())

    for campaign_id in (campaign["id"], expired.json()["id"]):
        assert client.delete(f"/admin/campaigns/{campaign_id}", headers=headers).status_code == 204


def test_media_upload_replace_delete_and_reference_updates(client: TestClient):
    headers = admin_headers(client)
    upload = client.post(
        "/admin/media/upload",
        files={"file": ("campaign.png", PNG_BYTES, "image/png")},
        data={"category": "campaign"},
        headers=headers,
    )
    assert upload.status_code == 200, upload.text
    media = upload.json()["media"]
    assert media["category"] == "campaign"
    assert media["url"].startswith("/media/uploads/")

    invalid = client.post(
        "/admin/media/upload",
        files={"file": ("not-an-image.png", b"plain text", "image/png")},
        headers=headers,
    )
    assert invalid.status_code == 400

    campaign = client.post(
        "/admin/campaigns",
        json={
            "title": "Media reference campaign",
            "description": "Links to an uploaded image.",
            "image_id": media["id"],
            "image_url": media["url"],
            "audience": "Everyone",
        },
        headers=headers,
    )
    assert campaign.status_code == 201, campaign.text
    campaign_id = campaign.json()["id"]

    replaced = client.post(
        f"/admin/media/{media['id']}/replace",
        files={"file": ("replacement.png", PNG_BYTES + b"-v2", "image/png")},
        headers=headers,
    )
    assert replaced.status_code == 200, replaced.text
    replacement = replaced.json()["media"]
    assert replacement["url"] != media["url"]
    repointed = client.get("/admin/campaigns", headers=headers).json()
    linked = next(item for item in repointed if item["id"] == campaign_id)
    assert linked["image_url"] == replacement["url"]

    deleted = client.delete(f"/admin/media/{media['id']}", headers=headers)
    assert deleted.status_code == 204
    detached = next(
        item for item in client.get("/admin/campaigns", headers=headers).json() if item["id"] == campaign_id
    )
    assert detached["image_url"] is None
    assert detached["image_id"] is None
    assert client.delete(f"/admin/campaigns/{campaign_id}", headers=headers).status_code == 204


def test_admin_settings_analytics_and_audit_actor_details(client: TestClient):
    headers = admin_headers(client)
    settings = client.get("/admin/settings", headers=headers)
    assert settings.status_code == 200
    assert settings.json()["settings"]["promo_banner_enabled"] in {"true", "false"}

    saved = client.patch(
        "/admin/settings",
        json={
            "settings": {
                "promo_banner_enabled": "true",
                "promo_banner_title": "Admin managed banner",
                "promo_banner_message": "Visible in the customer app.",
                "promo_banner_cta": "Browse now",
            }
        },
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    public_settings = client.get("/app/settings").json()
    assert public_settings["promo_banner_enabled"] is True
    assert public_settings["promo_banner_title"] == "Admin managed banner"
    assert public_settings["promo_banner_cta"] == "Browse now"

    today = date.today().isoformat()
    analytics = client.get(
        f"/admin/analytics?range=custom&start={today}&end={today}", headers=headers
    )
    assert analytics.status_code == 200, analytics.text
    body = analytics.json()
    assert body["range_start"] == today
    assert body["range_end"] == today
    assert len(body["trend"]) == 1
    assert body["trend"][0]["date"] == today
    assert isinstance(body["status_breakdown"], list)
    assert isinstance(body["branch_breakdown"], list)
    assert client.get(
        f"/admin/analytics?range=custom&start={today}&end={date.today() - timedelta(days=1)}",
        headers=headers,
    ).status_code == 400
    assert client.get("/admin/analytics?range=custom", headers=headers).status_code == 400
    assert client.get("/admin/analytics?range=today", headers=headers).status_code == 200

    logs = client.get("/admin/audit-logs?limit=20", headers=headers)
    assert logs.status_code == 200
    entries = logs.json()
    assert entries
    latest = entries[0]
    assert latest["actor_email"] == "admin@tests.example.com"
    assert latest["actor_role"] == "admin"
    assert latest["actor_name"]
    assert {"action", "entity", "entity_id", "created_at"} <= latest.keys()


def test_developer_diagnostics_do_not_expose_secrets(client: TestClient):
    registration = client.post(
        "/auth/register",
        json={
            "name": "Diagnostics Developer",
            "email": "developer-diagnostics@example.com",
            "password": "Secure-test-password-2026",
        },
    )
    assert registration.status_code == 201
    with SessionLocal() as db:
        developer = db.query(User).filter_by(email="developer-diagnostics@example.com").one()
        developer.role = "developer"
        db.commit()

    login = client.post(
        "/auth/admin-login",
        json={"identifier": "developer-diagnostics@example.com", "password": "Secure-test-password-2026"},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    diagnostics = client.get("/developer/diagnostics", headers=headers)
    assert diagnostics.status_code == 200, diagnostics.text
    body = diagnostics.json()
    assert body["status"] == "ok"
    assert body["database_dialect"] == "sqlite"
    assert body["counts"]["users"] >= 1
    assert body["uploads"]["files"] >= 0
    serialized = str(body).lower()
    assert "password" not in serialized
    assert "jwt" not in serialized
    assert "secret" not in serialized


def test_public_cached_endpoints_return_serialisable_payloads(client: TestClient):
    for path in ("/offers", "/public/campaigns", "/public/content", "/app/settings", "/salons", "/reviews?limit=5"):
        first = client.get(path)
        second = client.get(path)
        assert first.status_code == 200, f"{path}: {first.text}"
        assert second.status_code == 200, f"{path}: {second.text}"
        assert first.json() == second.json()


def test_health_readiness_and_metrics(client: TestClient):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/health/live").json() == {"status": "alive"}
    ready = client.get("/health/ready")
    assert ready.status_code == 200, ready.text
    assert ready.json()["status"] == "ready"
    assert ready.json()["database"] == "ok"

    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert "naturals_http_requests_total" in metrics.text
    assert "naturals_db_queries_total" in metrics.text
    assert "naturals_cache_requests_total" in metrics.text


def test_list_pagination_is_bounded_and_validated(client: TestClient):
    headers = admin_headers(client)
    first_page = client.get("/admin/users?limit=1&offset=0", headers=headers)
    second_page = client.get("/admin/users?limit=1&offset=1", headers=headers)
    assert first_page.status_code == 200, first_page.text
    assert second_page.status_code == 200, second_page.text
    assert len(first_page.json()) == 1
    assert len(second_page.json()) == 1
    assert first_page.json()[0]["id"] != second_page.json()[0]["id"]

    assert client.get("/admin/users?limit=0", headers=headers).status_code == 422
    assert client.get("/admin/users?limit=5000", headers=headers).status_code == 422

    token, _ = register(client, "pagination")
    bookings = client.get(
        "/bookings?limit=5&offset=0", headers={"Authorization": f"Bearer {token}"}
    )
    assert bookings.status_code == 200
    assert bookings.json() == []


def test_cached_catalog_is_invalidated_by_admin_writes(client: TestClient):
    headers = admin_headers(client)
    categories = client.get("/categories").json()
    category_id = categories[0]["id"]

    # Warm the cache before the write.
    assert client.get("/services").status_code == 200

    created = client.post(
        "/admin/services",
        json={
            "category_id": category_id,
            "name": "Cache invalidation treatment",
            "description": "Created by the performance test suite.",
            "duration_minutes": 30,
            "price": "1234.00",
            "audience": "Everyone",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    service_id = created.json()["id"]

    cached_list = client.get("/services").json()
    assert any(item["id"] == service_id for item in cached_list)

    updated = client.patch(
        f"/admin/services/{service_id}",
        json={"price": "4321.00"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    refreshed = client.get("/services").json()
    refreshed_service = next(item for item in refreshed if item["id"] == service_id)
    assert refreshed_service["price"] == "4321.00"


def test_availability_excludes_newly_booked_stylist(client: TestClient):
    salon_id, service_id = demo_ids(client)
    booking_date = date.today() + timedelta(days=9)
    slots = client.get(
        "/availability",
        params={"salon_id": salon_id, "service_id": service_id, "date": booking_date.isoformat()},
    ).json()["slots"]
    assert slots, "Expected at least one available slot for the demo branch."
    slot = slots[0]
    stylist_id = slot["staff"][0]["id"]

    token, _ = register(client, "availability-recheck")
    created = client.post(
        "/bookings",
        json={
            "salon_id": salon_id,
            "service_id": service_id,
            "staff_id": stylist_id,
            "date": booking_date.isoformat(),
            "start_time": slot["time"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created.status_code == 201, created.text

    after = client.get(
        "/availability",
        params={"salon_id": salon_id, "service_id": service_id, "date": booking_date.isoformat()},
    ).json()["slots"]
    matching = next((item for item in after if item["time"] == slot["time"]), None)
    if matching is not None:
        assert stylist_id not in {person["id"] for person in matching["staff"]}

