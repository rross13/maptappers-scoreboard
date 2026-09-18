import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke tests for the one flow that matters: pick a name, paste real share text
 * on a game's tab, save it, and find it on the leaderboard.
 *
 * Only the first test writes. It uses September 1 — a date outside the backfilled
 * history — so the run does not collide with real data.
 */
const MAPTAP = `www.maptap.gg September 1
91:dart: 88:trophy: 77:clap: 95:fire: 82:star2:
Final score: 866`;

async function openSubmit(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Submit scores" }).click();
}

test("paste a MapTap score, save it, and see it on the leaderboard", async ({ page }) => {
  await openSubmit(page);
  await page.selectOption("#player", { label: "Weston Watson" });

  // MapTap is first in the canonical order, so its tab opens selected.
  await expect(page.getByRole("tab", { name: /MapTap/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.fill("textarea", MAPTAP);

  // Live preview runs the same parser in the browser.
  await expect(page.locator("text=2026-09-01")).toBeVisible();

  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("text=/Saved MapTap 866/")).toBeVisible();

  // Submitting walks you on to the next game you haven't logged.
  await expect(page.getByRole("tab", { name: /Krillion/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("textarea")).toHaveValue("");

  await page.goto("/games/maptap?range=all");
  await expect(page.locator("text=2026-09-01").first()).toBeVisible();
  await expect(page.locator("text=866").first()).toBeVisible();
});

test("jumps straight to one game and links out to it", async ({ page }) => {
  await openSubmit(page);
  await page.getByRole("tab", { name: "Globle" }).click();

  await expect(page.getByRole("heading", { name: "Globle" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Play Globle/ })).toHaveAttribute(
    "href",
    "https://globle-game.com",
  );
  await expect(page.locator("textarea")).toHaveAttribute(
    "placeholder",
    /Globle/,
  );
});

test("offers the right tab when the paste belongs to another game", async ({ page }) => {
  await openSubmit(page);
  // A player must be picked, or Submit would be disabled for that reason and the
  // wrong-tab assertion below would pass without testing anything.
  await page.selectOption("#player", { label: "Owen" });
  await page.getByRole("tab", { name: "Krillion" }).click();
  await page.fill("textarea", MAPTAP);

  await expect(
    page.locator("text=/That reads as MapTap, not Krillion/"),
  ).toBeVisible();
  // A wrong-tab paste must never save under the open tab.
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Switch to MapTap" }).click();
  await expect(page.getByRole("tab", { name: /MapTap/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // The text carries over on a switch rather than making them paste twice.
  await expect(page.locator("textarea")).toHaveValue(MAPTAP);
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toBeEnabled();
});

test("clears the box when you pick a tab yourself", async ({ page }) => {
  await openSubmit(page);
  await page.fill("textarea", MAPTAP);
  await page.getByRole("tab", { name: "Fermi" }).click();
  await expect(page.locator("textarea")).toHaveValue("");
});

/**
 * Depends on the dev database holding a score for today, which the Slack
 * backfill only provides while "today" is inside its window. Skipping loudly
 * beats a mystery failure the morning after.
 */
test("locks a game you have already logged today", async ({ page }) => {
  await openSubmit(page);
  await page.selectOption("#player", { label: "Jackson" });

  const maptap = page.getByRole("tab", { name: /MapTap/ });
  const logged = ((await maptap.textContent()) ?? "").includes("\u2713");
  test.skip(!logged, "no MapTap score for today in this database");

  await expect(page.locator("textarea")).toBeDisabled();
  await expect(page.locator("text=on record")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toHaveCount(0);

  // Replacing is allowed — the old value survives in score_revisions.
  await page.getByRole("button", { name: "Replace it" }).click();
  await expect(page.locator("textarea")).toBeEnabled();

  // A game with nothing logged today stays open.
  await page.getByRole("tab", { name: /Fermi/ }).click();
  await expect(page.locator("textarea")).toBeEnabled();
});

test("remembers the selected player across a reload", async ({ page }) => {
  await openSubmit(page);
  await page.selectOption("#player", { label: "Owen" });
  await page.reload();
  await page.getByRole("button", { name: "Submit scores" }).click();
  await expect(page.locator("#player")).toHaveValue(
    await page.locator("#player option", { hasText: "Owen" }).getAttribute("value") ?? "",
  );
});

test("rejects a paste with no recognizable game", async ({ page }) => {
  await openSubmit(page);
  await page.selectOption("#player", { label: "Owen" });
  await page.fill("textarea", "lol that was rough today");
  await expect(page.locator("text=No MapTap score in there yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toBeDisabled();
});
