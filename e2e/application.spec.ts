import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const apiOrigin = process.env.TEST_API_URL || "http://localhost:4000";
const frontendOrigin = process.env.TEST_BASE_URL || "http://localhost:3000";
test("landing page and protected route redirect", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "One celebration.",
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, lovely." }),
  ).toBeVisible();
});
test.describe("live seeded application", () => {
  test.skip(
    !process.env.TEST_PASSWORD,
    "Set TEST_PASSWORD to the password used for the seed accounts.",
  );
  test("plans a moment, completes a wishlist and renders mobile navigation", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/login");
    await page
      .getByLabel("Email address")
      .fill(process.env.TEST_EMAIL || "aarav@example.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.TEST_PASSWORD!);
    await page
      .getByRole("button", { name: "Step into your celebration" })
      .click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /A little closer to forever/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your celebrations" }),
    ).toBeVisible();
    const leftovers = await page.request.get(
      `${apiOrigin}/events/my-team?search=Browser%20celebration&limit=100`,
    );
    for (const event of (await leftovers.json()).items || [])
      await page.request.delete(`${apiOrigin}/events/${event._id}`, {
        headers: { Origin: frontendOrigin },
      });
    await page.reload();
    await expect(page.getByText("Mehendi & memories").first()).toBeVisible();
    await expect(page.locator(".events-grid")).toHaveCSS("opacity", "1");
    mkdirSync(".local/screenshots", { recursive: true });
    await page.screenshot({
      path: ".local/screenshots/dashboard-desktop.png",
      fullPage: true,
    });
    const badImage = await page.request.post(
      `${apiOrigin}/uploads/image`,
      {
        headers: { Origin: frontendOrigin },
        multipart: {
          file: {
            name: "fake.png",
            mimeType: "image/png",
            buffer: Buffer.from("This is not an image"),
          },
        },
      },
    );
    expect(badImage.status()).toBe(400);
    const oversized = await page.request.post(
      `${apiOrigin}/uploads/image`,
      {
        headers: { Origin: frontendOrigin },
        multipart: {
          file: {
            name: "large.png",
            mimeType: "image/png",
            buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
          },
        },
      },
    );
    expect(oversized.status()).toBe(413);

    await page.getByRole("link", { name: "Create event", exact: true }).click();
    const title = `Browser celebration ${Date.now()}`;
    await page.getByLabel("Event title").fill(title);
    await page
      .getByLabel("Tell the story")
      .fill("A celebration created through the real user interface.");
    await page.getByLabel("Starts at").fill("2099-02-15T10:00");
    await page.getByLabel("Ends at").fill("2099-02-15T13:00");
    await page.getByLabel("Location (optional)").fill("The Garden Courtyard");
    await page
      .getByRole("button", { name: "Create celebration", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.getByRole("link", { name: "Edit event", exact: true }).click();
    await page.getByLabel("Event title").fill(title + " updated");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      title + " updated",
    );
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Item title").fill("Confirm photographer");
    await page.getByRole("button", { name: "Save detail" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const check = page.getByRole("checkbox", {
      name: "Mark Confirm photographer completed",
    });
    await check.click();
    await expect(page.getByText("1 of 1 details taken care of")).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Mark Confirm photographer pending" }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Leave event", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Join event", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Join event", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Leave event", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete event", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete event", exact: true })
      .click();
    await expect(page).toHaveURL(/\/events$/);
    await page.goto("/events");
    await page.getByText("Mehendi & memories", { exact: true }).click();
    await expect(
      page.getByText("Their team manages this wishlist.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Edit event", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("checkbox").first()).toBeDisabled();
    await page.goto("/calendar");
    await expect(
      page.getByRole("heading", { name: "A date with your favourite people." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "week", exact: true }).click();
    await expect(page.locator(".calendar-grid.week")).toBeVisible();
    await page.goto("/dashboard");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/open/);
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Make yourself at home." }),
    ).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.locator(".events-grid")).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: ".local/screenshots/dashboard-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
});

test("registration, profile editing, refresh recovery and password change", async ({
  page,
  context,
}) => {
  const email = `audit-${Date.now()}@example.com`;
  const password = "AuditStrongPass123";
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Audit Bride");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill("DoesNotMatch123");
  await page.getByRole("button", { name: "Start planning together" }).click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Start planning together" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/profile");
  await expect(page.getByLabel("Your team")).toHaveValue("Team Bride");
  await page.getByLabel("Full name").fill("Audit Bride Updated");
  await page.getByRole("button", { name: "Save your details" }).click();
  await expect(
    page.getByText("Profile updated", { exact: true }),
  ).toBeVisible();
  await context.clearCookies({ name: "access_token" });
  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Audit Bride Updated");
  await expect(page).toHaveURL(/\/profile/);
  await page.goto("/settings");
  await page.getByLabel("Current password").fill(password);
  await page.getByLabel("New password").fill("AuditReplacement123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("AuditReplacement123");
  await page
    .getByRole("button", { name: "Step into your celebration" })
    .click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
