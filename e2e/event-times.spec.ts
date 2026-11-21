import { test, expect } from "@playwright/test";

test("event form accepts later same-day times and validates create and edit", async ({
  page,
}) => {
  test.skip(
    process.env.TEST_API_PROXY !== "1",
    "Requires the local API proxy.",
  );
  const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
  const registered = await page.request.post("/api/auth/register", {
    headers: { Origin: origin },
    data: {
      fullName: "Event Time Check",
      email: `event-time-${Date.now()}@example.com`,
      password: "EventTimeCheck123",
      team: "GROOM",
    },
  });
  expect(registered.status()).toBe(201);
  await page.goto("/events/create");
  await page.getByLabel("Event title").fill("Same-day celebration");
  await page
    .getByLabel("Tell the story")
    .fill("Checking date and time validation.");
  await page
    .getByRole("combobox", { name: "Timezone", exact: true })
    .selectOption("Asia/Kolkata");
  await page.getByLabel("Starts at").fill("2099-02-15T10:00");
  const error = page
    .getByRole("alert")
    .filter({ hasText: "End date and time must be after the start" });
  for (const end of ["2099-02-15T09:59", "2099-02-15T10:00"]) {
    await page.getByLabel("Ends at").fill(end);
    await page
      .getByRole("button", { name: "Create celebration", exact: true })
      .click();
    await expect(error).toBeVisible();
    await expect(page).toHaveURL(/\/events\/create$/);
  }
  await page.getByLabel("Ends at").fill("2099-02-15T10:01");
  await expect(error).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create celebration", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/[a-f\d]{24}$/);
  const id = page.url().split("/").pop();
  try {
    const created = await page.request.get(`/api/events/${id}`);
    expect(await created.json()).toMatchObject({
      startDate: "2099-02-15T04:30:00.000Z",
      endDate: "2099-02-15T04:31:00.000Z",
    });
    await page.goto(`/events/${id}/edit`);
    await expect(page.getByLabel("Starts at")).toHaveValue("2099-02-15T10:00");
    await expect(page.getByLabel("Ends at")).toHaveValue("2099-02-15T10:01");
    await page.getByLabel("Starts at").fill("2099-02-15T11:00");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(error).toBeVisible();
    await page.getByLabel("Ends at").fill("2099-02-15T12:00");
    await expect(error).toHaveCount(0);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page).toHaveURL(`${origin}/events/${id}`);
    await page.goto(`/events/${id}/edit`);
    await expect(page.getByLabel("Ends at")).toHaveValue("2099-02-15T12:00");
    await page.getByLabel("Starts at").fill("2099-02-15T23:30");
    await page.getByLabel("Ends at").fill("2099-02-16T00:30");
    await expect(error).toHaveCount(0);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page).toHaveURL(`${origin}/events/${id}`);
  } finally {
    await page.request.delete(`/api/events/${id}`, {
      headers: { Origin: origin },
    });
  }
});
