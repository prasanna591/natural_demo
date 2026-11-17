import { demoRequest } from "../src/demo/router";
import type { DemoRequestResult } from "../src/demo/types";

async function main() {
  const failures: string[] = [];
  const check = (label: string, result: DemoRequestResult, expectStatus: number) => {
    if (result.status !== expectStatus) {
      failures.push(`${label}: expected ${expectStatus}, got ${result.status} ${JSON.stringify(result.body).slice(0, 200)}`);
    } else {
      console.log(`OK   ${label} -> ${result.status}`);
    }
  };

  const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

  // --- Auth ---
  const adminLogin = demoRequest("POST", "/auth/admin-login", null, json({ identifier: "admin@naturals.example", password: "Admin@123" }));
  check("admin login", adminLogin, 200);
  const adminToken = (adminLogin.body as { access_token?: string }).access_token as string;

  const devLogin = demoRequest("POST", "/auth/admin-login", null, json({ identifier: "developer@naturals.example", password: "Dev@123" }));
  check("developer login", devLogin, 200);
  const devToken = (devLogin.body as { access_token?: string }).access_token as string;

  const custLogin = demoRequest("POST", "/auth/login", null, json({ email: "demo@naturals.example", password: "Demo@123" }));
  check("customer login", custLogin, 200);
  const custToken = (custLogin.body as { access_token?: string }).access_token as string;

  // --- Public ---
  check("services", demoRequest("GET", "/services", null, {}), 200);
  check("salons", demoRequest("GET", "/salons", null, {}), 200);
  check("offers", demoRequest("GET", "/offers", null, {}), 200);
  check("app settings", demoRequest("GET", "/app/settings", null, {}), 200);
  check("public content", demoRequest("GET", "/public/content", null, {}), 200);
  check("public campaigns", demoRequest("GET", "/public/campaigns", null, {}), 200);
  const salons: any[] = (demoRequest("GET", "/salons", null, {}).body as any[]);
  const salonId = salons[0].id;
  const services: any[] = (demoRequest("GET", "/services", null, {}).body as any[]);
  const serviceId = services[0].id;
  check("salon staff", demoRequest("GET", `/salons/${salonId}/staff`, null, {}), 200);

  // Availability for a future day.
  const future = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  check("availability", demoRequest("GET", `/availability?salon_id=${salonId}&service_id=${serviceId}&date=${future}`, null, {}), 200);
  check("reviews", demoRequest("GET", `/reviews?salon_id=${salonId}`, null, {}), 200);
  check("review summary", demoRequest("GET", `/reviews/summary?salon_id=${salonId}`, null, {}), 200);

  // --- Customer bookings ---
  const booking = demoRequest("POST", "/bookings", custToken, json({
    salon_id: salonId, service_id: serviceId, staff_id: 1,
    date: future, start_time: "10:00",
  }));
  check("create booking", booking, 201);
  const bookingId = (booking.body as { id?: number }).id as number;
  check("list bookings", demoRequest("GET", "/bookings", custToken, {}), 200);
  const cancelled = demoRequest("POST", `/bookings/${bookingId}/cancel`, custToken, {});
  check("cancel booking", cancelled, 200);

  // --- Reviews ---
  const createdReview = demoRequest("POST", "/reviews", custToken, json({ salon_id: salonId, service_id: serviceId, rating: 5, title: "Great", comment: "Loved it" }));
  check("create review", createdReview, 201);
  const reviewId = (createdReview.body as { id?: number }).id as number;
  const updatedReview = demoRequest("PATCH", `/reviews/${reviewId}`, custToken, json({ rating: 4, title: "Still good" }));
  check("update review", updatedReview, 200);
  // Customer cannot flip is_active (moderation bypass guard).
  const bypass = demoRequest("PATCH", `/reviews/${reviewId}`, custToken, json({ title: "t", is_active: false }));
  check("customer cannot deactivate review", bypass, 200);
  if ((bypass.body as { is_active?: boolean }).is_active !== true) failures.push("review is_active was flipped by customer");

  // --- Admin moderation ---
  const hidden = demoRequest("PATCH", `/admin/reviews/${reviewId}`, adminToken, json({ is_active: false }));
  check("admin hide review", hidden, 200);
  const approved = demoRequest("PATCH", `/admin/reviews/${reviewId}`, adminToken, json({ is_active: true }));
  check("admin approve review", approved, 200);
  if ((approved.body as { is_active?: boolean }).is_active !== true) failures.push("review not re-approved");

  const adminReviews = demoRequest("GET", "/admin/reviews", adminToken, {});
  check("admin list reviews", adminReviews, 200);

  // --- Campaigns ---
  const campaign = demoRequest("POST", "/admin/campaigns", adminToken, json({
    title: "Demo campaign", subtitle: "s", description: "d", cta_label: "Explore",
    audience: "Everyone", is_active: true, position: 1,
  }));
  check("create campaign", campaign, 201);
  const campaignId = (campaign.body as { id?: number }).id as number;
  const toggled = demoRequest("PATCH", `/admin/campaigns/${campaignId}`, adminToken, json({ is_active: false }));
  check("toggle campaign off", toggled, 200);
  const publicCampaigns = demoRequest("GET", "/public/campaigns", null, {});
  check("public campaigns exclude inactive", publicCampaigns, 200);
  if ((publicCampaigns.body as any[]).some((c: any) => c.id === campaignId)) failures.push("inactive campaign still public");

  // --- Admin overview + analytics + audit ---
  check("admin overview", demoRequest("GET", "/admin/overview", adminToken, {}), 200);
  check("admin analytics", demoRequest("GET", "/admin/analytics", adminToken, {}), 200);
  check("admin audit logs", demoRequest("GET", "/admin/audit-logs?limit=5", adminToken, {}), 200);
  check("developer diagnostics", demoRequest("GET", "/developer/diagnostics", devToken, {}), 200);

  // --- 404 unknown ---
  check("unknown endpoint 404", demoRequest("GET", "/nope", null, {}), 404);

  console.log(failures.length ? `\nFAILURES:\n${failures.join("\n")}` : "\nAll demo smoke checks passed.");
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
