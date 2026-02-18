import { test, expect } from "@playwright/test";

test("Duplicate holds are rejected with correct message", async ({ page }) => {
  await page.goto("/");

  const auto = page.getByLabel("Auto-refresh");
  if (await auto.isChecked()) await auto.uncheck();

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = `Dup Book ${uid}`;
  const email = `alice+${uid}@example.com`;

  // Create book
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Copies").fill("1");
  await page.getByRole("button", { name: "Create" }).click();

  // Scope to Place a hold card to avoid ambiguity with User holds inputs
  const placeHoldCard = page
    .getByRole("heading", { name: "Place a hold" })
    .locator("..");
  const emailInput = placeHoldCard.getByPlaceholder("alice@example.com");
  const holdBookSelect = placeHoldCard.getByLabel("Book");

  const createdOption = holdBookSelect.locator("option", { hasText: title });
  await expect(createdOption).toHaveCount(1);
  const createdValue = await createdOption.first().getAttribute("value");
  if (!createdValue) throw new Error("Created book option has no value");
  await holdBookSelect.selectOption(createdValue);

  await emailInput.fill(email);
  await placeHoldCard.getByRole("button", { name: "Place hold" }).click();
  await expect(page.getByText(/Placed hold/i)).toBeVisible();

  // Duplicate attempt
  await placeHoldCard.getByRole("button", { name: "Place hold" }).click();
  await expect(page.getByText("Already on hold for this book")).toBeVisible();
});
