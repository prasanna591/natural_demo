Implementation Plan – Naturals Admin & Developer Dashboard

BACKEND (FastAPI + SQLAlchemy):
1. .env: set default ADMIN credentials + JWT secret (dev)
2. models.py: add image_url to Service/Salon; new models MediaFile, Campaign, ServiceBranchPrice, PageContent
3. schemas.py: new request/response schemas + extend ServiceOut/SalonOut/BookingOut
4. alembic migration 0002: new tables + image_url columns
5. main.py: new endpoints (analytics, bookings CRUD+filters, salons CRUD, services full CRUD+branch prices, media upload/serve, campaigns, content, audit logs, users/roles); StaticFiles for /media/uploads
6. Run backend tests

FRONTEND (Expo/React Native):
7. frontend/.env: EXPO_PUBLIC_API_URL
8. app.json: icon/favicon/logo (DONE)
9. api.ts: new types + request helpers for admin endpoints + form upload helper
10. context.tsx: extend NaturalsContextValue with dashboard state + loaders/mutators
11. App.tsx: wire new data + admin sub-tab routing
12. charts/: BarChart, TrendChart (pure RN Views, no new deps)
13. screens/: AdminDashboard (overview), Appointments, Services, Branches, Campaigns, Media, Audit, Developer
14. layout.tsx: admin sub-nav + developer gating
15. images.ts: prefer DB image_url for services/salons

## Reviews feature (added per Naturals website analysis)
16. Backend: Review model, migration 0004, CRUD + rating summary, attach ratings to /salons (DONE)
17. Frontend: review types, context state/actions, customer Reviews tab screen, admin Reviews moderation screen, salon rating badges (DONE)
18. Tests + typecheck pass (DONE)

LOGO: assets/logo.png & icon.png set (DONE)
