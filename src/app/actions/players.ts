"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, scores } from "@/db/schema";

/**
 * Roster editing for /admin.
 *
 * Results come back as a query string rather than through `useActionState`,
 * which keeps the whole admin page a server component with plain form posts —
 * no client bundle for a page seven people open once a quarter.
 */

/** A handle goes in a URL (`/players/riley`), so it is narrowed, not trusted. */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function done(message: string, error = false): never {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/scoreboard");
  redirect(`/admin?${error ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

/** Postgres unique violation, turned into something a person can act on. */
function describeConflict(e: unknown): string | null {
  const code = (e as { cause?: { code?: string }; code?: string })?.cause?.code ??
    (e as { code?: string })?.code;
  if (code !== "23505") return null;
  const detail = String(
    (e as { cause?: { detail?: string }; detail?: string })?.cause?.detail ??
      (e as { detail?: string })?.detail ??
      "",
  );
  if (detail.includes("email")) return "That email is already on the roster.";
  if (detail.includes("handle")) return "That handle is already taken.";
  return "That player already exists.";
}

export async function createPlayer(form: FormData) {
  const displayName = field(form, "displayName");
  const email = field(form, "email").toLowerCase();
  const handle = slugify(field(form, "handle") || displayName);

  if (!displayName) done("A display name is required.", true);
  if (!email.includes("@")) done("That doesn't look like an email address.", true);
  if (!handle) done("Couldn't make a URL handle from that name.", true);

  try {
    await db.insert(players).values({ displayName, email, handle });
  } catch (e) {
    done(describeConflict(e) ?? "Couldn't add that player.", true);
  }
  done(`Added ${displayName}.`);
}

export async function updatePlayer(form: FormData) {
  const id = field(form, "id");
  const displayName = field(form, "displayName");
  const email = field(form, "email").toLowerCase();
  const handle = slugify(field(form, "handle") || displayName);

  if (!id) done("No player named.", true);
  if (!displayName) done("A display name is required.", true);
  if (!email.includes("@")) done("That doesn't look like an email address.", true);
  if (!handle) done("Couldn't make a URL handle from that name.", true);

  try {
    await db
      .update(players)
      .set({ displayName, email, handle })
      .where(eq(players.id, id));
  } catch (e) {
    done(describeConflict(e) ?? "Couldn't save that change.", true);
  }
  done(`Saved ${displayName}.`);
}

export async function setPlayerActive(form: FormData) {
  const id = field(form, "id");
  const active = field(form, "active") === "true";
  if (!id) done("No player named.", true);

  const [row] = await db
    .update(players)
    .set({ isActive: active })
    .where(eq(players.id, id))
    .returning({ displayName: players.displayName });

  done(
    active
      ? `${row?.displayName ?? "Player"} is back on the roster.`
      : `${row?.displayName ?? "Player"} is off the roster. Their scores are untouched.`,
  );
}

export async function deletePlayer(form: FormData) {
  const id = field(form, "id");
  if (!id) done("No player named.", true);

  // scores.player_id cascades, so a delete here would take the history with it
  // and quietly change every other player's z-scores for those days. Anyone who
  // has played gets deactivated instead; this is checked server-side because the
  // disabled button in the UI is only a hint.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scores)
    .where(eq(scores.playerId, id));

  if (count > 0) {
    done(
      `That player has ${count} score${count === 1 ? "" : "s"}. Deactivate them instead — deleting would erase the history.`,
      true,
    );
  }

  const [row] = await db
    .delete(players)
    .where(eq(players.id, id))
    .returning({ displayName: players.displayName });

  done(`Deleted ${row?.displayName ?? "player"}.`);
}
