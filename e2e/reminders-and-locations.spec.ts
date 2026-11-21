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

  // Stub the provider only. Keep the picker, form, API and database real.
  await page.addInitScript(() => {
    class TestMap {
      constructor(private host: HTMLElement) {}
      addListener(_name: string, callback: (event: unknown) => void) {
        const listener = () =>
          callback({ latLng: { lat: () => 23.03, lng: () => 72.58 } });
        this.host.addEventListener("click", listener);
        return {
          remove: () => this.host.removeEventListener("click", listener),
        };
      }
      getZoom() {
        return 16;
      }
      setZoom() {}
      panTo() {}
    }
    class TestMarker {
      addListener() {
        return { remove() {} };
      }
    }
    Object.assign(window, {
      google: {
        maps: {
          importLibrary: async (name: string) =>
            name === "maps"
              ? { Map: TestMap }
              : { AdvancedMarkerElement: TestMarker },
        },
      },
    });
  });
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
  await page.getByRole("button", { name: "Choose on map" }).click();
  const map = page.getByLabel("Choose a location on Google Maps");
  await expect(map).toHaveCSS("height", "280px");
  await expect(page.getByText("Loading map…")).toHaveCount(0);
  await map.click();
  await expect(page.getByText("Pin: 23.030000, 72.580000")).toBeVisible();
  await page.getByRole("button", { name: "Create celebration" }).click();
  await expect(page).toHaveURL(/\/events\/[a-f\d]{24}$/);
  const id = page.url().split("/").pop();

  try {
    await expect(
      page.getByRole("link", { name: "Ceremony venue · Open Google Maps" }),
    ).toHaveAttribute("href", /query=23\.03%2C72\.58$/);
    await page.getByRole("button", { name: "Add item" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Item title").fill("Pick up flowers");
    await dialog.getByLabel("Location (optional)").fill("Florist");
    await dialog.getByText("Enter coordinates").click();
    await dialog.getByLabel("Latitude").fill("23.04");
    await dialog.getByLabel("Longitude").fill("72.59");
    await dialog.getByRole("button", { name: "Save detail" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Florist · Open Google Maps" }),
    ).toHaveAttribute("href", /query=23\.04%2C72\.59$/);
    await page.getByRole("button", { name: "Edit Pick up flowers" }).click();
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
  } finally {
    await page.request.delete(`/api/events/${id}`, { headers });
  }
});
