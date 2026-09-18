import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, scoreRevisions, scores } from "@/db/schema";
import { GAMES, type GameSlug } from "@/lib/games/config";
import type { ParsedEntry } from "@/lib/parser";
import { PARSER_VERSION } from "@/lib/parser";

export async function getPlayers() {
  return db
    .select()
    .from(players)
    .where(eq(players.isActive, true))
    .orderBy(asc(players.displayName));
}

export async function getPlayerByHandle(handle: string) {
  const [p] = await db.select().from(players).where(eq(players.handle, handle));
  return p ?? null;
}

export interface ScoreRow {
  id: string;
  playerId: string;
  game: GameSlug;
  puzzleDate: string;
  rawScore: number;
  rounds: number[] | null;
  puzzleNumber: number | null;
  revisionCount: number;
}

/** All daily-game scores in a date window, with a revision count per row. */
export async function getScores(
  from?: string,
  to?: string,
): Promise<ScoreRow[]> {
  const dailySlugs = (Object.keys(GAMES) as GameSlug[]).filter(
    (g) => GAMES[g].isDaily,
  );

  const conditions = [inArray(scores.game, dailySlugs)];
  if (from) conditions.push(gte(scores.puzzleDate, from));
  if (to) conditions.push(lte(scores.puzzleDate, to));

  const rows = await db
    .select({
      id: scores.id,
      playerId: scores.playerId,
      game: scores.game,
      puzzleDate: scores.puzzleDate,
      rawScore: scores.rawScore,
      rounds: scores.rounds,
      puzzleNumber: scores.puzzleNumber,
      revisionCount: sql<number>`(
        select count(*)::int from ${scoreRevisions}
        where ${scoreRevisions.scoreId} = ${scores.id}
      )`,
    })
    .from(scores)
    .where(and(...conditions))
    .orderBy(desc(scores.puzzleDate));

  return rows as ScoreRow[];
}

export interface SaveResult {
  game: GameSlug;
  displayName: string;
  score: number;
  puzzleDate: string;
  replaced: number | null;
}

/**
 * Writes one parsed entry, overwriting any existing score for that
 * (player, game, date) and preserving the old value in score_revisions.
 *
 * Overwrite rather than reject: a mis-pasted score's only other remedy is a
 * manual database edit, which nobody will do. The revision log is what keeps
 * that from being a silent way to improve yesterday.
 */
export async function saveEntry(
  playerId: string,
  entry: ParsedEntry,
  source: "web" | "slack_backfill" | "manual_admin" = "web",
): Promise<SaveResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(scores)
      .where(
        and(
          eq(scores.playerId, playerId),
          eq(scores.game, entry.game),
          eq(scores.puzzleDate, entry.puzzleDate),
        ),
      );

    if (existing) {
      await tx.insert(scoreRevisions).values({
        scoreId: existing.id,
        rawScore: existing.rawScore,
        rounds: existing.rounds,
        meta: existing.meta,
        sourceText: existing.sourceText,
        parserVersion: existing.parserVersion,
      });
      await tx
        .update(scores)
        .set({
          rawScore: entry.score,
          rounds: entry.detail && "rounds" in entry.detail ? entry.detail.rounds : null,
          meta: entry.detail as Record<string, unknown> | undefined,
          puzzleNumber: entry.puzzleNumber ?? null,
          sourceText: entry.sourceText,
          source,
          parserVersion: PARSER_VERSION,
          updatedAt: new Date(),
        })
        .where(eq(scores.id, existing.id));

      return {
        game: entry.game,
        displayName: entry.displayName,
        score: entry.score,
        puzzleDate: entry.puzzleDate,
        replaced: existing.rawScore,
      };
    }

    await tx.insert(scores).values({
      playerId,
      game: entry.game,
      puzzleDate: entry.puzzleDate,
      puzzleNumber: entry.puzzleNumber ?? null,
      rawScore: entry.score,
      rounds: entry.detail && "rounds" in entry.detail ? entry.detail.rounds : null,
      meta: entry.detail as Record<string, unknown> | undefined,
      sourceText: entry.sourceText,
      source,
      parserVersion: PARSER_VERSION,
    });

    return {
      game: entry.game,
      displayName: entry.displayName,
      score: entry.score,
      puzzleDate: entry.puzzleDate,
      replaced: null,
    };
  });
}
