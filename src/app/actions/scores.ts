"use server";

import { revalidatePath } from "next/cache";
import { parsePaste, SCOREBOARD_TZ } from "@/lib/parser";
import { GAMES, type GameSlug } from "@/lib/games/config";
import { getPlayers, saveEntry, type SaveResult } from "@/lib/queries";

export interface SubmitState {
  ok: boolean;
  saved: SaveResult[];
  problems: string[];
  message?: string;
}

/**
 * Persists what a paste contains for one game.
 *
 * `onlyGame` is what makes the tabbed submit flow a single-game action: the tab
 * decides which result is kept, so pasting a multi-game blob on the Globle tab
 * saves the Globle line and nothing else. Scoping happens here, not on the
 * client, because the client's parse is a preview and never the trust boundary
 * — this re-parses from the raw text regardless.
 *
 * Omitting `onlyGame` keeps the original save-everything behaviour, which the
 * backfill and any future bulk import still want.
 */
export async function submitScore(
  playerId: string,
  text: string,
  acceptLowConfidence = false,
  onlyGame?: GameSlug,
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

  const entries = onlyGame
    ? result.entries.filter((e) => e.game === onlyGame)
    : result.entries;
  const failures = onlyGame
    ? result.failures.filter((f) => f.game === onlyGame)
    : result.failures;

  // Low-confidence reads (typed Globle scores) are never saved without an
  // explicit confirmation, because "Globle #20" and "I did Globle 3 times"
  // are real shapes that look identical to a score.
  const toSave = entries.filter(
    (e) => acceptLowConfidence || e.scoreConfidence !== "low",
  );
  const heldBack = entries.filter(
    (e) => !acceptLowConfidence && e.scoreConfidence === "low",
  );

  const saved: SaveResult[] = [];
  for (const entry of toSave) {
    saved.push(await saveEntry(playerId, entry));
  }

  const problems = [
    ...failures.flatMap((f) =>
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
        ? onlyGame
          ? `Couldn't find a ${GAMES[onlyGame].name} score in that. Paste the share text straight from the game.`
          : "Couldn't find a game score in that. Paste the share text straight from the game."
        : undefined,
  };
}
