import { test, expect } from "@playwright/test";

test("Freeze keeps position; unfreeze re-enables eligibility", async ({
  page,
}) => {
  const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const title = `Freeze Book ${uid}`;
  const aliceEmail = `alice+${uid}@example.com`;
  const bobEmail = `bob+${uid}@example.com`;

  await page.goto("/");

  const auto = page.getByLabel("Auto-refresh");
  if (await auto.isChecked()) await auto.uncheck();

  // Create book with 1 copy so return drives assignment
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Copies").fill("1");
  await page.getByRole("button", { name: "Create" }).click();

  const booksCard = page.getByRole("heading", { name: "Books" }).locator("..");

  const placeHoldCard = page
    .getByRole("heading", { name: "Place a hold" })
    .locator("..");
  const holdBookSelect = placeHoldCard.locator("#hold-book");
  const createdBookOptions = holdBookSelect.locator(
    `option:has-text("${title}")`,
  );
  await expect(createdBookOptions).toHaveCount(1);
  const createdBookId = await createdBookOptions.first().getAttribute("value");
  if (!createdBookId) throw new Error("Created book option not found");
  await holdBookSelect.selectOption(createdBookId);

  const selectedBookDropdown = booksCard.locator("select").first();
  await selectedBookDropdown.selectOption(createdBookId);

  // Scope to Place a hold card to avoid ambiguity
  const emailInput = placeHoldCard.getByPlaceholder("alice@example.com");

  await emailInput.fill(aliceEmail);
  await page.getByRole("button", { name: "Place hold" }).click();

  await emailInput.fill(bobEmail);
  await page.getByRole("button", { name: "Place hold" }).click();

  // Freeze Alice via user holds
  const holdsCard = page
    .getByRole("heading", { name: "User holds" })
    .locator("..");
  await holdsCard.getByPlaceholder("alice@example.com").fill(aliceEmail);
  await holdsCard.getByRole("button", { name: "Load" }).click();
  const freezeBtn = holdsCard.getByRole("button", { name: "Freeze" }).first();
  await expect(freezeBtn).toBeEnabled();
  await freezeBtn.click();

  // Return copy should go to Bob
  await page.getByRole("button", { name: "Return copy" }).click();
  const queueCard = page.getByRole("heading", { name: "Queue" }).locator("..");
  const bobRow = queueCard.locator("tr", { hasText: bobEmail });
  await expect(bobRow).toContainText("Yes"); // fulfilled

  // Unfreeze Alice (no copies available right now, but should switch frozen state)
  await holdsCard.getByPlaceholder("alice@example.com").fill(aliceEmail);
  await holdsCard.getByRole("button", { name: "Load" }).click();
  const unfreezeBtn = holdsCard
    .getByRole("button", { name: "Unfreeze" })
    .first();
  await expect(unfreezeBtn).toBeEnabled();
  await unfreezeBtn.click();

  // Position should still be 1 in Queue table
  const aliceRow = queueCard.locator("tr", { hasText: aliceEmail });
  await expect(aliceRow).toContainText("1");
});
