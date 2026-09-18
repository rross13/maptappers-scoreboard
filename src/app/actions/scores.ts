"use server";

import { revalidatePath } from "next/cache";
import { parsePaste, SCOREBOARD_TZ } from "@/lib/parser";
import { getPlayers, saveEntry, type SaveResult } from "@/lib/queries";

export interface SubmitState {
  ok: boolean;
  saved: SaveResult[];
  problems: string[];
  message?: string;
}

/**
 * Persists everything parseable in a paste.
 *
 * The client shows a live preview using the same parser, but this re-parses from
 * the raw text: the preview is UX, never the trust boundary.
 */
export async function submitScore(
  playerId: string,
  text: string,
  acceptLowConfidence = false,
): Promise<SubmitState> {
  if (!playerId) {
    return { ok: false, saved: [], problems: [], message: "Pick your name first." };
  }
  if (!text.trim()) {
    return { ok: false, saved: [], problems: [], message: "Nothing to submit." };
  }

  const roster = await getPlayers();
  if (!roster.some((p) => p.id === playerId)) {
    return { ok: false, saved: [], problems: [], message: "Unknown player." };
  }

  const result = parsePaste(text, { timeZone: SCOREBOARD_TZ });

  // Low-confidence reads (typed Globle scores) are never saved without an
  // explicit confirmation, because "Globle #20" and "I did Globle 3 times"
  // are real shapes that look identical to a score.
  const toSave = result.entries.filter(
    (e) => acceptLowConfidence || e.scoreConfidence !== "low",
  );
  const heldBack = result.entries.filter(
    (e) => !acceptLowConfidence && e.scoreConfidence === "low",
  );

  const saved: SaveResult[] = [];
  for (const entry of toSave) {
    saved.push(await saveEntry(playerId, entry));
  }

  const problems = [
    ...result.failures.flatMap((f) =>
      f.issues
        .filter((i) => i.severity === "error")
        .map((i) => `${f.displayName}: ${i.message}`),
    ),
    ...heldBack.map(
      (e) => `${e.displayName}: read as ${e.score} — confirm to save.`,
    ),
  ];

  if (saved.length > 0) {
    revalidatePath("/");
    revalidatePath("/scoreboard");
    revalidatePath("/games");
    for (const s of saved) revalidatePath(`/games/${s.game}`);
  }

  return {
    ok: saved.length > 0,
    saved,
    problems,
    message:
      saved.length === 0 && problems.length === 0
        ? "Couldn't find a game score in that. Paste the share text straight from the game."
        : undefined,
  };
}
