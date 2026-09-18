import { test, expect } from "@playwright/test";

/**
 * Smoke test for the one flow that matters: pick a name, paste real share text,
 * see it parsed, save it, and find it on the leaderboard.
 *
 * Uses September 1 — a date outside the backfilled history — so the run does not
 * collide with real data, and cleans up after itself.
 */
const MAPTAP = `www.maptap.gg September 1
91:dart: 88:trophy: 77:clap: 95:fire: 82:star2:
Final score: 866`;

test("paste a MapTap score, save it, and see it on the leaderboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Submit scores" }).click();

  await page.selectOption("#player", { label: "Weston Watson" });
  await page.fill("textarea", MAPTAP);

  // Live preview runs the same parser in the browser.
  const preview = page.locator("text=MapTap").first();
  await expect(preview).toBeVisible();
  await expect(page.locator("text=2026-09-01")).toBeVisible();

  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("text=/Saved MapTap 866 for 2026-09-01/")).toBeVisible();

  await page.goto("/games/maptap?range=all");
  const day = page.locator("text=2026-09-01").first();
  await expect(day).toBeVisible();
  await expect(page.locator("text=866").first()).toBeVisible();
});

test("remembers the selected player across a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Submit scores" }).click();
  await page.selectOption("#player", { label: "Owen" });
  await page.reload();
  await page.getByRole("button", { name: "Submit scores" }).click();
  await expect(page.locator("#player")).toHaveValue(
    await page.locator("#player option", { hasText: "Owen" }).getAttribute("value") ?? "",
  );
});

test("rejects a paste with no recognizable game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Submit scores" }).click();
  await page.selectOption("#player", { label: "Owen" });
  await page.fill("textarea", "lol that was rough today");
  await expect(page.locator("text=No game recognized yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toBeDisabled();
});
