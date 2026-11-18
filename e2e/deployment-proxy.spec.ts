import { test, expect } from "@playwright/test";

test("deployment proxy forwards sessions, blocks untrusted writes and disables caching", async ({
  page,
}) => {
  test.skip(
    process.env.TEST_API_PROXY !== "1",
    "Run with NEXT_PUBLIC_API_URL=/api, API_PROXY_URL configured and TEST_API_PROXY=1.",
  );
  const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
  const health = await page.request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  expect(health.headers()["cache-control"]).toContain("no-store");
  const register = await page.request.post("/api/auth/register", {
    headers: { Origin: origin },
    data: {
      fullName: "Proxy Audit",
      email: `proxy-${Date.now()}@example.com`,
      password: "ProxyAuditPassword123",
      team: "GROOM",
    },
  });
  expect(register.status()).toBe(201);
  const setCookies = register
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie");
  expect(setCookies).toHaveLength(2);
  expect(
    setCookies.every(
      (h) => /HttpOnly/i.test(h.value) && /SameSite=Lax/i.test(h.value),
    ),
  ).toBe(true);
  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(200);
  expect((await me.json()).fullName).toBe("Proxy Audit");
  const forged = await page.request.patch("/api/users/me", {
    headers: { Origin: "https://untrusted.example" },
    data: { fullName: "Rejected" },
  });
  expect(forged.status()).toBe(403);
  const browserApiRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/auth/me")) browserApiRequests.push(req.url());
  });
  await page.goto("/profile");
  await expect(page.getByLabel("Full name")).toHaveValue("Proxy Audit");
  expect(browserApiRequests).toContain(`${origin}/api/auth/me`);
  const logoutRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/auth/logout")) logoutRequests.push(req.url());
  });
  await page.locator(".sidebar .brand").click();
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Proxy Audit", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Continue planning" })).toBeVisible();
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
  expect(logoutRequests).toHaveLength(0);
  await page.getByRole("link", { name: "Your account", exact: true }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Proxy Audit");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start your story" })).toBeVisible();
});
