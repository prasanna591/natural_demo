# Naturals — salon booking app

A mobile-first Naturals salon companion built with Expo / React Native and a FastAPI API. The project includes the customer booking experience, an admin control panel, and a developer dashboard, all backed by the same SQLAlchemy database.

## What is included

- Expo Android, iOS, and web-compatible customer app with Home, Explore, Salons, Offers, Bookings, Profile, and protected Admin screens.
- Native Android build (Expo prebuild + Gradle), package `in.naturals.salon`, adaptive launcher icon and light/dark splash screen, gallery/camera image uploads, SecureStore sessions, and hardware back-button handling. Debug APK, signed release APK, and AAB build instructions are in [Android builds](#android-builds).
- Two coordinated visual experiences in one Naturals identity: a light lavender Women theme and a deep noir/gold Men experience, switched in the header.
- Responsive layouts for phone, tablet, and desktop, with a bottom navigation bar on compact widths and a full header navigation on desktop.
- Browse/search/filter services, salon selection, stylist choice, date and time availability, booking confirmation, cancellation, and rescheduling.
- Branch-level ratings and reviews: customers can post one review per branch (1–5 stars, optional title and comment), update or remove their own review, and admins can approve/hide/delete reviews. Branch cards and the Reviews tab show live rating summaries.
- Four-step booking ritual: salon → treatment → date/time/specialist → review, with optional offer code.
- Persisted user accounts, bookings, catalog, salons, offers, and administrator audit events.
- API-side validation of slots, ownership, offers, and administrator permissions.
- Appointment conflict checks cover complete service durations. SQLite uses an immediate write transaction to serialize reservations; PostgreSQL locks the salon row during reservation.
- Admin and developer dashboards with live analytics, appointment management, service/branch CRUD, branch-specific pricing and availability, campaigns, media library, CMS content editing, audit logs, and developer diagnostics.
- Role-gated dashboard sections: admins manage salon operations; developers additionally control Developer Mode, global settings, staff roles, and diagnostics.
- Real database records throughout the dashboard: metrics, charts, branch summaries, appointment filters, content, media, and audit entries are never mocked in the UI.
- Image uploads (JPG/JPEG/PNG/WebP) with preview, replacement, deletion, and database-backed references for services, salons, and campaigns.
- Customer-facing CMS and campaigns: homepage copy/images, promotional banner, and Women/Men targeted campaigns with start/end dates.
- Branch-aware customer catalogue: branch prices and unavailable services are enforced by the API during browsing, availability checks, booking, and rescheduling.
- Automatic schema upgrades on API startup: fresh databases are created from current models, and existing databases are upgraded to the latest Alembic revision, including repair of legacy missing columns.
- OpenAPI documentation at `/docs`.
- Verified Tamil Nadu branch directory with 52 locations across Chennai, Madurai, Salem, and Kumbakonam (names, addresses, PIN codes, phone numbers, and landmarks transcribed from the official locator), alongside clearly labeled demo studios and a welcome offer. Seelanaickenpatty is seeded inactive because the locator marks it temporarily closed.
- Published Men's and Women's service prices, member-price notes, and Bharathi Salai branch starting prices seeded from the supplied Naturals price lists. Ranges and member prices are preserved in service descriptions; durations are app estimates.

## Run locally (Windows PowerShell)

### 1. Start the API

```powershell
py -3.13 -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
Set-Location backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The default database is persistent SQLite at `backend\naturals.db`; the API creates its initial schema, applies any pending migrations, and adds clearly marked development seed data on first startup. To create local administrator and developer accounts on a fresh database, set `ADMIN_EMAIL`/`ADMIN_PASSWORD` and `DEVELOPER_EMAIL`/`DEVELOPER_PASSWORD` in the private `backend\.env` file before the first API startup. Passwords must be at least 12 characters. The example environment leaves these values blank; the application does not ship a usable default staff password. API docs: <http://localhost:8000/docs>.

To use PostgreSQL, set `DATABASE_URL` to a SQLAlchemy URL such as `postgresql+psycopg://user:password@localhost:5432/naturals` before starting the API. The API applies pending Alembic revisions at startup; you can also run `alembic upgrade head` from `backend` manually. SQLite is the no-setup local default; PostgreSQL requires a configured server and credentials.

Use the email and password configured in `backend\.env` for **Admin Login**. Set a strong `JWT_SECRET` before deployment. Existing databases initialized by an earlier version may still contain the old development administrator; rotate or disable that account before using such a database outside local development.

Customer **Sign In** and **Create Account** remain separate from **Admin Login**. The API only accepts administrator/developer accounts at `/auth/admin-login`; customer accounts cannot access admin or developer endpoints.

To authorize a developer, first create a regular account, stop the API, then promote that account from the backend using a trusted operator shell:

```powershell
Set-Location backend
python -c "from app.database import SessionLocal; from app.models import User; db=SessionLocal(); user=db.query(User).filter_by(email='developer@example.com').one(); user.role='developer'; db.commit(); db.close()"
```

Replace the example email with the account to authorize, then restart the API. To reset a forgotten staff (admin/developer) password from the backend directory:

```powershell
python -m scripts.reset_staff_password --email admin@naturals.example.com --password "new-strong-password"
``` Developer accounts sign in through **Admin Login**. In the dashboard, only accounts with the server-side `developer` role can open the Developer section, enable or disable Developer Mode, use developer-only settings, read diagnostics, or assign the developer role. Administrators can edit the public promotion banner through `/admin/settings`; developer settings additionally require Developer Mode. The API enforces these rules server-side, and public app settings expose only the banner content. Do not promote accounts you do not trust.

### 2. Start the frontend

In another PowerShell window, for browser development:

```powershell
Set-Location frontend
npm install
Copy-Item .env.example .env
npm run web
```

Open <http://localhost:8081>. For Expo Go on a phone, use `npm start` instead and scan the QR code. Set `EXPO_PUBLIC_API_URL` in `frontend\.env` for the device running the API:

- Android emulator: `http://10.0.2.2:8000`
- iOS simulator or browser on the same computer: `http://localhost:8000`
- Physical phone: `http://<computer-LAN-IP>:8000` (allow port 8000 on the local network firewall)

The API host must be reachable from the phone; `localhost` on a physical device refers to the phone itself.

## Verification

Backend tests:

```powershell
Set-Location backend
python -m pytest -q
```

Frontend type check:

```powershell
Set-Location frontend
npm run typecheck
```

## Android builds

The Android project is a native Expo/React Native build (not a WebView wrapper). It is generated from `frontend/app.json` with `expo prebuild` and lives in `frontend/android`.

- Application name: **Naturals Salon**
- Package ID: `in.naturals.salon`
- Version name: `1.0.0`
- Version code: `1`
- Minimum/target SDK, architecture and Hermes settings come from Expo SDK 54 defaults.

### API URL for Android

Android builds resolve the API in this order:

1. `EXPO_PUBLIC_API_URL_ANDROID`
2. `EXPO_PUBLIC_API_URL` when it is not `localhost`/`127.0.0.1`
3. `http://10.0.2.2:8000` (the Android emulator's address for the host machine)

Set the value in the build environment before Gradle bundles the JavaScript:

```powershell
$env:EXPO_PUBLIC_API_URL_ANDROID = "https://api.your-domain.example"
```

For local emulator testing use `http://10.0.2.2:8000`. A physical phone must use the computer's LAN address (for example `http://192.168.1.20:8000`) or a public HTTPS deployment, because `localhost` on the phone refers to the phone itself. Cleartext HTTP is enabled for local testing; use HTTPS in production.

The APK/AAB built for this workspace currently targets `http://10.92.221.240:8000`, the computer's Wi-Fi address when the build was produced. That address is assigned by DHCP and can change after a reconnect or reboot: run `ipconfig` to confirm it, update `frontend/.env` (`EXPO_PUBLIC_API_URL_ANDROID`) and rebuild so installed apps keep reaching the API. Phones must be on the same Wi-Fi network, and Windows Firewall must allow inbound TCP 8000.

### Prerequisites

- JDK 17 (`JAVA_HOME` must point to it; newer JDKs are not supported by React Native Gradle Plugin 0.81)
- Android SDK with `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`, the NDK (`ndk;27.1.12297006`) and the emulator/system image of your choice
- `ANDROID_HOME` pointing at the SDK

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\tools\jdk17"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

### Generate or refresh the native project

```powershell
Set-Location frontend
npx expo prebuild --platform android --clean
```

`--clean` regenerates `android/`. Re-apply the release signing block afterwards if you keep the generated project under version control; this repository already contains the configured project and `android/keystore.properties` is git-ignored.

### Release signing

The release build reads `frontend/android/keystore.properties`:

```properties
storeFile=release.keystore
storePassword=...
keyAlias=naturals
keyPassword=...
```

Create the keystore once (keep it and its passwords safe and backed up; losing it prevents Play Store updates):

```powershell
Set-Location frontend\android\app
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias naturals -keyalg RSA -keysize 2048 -validity 10000
```

If `keystore.properties` is absent, release builds fall back to the debug key so CI/local builds still work; never publish such an APK.

### Build commands

Run from `frontend\android`:

```powershell
# Debug APK (development build; needs Metro or `npx expo start`)
.\gradlew.bat assembleDebug

# Signed release APK (standalone, bundles the JS)
.\gradlew.bat assembleRelease

# Signed Android App Bundle for Google Play
.\gradlew.bat bundleRelease
```

Outputs:

| Artifact | Location |
|---|---|
| Debug APK | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `frontend/android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `frontend/android/app/build/outputs/bundle/release/app-release.aab` |

### Install on a device or emulator

```powershell
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb install -r "frontend\android\app\build\outputs\apk\release\app-release.apk"
& $adb shell am start -n in.naturals.salon/.MainActivity
```

To verify the signature before distribution:

```powershell
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --print-certs "frontend\android\app\build\outputs\apk\release\app-release.apk"
```

Native image uploads use the Android gallery/camera picker (`expo-image-picker`); the web build keeps its file input. Authentication tokens are stored with `expo-secure-store` on Android/iOS and `localStorage` on web. The Android hardware back button unwinds dialogs, service details, booking, authentication, admin sub-sections, and tabs before exiting.

## Screens and navigation

| Screen | Main behavior |
|---|---|
| Home | CMS-driven hero, live catalogue highlights, targeted campaign banner, category shortcuts, salon discovery, team preview, and booking entry. |
| Explore | Service search, category filters, service detail modal, live pricing and booking actions. Section filters keep Women and Men catalogues separate. |
| Salons | Full studio discovery with hours, addresses, contact details, team previews, search/filter, and direct booking. |
| Reviews | Branch rating summary and customer reviews; signed-in customers can post, update or remove one review per branch. |
| Try-On | Virtual studio: camera/gallery portrait with hairstyle, hair-colour and beauty-look preview simulations; photos stay on device. |
| Book a visit | Four-step flow: salon → branch-filtered service → server-returned date/time and optional specialist → review with optional offer code and branch-effective price. |
| Appointment confirmation | Booking reference and saved appointment appear in My Bookings. |
| Bookings | Loads the signed-in customer’s actual records; upcoming, past, and cancelled tabs; cancel and reschedule call the API and refresh persisted data. |
| Offers | Lists backend-configured active offers; code eligibility and discount are checked by the API at booking time. |
| Profile | Registration/login, persistent profile name updates, booking shortcuts, next-appointment summary, admin shortcut, and sign-out. |
| Admin overview | Live totals, today/upcoming/completed/cancelled/pending, revenue, booking trend, status breakdown, branch summary, and today/week/month/custom ranges with polling refresh. |
| Admin appointments | All-branch search and filters by reference/customer/service, date, branch, and status; confirm, reschedule, cancel, complete, delete, and per-branch summaries. |
| Admin services | Create/edit/deactivate services, upload or replace imagery, set audience/category/duration/price, and manage per-branch price and availability. |
| Admin branches | Create/edit/deactivate branches, maintain address/contact/hours/image, search/filter, and review branch service availability. |
| Admin campaigns | Create/edit/delete Women, Men, or Everyone campaigns with media, CTA, date window, active state, and position. |
| Admin media | Upload, preview, replace, and delete JPG/JPEG/PNG/WebP assets; replacement repoints stored service, branch, and campaign references. |
| Admin content | Edit CMS text and hero imagery for both Women and Men themes and the shared footer. |
| Admin audit log | Read server-recorded actions with actor name, email, role, entity, and detail. |
| Developer dashboard | Developer-only diagnostics, Developer Mode, global promotion settings, and staff role management. |

Main navigation is a bottom bar on phone and tablet, and a header navigation bar on desktop. Tabs cover Home, Services (Explore), Bookings, Branches (Salons), Reviews and Profile. The booking flow opens from Home, Explore, Salons, Offers, or the location control; authentication is required only to confirm a reservation. Admin screens are reachable from the desktop header or Profile → “Admin dashboard”; the Developer section is hidden from admins and enforced server-side for developer accounts.

## Design system

The interface is organised under `frontend/src`:

- `theme.ts` — Women/Men colour tokens, typography, spacing, radii, and breakpoints.
- `api.ts` — shared API types, formatting, section filtering, and token/section persistence.
- `http.ts` — API base URL and the shared authenticated fetch helper.
- `adminApi.ts` — admin/developer request wrappers and dashboard-only types.
- `context.tsx` — the shared application contract used by screens.
- `ui.tsx` — reusable typography, buttons, fields, badges, chips, images, spinners, and step indicators (with animated step-progress fill), plus lightweight press-feedback, skeleton loading, and glass panel helpers.
- `components.tsx` — service, category, salon, offer, booking, stylist, and selection cards.
- `components/Charts.tsx` — live trend and bar charts used by the dashboard.
- `layout.tsx` — header, Women/Men switch, floating pill bottom navigation with animated active states, footer, and page shell.
- `modals.tsx` — spring-animated service detail sheet and confirmation dialog, sliding toast, and branded loading state.
- `screens/` — Home, Explore, Salons, Offers, Bookings, Profile, Try-On, Admin, Auth, and Booking flows.
- `screens/admin/` — overview, appointments, services, branches, campaigns, media, content, audit, developer, and the shared media picker.

The Women experience uses warm ivory surfaces with deep purple accents. The Men experience uses near-black surfaces with warm gold accents. Web fonts are Cormorant Garamond and Inter via Google Fonts, with Georgia/system fallbacks on native.

The Virtual Try-On screen (`screens/TryOn.tsx`) lets customers photograph themselves with the existing gallery/camera permission flow and preview hairstyles, hair colours, and beauty looks as colour-and-label simulations. Photos are processed entirely on the device and never uploaded; the screen labels the preview honestly and always offers booking a stylist consultation as the real next step. All prices, durations, branch records, stylists, offers, and availability shown in the app come from the API. The Chennai, Madurai, Salem, and Kumbakonam directories are seeded from the official Tamil Nadu locator. Published Men's and Women's service prices, member-price notes, and Bharathi Salai branch starting prices come from the supplied price lists; durations, sample teams, opening hours, and availability remain app data. There are no invented ratings, reviews, or loyalty data.

## API overview

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health check. |
| POST | `/auth/register`, `/auth/login` | Public | Customer account and bearer-token session. |
| POST | `/auth/admin-login` | Public | Admin/developer-only sign-in by email or account name. |
| GET/PATCH | `/me` | Signed in | Read/update current profile. |
| GET | `/categories`, `/services`, `/services/{id}` | Public | Service catalog. `/services?salon_id=` applies branch pricing and hides unavailable services. |
| GET | `/salons`, `/salons/{id}`, `/salons/{id}/staff` | Public | Salon and eligible-stylist discovery. |
| GET | `/reviews/summary` | Public | Branch rating summary (average rating + count). |
| GET | `/reviews` | Public | Branch/service reviews (filter by `salon_id` or `service_id`). |
| POST | `/reviews` | Signed in | Post or update the customer's one review per branch. |
| PATCH | `/reviews/{id}` | Owner | Update the customer's own review. |
| DELETE | `/reviews/{id}` | Owner | Remove the customer's own review. |
| GET | `/admin/reviews` | Admin | List all reviews (filter by `salon_id`, `service_id`, `is_active`). |
| PATCH | `/admin/reviews/{id}` | Admin | Approve/hide a review. |
| DELETE | `/admin/reviews/{id}` | Admin | Delete a review. |
| GET | `/availability` | Public | Available start times and qualified staff for a salon, service, and date. |
| POST | `/bookings` | Signed in | Recheck branch availability and persist a booking atomically. |
| GET | `/bookings`, `/bookings/{id}` | Owner/admin | View personal booking history/details. |
| PUT | `/bookings/{id}` | Owner/admin | Revalidate and reschedule. |
| POST | `/bookings/{id}/cancel` | Owner/admin | Cancel and release the appointment capacity. |
| GET | `/offers` | Public | Current active promotions. |
| GET | `/app/settings` | Public | Customer-facing promotion banner configuration. |
| GET | `/public/content` | Public | Published CMS key/value content for the customer app. |
| GET | `/public/campaigns?audience=` | Public | Active, in-date campaigns filtered by audience. |
| GET | `/admin/overview` | Admin | Database-derived headline metrics and revenue. |
| GET | `/admin/analytics` | Admin | Totals, range metrics, trend, status, and branch breakdown. Supports `range=today`, `week`, `month`, or `custom` with `start`/`end` for custom. |
| GET | `/admin/bookings` | Admin | Filter/search all appointments by date, branch, status, reference, customer, or email. |
| PUT/DELETE | `/admin/bookings/{id}` | Admin | Update status, reschedule, or delete an appointment. |
| POST | `/admin/bookings/{id}/complete` | Admin | Mark a confirmed appointment completed for reporting. |
| GET/POST | `/admin/services` | Admin | List or create services. |
| PATCH/DELETE | `/admin/services/{id}` | Admin | Edit or deactivate a service. |
| GET/POST | `/admin/services/{id}/branch-prices` | Admin | Read or create branch price/availability overrides. |
| PATCH/DELETE | `/admin/services/{id}/branch-prices/{salon_id}` | Admin | Update or remove a branch override. |
| GET | `/admin/salons/{id}/services` | Admin | Read every service with its branch price and availability. |
| PUT | `/admin/salons/{id}/services/{service_id}` | Admin | Set branch price/availability for one service. |
| GET/POST | `/admin/salons` | Admin | List or create branches. |
| PATCH/DELETE | `/admin/salons/{id}` | Admin | Edit or deactivate a branch. |
| GET/POST | `/admin/campaigns` | Admin | List or create targeted campaigns. |
| PATCH/DELETE | `/admin/campaigns/{id}` | Admin | Edit or delete a campaign. |
| GET | `/admin/content` | Admin | Read CMS content with metadata. |
| PATCH | `/admin/content/{key}` | Admin | Update one CMS value. |
| GET | `/admin/media` | Admin | List uploaded media. |
| POST | `/admin/media/upload`, `/admin/media/{id}/replace` | Admin | Upload or replace an image. |
| DELETE | `/admin/media/{id}` | Admin | Delete media and clear stored references. |
| GET/PATCH | `/admin/settings` | Admin | Read/update the public promotion banner settings. |
| GET | `/admin/audit-logs` | Admin | Actor-enriched audit history. |
| GET | `/admin/users` | Admin | List accounts and roles. |
| PATCH | `/admin/users/{id}/role` | Admin/developer | Change a role; developer-role changes require a developer. |
| GET/POST | `/developer/mode` | Developer | Read or enable/disable Developer Mode. |
| GET/PATCH | `/developer/settings` | Developer + mode enabled | Read/update supported app settings. |
| GET | `/developer/diagnostics` | Developer | Runtime, database, upload, and record-count snapshot without secrets. |

All API routes have interactive OpenAPI details at `/docs`.

## Data model

SQLAlchemy models: `users` (customer/admin/developer role), `salons`, `categories`, `services`, `staff`, `staff_services`, `bookings`, `offers`, `app_settings`, `audit_logs`, `media_files`, `campaigns`, `service_branch_prices`, and `page_content`. Appointments store exact decimal prices and discounts, salon-local date/time as naive local datetimes, duration-derived end time, a unique human-readable reference, state, and associated user/salon/service/stylist. Foreign keys and unique/index constraints support the catalog and booking lookups.

`service_branch_prices` stores an optional per-branch price and an `is_available` flag. No row means the service uses its base price and is available; `is_available=false` removes it from the branch catalogue. Campaigns carry an `audience` (`Women`, `Men`, or `Everyone`), optional media reference, CTA, date window, active state, and display position. `page_content` stores the CMS keys seeded on first startup without overwriting later administrator edits. `media_files` records uploaded filenames, MIME types, sizes, and URLs. Audit rows capture the actor and optional detail for every dashboard mutation.

Alembic revisions are under `backend/alembic/versions`. The API creates a fresh schema and stamps the current head on startup; databases that already have an `alembic_version` table are upgraded to head automatically. Production deployment should test migrations against a backup before applying.

## Reference and data policy

The supplied `template.pdf` was used only as a layout and interaction reference. The app uses its own Naturals wordmark, copy, and section-specific art direction rather than copying the reference brands or content. Home-page promotional carousel imagery is bundled for reliable loading, while active campaign banners are served from the CMS and fall back to those bundled images if a campaign image cannot load.

This project does **not** connect to a private Naturals booking API or create bookings in official Naturals systems. The 52 verified branch names, addresses, PIN codes, phone numbers, and landmarks across Chennai, Madurai, Salem, and Kumbakonam are seeded from the official Tamil Nadu locator, and the published Men's, Women's, member and Bharathi Salai prices are seeded from the supplied price lists. Durations, opening hours, sample staff identities, availability, and `WELCOME10` remain demonstration records. Seelanaickenpatty is hidden from public booking while marked temporarily closed. Reconfirm branch details and replace sample operational data with authorized business data before launch. No payments, SMS, email, push notifications, map SDK, official reviews, loyalty points, or external booking integrations are configured.

## Security and production notes

- Passwords use salted scrypt; API sessions are HMAC-signed bearer tokens with expiry.
- Customer booking access is owner-scoped. Admin and developer routes require a server-side staff role, and developer-only routes additionally enforce Developer Mode where applicable.
- Every dashboard mutation writes an audit record with actor, action, entity, and optional detail. Audit output joins the actor name, email, and role without exposing password hashes.
- Uploads are restricted to JPG/JPEG/PNG/WebP with server-side type/size validation. Replacement creates a new file and repoints stored references; deletion clears stored references.
- Customer catalogue and booking endpoints apply branch pricing and availability so the frontend cannot bypass a disabled branch service.
- PostgreSQL should be used for deployment. Configure a strong secret, restricted CORS origins, TLS termination, rate limits, database backups, monitoring, and an operational secret manager.
- SQLite is suitable for local development, not multi-instance production operation.
- The admin dashboard covers overview analytics, appointments, services and branch pricing, branches, campaigns, media, CMS content, settings, and audit logs. The developer dashboard adds diagnostics, Developer Mode, global settings, and staff role management. Staff scheduling/holiday calendars, customer management screens, and downloadable reports are not yet included.
- OTP, email verification, password recovery, account deletion, payments, provider-backed notifications, map/geolocation, calendar export, reviews, and loyalty are not implemented.
- Service photography may be served from curated Unsplash URLs and falls back to a themed placeholder if the network blocks it; replace it with authorised salon photography before launch.
- Business cancellation rules are not configured; current cancellation allows any future confirmed appointment.

## Assets and attribution

The supplied brand image is bundled as `frontend/assets/logo.png` and `frontend/assets/icon.png` and configured as the app icon, adaptive icon, and web favicon. Square Android launcher, adaptive, monochrome, and light/dark splash assets are generated into `frontend/assets/android/` by `frontend/scripts/generate_icons.py` from the bundled Naturals wordmarks. The in-app header wordmark remains typeset so it can adapt to both themes. Bundled carousel photography and other curated Unsplash imagery remain subject to the Unsplash licence; replace them with authorised salon photography before launch. Naturals brand names and reference-site descriptions remain attributable to their respective owners; the seed content is explicitly marked as demo data.
