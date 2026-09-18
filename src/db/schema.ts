import {
  pgTable,
  pgEnum,
  check,
  uuid,
  text,
  integer,
  doublePrecision,
  date,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { GAME_SLUGS } from "@/lib/games/config";

export const gameEnum = pgEnum("game_slug", GAME_SLUGS);
export const sourceEnum = pgEnum("score_source", [
  "web",
  "slack_backfill",
  "manual_admin",
]);

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always stored lowercased. The stable join key across seed data, the Slack
     *  backfill, and any future SSO — never a provider-specific subject id. */
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    /** URL slug: 'riley', 'zach'. */
    handle: text("handle").notNull(),
    slackUserId: text("slack_user_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("players_email_uniq").on(t.email),
    uniqueIndex("players_handle_uniq").on(t.handle),
    uniqueIndex("players_slack_uniq").on(t.slackUserId),
    // Uniqueness is on the raw column, so the lowercase invariant that makes it
    // case-insensitive has to be enforced rather than assumed.
    check("players_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    game: gameEnum("game").notNull(),
    /** Civil date in America/Denver, 'YYYY-MM-DD'. */
    puzzleDate: date("puzzle_date", { mode: "string" }).notNull(),
    /** Retained even though puzzleDate is the key: the Krillion and Fermi date
     *  anchors rest on a narrow observation window, so if a game ever renumbers
     *  this is what makes the fix a recompute instead of lost data. */
    puzzleNumber: integer("puzzle_number"),

    /** Exactly as printed by the game. Float because Fermi is a multiplier;
     *  integers below 2^53 round-trip exactly, and one column keeps avg/stddev
     *  uniform across games. */
    rawScore: doublePrecision("raw_score").notNull(),
    /** MapTap and Size It Up per-round subscores. Always read with the parent
     *  row and never queried across rows, so JSONB beats a join. */
    rounds: jsonb("rounds").$type<number[]>(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),

    /** Verbatim paste. Lets a parser bug found later become a replay rather
     *  than a re-import. */
    sourceText: text("source_text").notNull(),
    source: sourceEnum("source").notNull().default("web"),
    parserVersion: integer("parser_version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("scores_player_game_date_uniq").on(
      t.playerId,
      t.game,
      t.puzzleDate,
    ),
    index("scores_game_date_idx").on(t.game, t.puzzleDate),
    index("scores_player_date_idx").on(t.playerId, t.puzzleDate),
  ],
);

/** Append-only. Written before any overwrite of a scores row; a non-zero count
 *  surfaces as an "edited" marker in the UI, which is the whole anti-cheat. */
export const scoreRevisions = pgTable(
  "score_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scoreId: uuid("score_id")
      .notNull()
      .references(() => scores.id, { onDelete: "cascade" }),
    rawScore: doublePrecision("raw_score").notNull(),
    rounds: jsonb("rounds").$type<number[]>(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    sourceText: text("source_text").notNull(),
    parserVersion: integer("parser_version").notNull(),
    replacedAt: timestamp("replaced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("score_revisions_score_idx").on(t.scoreId)],
);

/** Triage surface for anything the backfill could not parse or that parsed with
 *  low confidence. Reviewed by hand, then promoted or discarded. */
export const unparsedPastes = pgTable("unparsed_pastes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceText: text("source_text").notNull(),
  slackUserId: text("slack_user_id"),
  slackTs: text("slack_ts"),
  reason: text("reason").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Player = typeof players.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
