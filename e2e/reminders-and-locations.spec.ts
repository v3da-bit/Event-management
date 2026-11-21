import { expect, test } from "@playwright/test";
import { formatInTimeZone } from "date-fns-tz";

test("saves event and wishlist pins and shows only pending work in reminders", async ({
  page,
}) => {
  test.skip(
    process.env.TEST_API_PROXY !== "1",
    "Requires the local API proxy.",
  );
  const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
  const headers = { Origin: origin };
  const registration = await page.request.post("/api/auth/register", {
    headers,
    data: {
      fullName: "Reminder Check",
      email: `reminder-${Date.now()}@example.com`,
      password: "ReminderCheck123",
      team: "BRIDE",
    },
  });
  expect(registration.status()).toBe(201);

  // Exercise real Leaflet; stub only the external tile images for deterministic tests.
  const googleRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("maps.googleapis.com"))
      googleRequests.push(request.url());
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eddf"/></svg>',
    }),
  );
  await page.goto("/events/create");
  const title = "Reminder and map check";
  await page.getByLabel("Event title").fill(title);
  await page
    .getByLabel("Tell the story")
    .fill("Checking reminder and location persistence.");
  const time = (minutes: number) =>
    formatInTimeZone(
      Date.now() + minutes * 60000,
      "Asia/Kolkata",
      "yyyy-MM-dd'T'HH:mm",
    );
  await page.getByLabel("Starts at").fill(time(45));
  await page.getByLabel("Ends at").fill(time(90));
  await page
    .getByRole("combobox", { name: "Reminder", exact: true })
    .selectOption("60");
  await page.getByLabel("Location (optional)").fill("Ceremony venue");
  await page.getByText("Enter coordinates").click();
  await page.getByLabel("Latitude", { exact: true }).fill("23.03");
  await page.getByLabel("Longitude", { exact: true }).fill("72.58");
  await page.getByRole("button", { name: "Choose on map" }).click();
  const map = page.getByLabel("Choose a location on OpenStreetMap");
  await expect(map).toHaveCSS("height", "280px");
  await expect(page.getByText("Loading map…")).toHaveCount(0);
  await expect(map.locator(".leaflet-marker-icon")).toBeVisible();
  await expect(
    map.getByRole("link", { name: "OpenStreetMap", exact: true }),
  ).toBeVisible();
  await map.click({ position: { x: 100, y: 100 } });
  await expect(page.getByLabel("Longitude", { exact: true })).not.toHaveValue(
    "72.58",
  );
  const selected = map.locator(".leaflet-marker-icon");
  const box = await selected.boundingBox();
  const beforeDrag = await page
    .getByLabel("Longitude", { exact: true })
    .inputValue();
  await page.mouse.move(box!.x + 16, box!.y + 16);
  await page.mouse.down();
  await page.mouse.move(box!.x + 56, box!.y + 16, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel("Longitude", { exact: true })).not.toHaveValue(
    beforeDrag,
  );
  const pin = {
    lat: Number(
      await page.getByLabel("Latitude", { exact: true }).inputValue(),
    ),
    lng: Number(
      await page.getByLabel("Longitude", { exact: true }).inputValue(),
    ),
  };
  await page.getByRole("button", { name: "Hide map" }).click();
  await page.getByRole("button", { name: "Choose on map" }).click();
  await expect(map.locator(".leaflet-marker-icon")).toBeVisible();
  await page.getByRole("button", { name: "Create celebration" }).click();
  await expect(page).toHaveURL(/\/events\/[a-f\d]{24}$/);
  const id = page.url().split("/").pop();

  try {
    await expect(
      page.getByRole("link", { name: "Ceremony venue · Open Google Maps" }),
    ).toHaveAttribute(
      "href",
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pin.lat},${pin.lng}`)}`,
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Item title").fill("Pick up flowers");
    await dialog.getByLabel("Location (optional)").fill("Florist");
    await dialog.getByText("Enter coordinates").click();
    await dialog.getByLabel("Latitude").fill("23.04");
    await dialog.getByLabel("Longitude").fill("72.59");
    await dialog.getByRole("button", { name: "Choose on map" }).click();
    await expect(dialog.locator(".leaflet-marker-icon")).toBeVisible();
    await dialog.getByRole("button", { name: "Save detail" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Florist · Open Google Maps" }),
    ).toHaveAttribute("href", /query=23\.04%2C72\.59$/);
    await page.getByRole("button", { name: "Edit Pick up flowers" }).click();
    await dialog.getByRole("button", { name: "Choose on map" }).click();
    await expect(dialog.locator(".leaflet-marker-icon")).toBeVisible();
    await dialog.getByLabel("Location (optional)").clear();
    await dialog.getByRole("button", { name: "Remove pin" }).click();
    await dialog.getByRole("button", { name: "Save detail" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Florist · Open Google Maps" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    const reminder = page
      .locator(".reminder-widget")
      .getByRole("link")
      .filter({ hasText: title });
    await expect(reminder).toContainText("Pick up flowers");
    await reminder.click();
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/toggle") &&
        response.request().method() === "PATCH",
    );
    await page
      .getByRole("checkbox", { name: "Mark Pick up flowers completed" })
      .click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByText("1 of 1 details taken care of")).toBeVisible();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(reminder).toBeVisible();
    await expect(reminder).not.toContainText("Pick up flowers");
    expect(googleRequests).toEqual([]);
  } finally {
    await page.request.delete(`/api/events/${id}`, { headers });
  }
});

test("location controls remain usable on mobile when map tiles fail", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 23.03, longitude: 72.58 });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        _id: "test-location-user",
        fullName: "Location Check",
        team: "GROOM",
      },
    }),
  );
  await page.route("**/api/events/reminders", (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/events/create");
  await page.getByLabel("Location (optional)").fill("Kadi & Ahmedabad");
  await page.getByRole("button", { name: "Choose on map" }).click();
  await expect(page.getByText(/Map tiles could not load/)).toBeVisible();
  const map = page.getByLabel("Choose a location on OpenStreetMap");
  await expect(
    map.getByRole("link", { name: "OpenStreetMap", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Search on OpenStreetMap/ }),
  ).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/search?query=Kadi%20%26%20Ahmedabad",
  );
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("Pin: 23.030000, 72.580000")).toBeVisible();
  await expect(map.locator(".leaflet-marker-icon")).toBeVisible();
  await page.getByRole("button", { name: "Remove pin" }).click();
  await expect(map.locator(".leaflet-marker-icon")).toHaveCount(0);
  await page.getByText("Enter coordinates").click();
  await page.getByLabel("Latitude", { exact: true }).fill("0");
  await page.getByLabel("Longitude", { exact: true }).fill("0");
  await expect(page.getByText("Pin: 0.000000, 0.000000")).toBeVisible();
  await expect(page.getByLabel("Location (optional)")).toHaveValue(
    "Kadi & Ahmedabad",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
