import { test, expect } from "@playwright/test";

test("DoD flow: freeze skip + all frozen + unfreeze assigns", async ({
  page,
}) => {
  const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const title = `DoD Book ${uid}`;
  const aliceEmail = `alice+${uid}@example.com`;
  const bobEmail = `bob+${uid}@example.com`;
  const charlieEmail = `charlie+${uid}@example.com`;

  await page.goto("/");

  // Reduce flakiness: disable auto-refresh for predictable assertions
  const auto = page.getByLabel("Auto-refresh");
  if (await auto.isChecked()) await auto.uncheck();

  // Create book with 1 copy
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Copies").fill("1");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByText(/Created book/i)).toBeVisible();

  const booksCard = page.getByRole("heading", { name: "Books" }).locator("..");

  // Scope to Place a hold card to avoid ambiguity
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

  const emailInput = placeHoldCard.getByPlaceholder("alice@example.com");

  // Place holds: Alice, Bob, Charlie
  await emailInput.fill(aliceEmail);
  await page.getByRole("button", { name: "Place hold" }).click();
  await expect(page.getByText(/Placed hold/i)).toBeVisible();

  await emailInput.fill(bobEmail);
  await page.getByRole("button", { name: "Place hold" }).click();
  await expect(page.getByText(/Placed hold/i)).toBeVisible();

  await emailInput.fill(charlieEmail);
  await page.getByRole("button", { name: "Place hold" }).click();
  await expect(page.getByText(/Placed hold/i)).toBeVisible();

  // Load Alice holds and freeze Alice
  const holdsCard = page
    .getByRole("heading", { name: "User holds" })
    .locator("..");
  await holdsCard.getByPlaceholder("alice@example.com").fill(aliceEmail);
  await holdsCard.getByRole("button", { name: "Load" }).click();
  const aliceFreezeBtn = holdsCard
    .getByRole("button", { name: "Freeze" })
    .first();
  await expect(aliceFreezeBtn).toBeEnabled();
  await aliceFreezeBtn.click();

  // Return copy: should assign to Bob (Alice frozen)
  await page.getByRole("button", { name: "Return copy" }).click();
  await expect(page.getByText(/Assigned to position/i)).toBeVisible();

  // Verify in Queue table: Bob is fulfilled
  const queueCard = page.getByRole("heading", { name: "Queue" }).locator("..");
  const bobRow = queueCard.locator("tr", { hasText: bobEmail });
  await expect(bobRow).toContainText("Yes");

  // Freeze Charlie too (so remaining holds are frozen)
  await holdsCard.getByPlaceholder("alice@example.com").fill(charlieEmail);
  await holdsCard.getByRole("button", { name: "Load" }).click();
  const charlieFreezeBtn = holdsCard
    .getByRole("button", { name: "Freeze" })
    .first();
  await expect(charlieFreezeBtn).toBeEnabled();
  await charlieFreezeBtn.click();

  // Return another copy: since remaining eligible holds are frozen => no assignment
  await page.getByRole("button", { name: "Return copy" }).click();
  await expect(page.getByText(/No one assigned/i)).toBeVisible();

  // Unfreeze Alice => copy was available => Alice should get it immediately
  await holdsCard.getByPlaceholder("alice@example.com").fill(aliceEmail);
  await holdsCard.getByRole("button", { name: "Load" }).click();
  const aliceUnfreezeBtn = holdsCard
    .getByRole("button", { name: "Unfreeze" })
    .first();
  await expect(aliceUnfreezeBtn).toBeEnabled();
  await aliceUnfreezeBtn.click();

  // Confirm Alice now shows fulfilled in queue (badge text "Yes" exists in row)
  const aliceRow = queueCard.locator("tr", { hasText: aliceEmail });
  await expect(aliceRow).toContainText("Yes");
});
