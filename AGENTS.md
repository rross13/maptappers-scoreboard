# Maptappers Scoreboard — working notes

Internal leaderboard for seven people at Halda who post daily puzzle scores in a
Slack group DM. You paste a game's share text, the app identifies the game,
extracts the score and puzzle date, and ranks everyone on a normalized
cross-game board.

Five games: MapTap, Krillion, Size It Up, Globle, Fermi (plus Krillion ∞, which
is stored but never scored).

This file covers the invariants and the traps. `README.md` covers setup.

## Map

```
src/lib/parser/       share-text parser — pure, synchronous, no I/O, isomorphic
  normalize.ts        Slack de-linkify, entity decode, emoji → shortcode
  blocks.ts           anchor-based segmentation
  dates.ts            civil-date maths, puzzle epochs, year inference
  registry.ts         GAME_REGISTRY — the list every pass iterates
  games/*.ts          one file per game
  __fixtures__/*.txt  real pastes, exact bytes
src/lib/scoring/      z.ts (per-slot z) · aggregate.ts (standings)
src/lib/games/config.ts   direction, transform, bounds, accent — the config code branches on
src/lib/queries.ts    DB reads + saveEntry (carries `server-only`)
src/lib/standings.ts  range/metric parsing, slot building (carries `server-only`)
src/db/schema.ts      Drizzle schema
src/app/              App Router; server components except SubmitPanel + toggles
scripts/              seed · backfill · verify-scoring · build-history.py
```

## Invariants — breaking these breaks correctness silently

**Positive z always means "beat the group."** `GAMES[g].direction` is −1 for
Globle and Fermi, applied inside `scoreSlot`. Every UI surface assumes it. Never
re-invert at a call site.

**Normalization is line-count preserving.** Every transform in `normalize.ts`
works within a line; nothing adds or removes a newline. Line `i` before equals
line `i` after, which is what lets an issue quote the user's original text. If
you add a transform that changes line count, `ParseIssue.line` starts lying.

**De-linkify before decoding entities.** Slack escapes a literal `<` as `&lt;`.
Decoding first manufactures links out of ordinary text. There's a test for this.

**The server always re-parses.** `SubmitPanel` runs the same parser in the
browser for live preview, but `submitScore` parses the raw text again. The
preview is UX, never the trust boundary.

**Anchors carry `m`, never `g`.** The block splitter clones them; a `g` regex
carries `lastIndex` between calls and matches non-deterministically.
`registry.test.ts` asserts this.

## Parser

Blocks are split by **anchor line**, not blank lines. Krillion puts a blank line
*inside* its own block, and games pasted back to back have no separator — a
blank-line splitter both over- and under-splits. So each game's signature-line
regex both identifies the game and marks where its block starts; a block runs
from its anchor to the next one, capped by `maxBlockLines`.

An anchor alone never produces an entry — `parse` must also find a score. If it
doesn't and the anchor had prose in front of it (`anchorHasPrefix`), the block is
released as *unrecognized* rather than reported as an error. That's what keeps
"gonna crush Krillion #66 tomorrow" from becoming a row.

Results are three buckets — `entries`, `failures`, `unrecognized` — so a paste
with four good games and one broken block saves the four. Never all-or-nothing.
Parsers must not throw; `parsePaste` wraps each in try/catch.

Canonical internal form is Slack shortcodes, not Unicode: ASCII, no surrogate
pairs or VS16 ambiguity to write regexes against. `emoji.ts` is deliberately
*not* exhaustive for MapTap's round markers — that set varies with score bands
and is open-ended, so MapTap's regex matches any pictographic cluster instead.

### Adding a sixth game

One file in `games/`, one line in `registry.ts`, one entry in
`lib/games/config.ts`, fixtures in `__fixtures__/`. Then check
`registry.test.ts` — its cross-contamination matrix asserts each fixture matches
exactly one game's anchors, which is what stops a new anchor stealing another
game's blocks. Adding a slug also changes the generated `pgEnum`, so run
`npm run db:generate`.

## Scoring

Per `(game, puzzle_date)` slot:

```
z = direction × (transform(score) − mean) / sample_stdev     (n−1 stdev)
```

Three degenerate cases, all deliberate and all tested:

| Case | Behaviour | Why |
|---|---|---|
| `n = 1` | `z = null`, slot excluded | No group to compare against. A free 0 would be farmable by playing alone. |
| `stdev = 0` | `z = 0` for everyone | A tie is a real outcome that still counts as participation. The idiomatic `NULLIF(stddev, 0)` returns NULL here and silently drops those players. |
| `n = 2` | `z` is always exactly ±0.7071 | Inherent to n=2, independent of margin. Tested so nobody "fixes" it. |

**Fermi is log10-transformed; nothing else is.** Its range is 1.25× to 349×. On
a raw scale one outlier compresses every real performance into an
indistinguishable clump — measured on real data, a clustered day spreads 0.192
logged vs 0.0058 linear, a 33× gain. MapTap and Size It Up are bounded and mildly
*left*-skewed, so a log would be wrong-signed there.

Ranking is **average z behind a participation floor** (`N ≥ 0.5 × eligible
slots`). Sum rewards turnout over skill; an ungated average is cherry-pickable.
`PARTICIPATION_FLOOR` is the only arbitrary constant in the system; `?metric=adj`
exposes a shrinkage estimator as the non-arbitrary alternative.

Computed **on read, in TypeScript** — the dataset is a few hundred KB, and the
math (a transform, a sign flip, three branches) is far easier to test here than
as a window-function CTE.

Property tests assert `Σz = 0` and `Σz² = n−1`. Their tolerance is scaled by the
condition number `|μ|/σ`, not fixed: float64 loses precision in the subtraction
proportional to that ratio, and an unrestricted generator finds pairs separated
by less than one ulp where the identity degenerates. That's a floating-point
limit, not a bug — don't "fix" it by loosening to a constant epsilon.

## Dates

| Game | Source |
|---|---|
| Globle | explicit in the text |
| MapTap | month + day, no year — nearest-distance year inference |
| Krillion, Fermi | puzzle number vs. a verified epoch |
| Size It Up | **nothing at all** — sibling inference, then submission day |

`PUZZLE_EPOCHS` holds **two** anchors per game and `assertEpochsConsistent()`
cross-checks them, so a typo fails a test instead of shifting every historical
date. Verified against every post in the Slack history: Krillion across 9 points,
Fermi across 4.

`puzzle_number` is persisted alongside `puzzle_date` specifically so a
renumbering is a one-constant fix plus a recompute, not lost data.

All arithmetic goes through UTC-noon `Date` objects. A local-midnight `Date`
lands on DST boundaries and produces off-by-one dates twice a year.

Scoreboard timezone is `America/Denver` (`SCOREBOARD_TZ`).

## Schema

- **One `double precision` raw_score for every game.** Ints under 2^53 are exact,
  Fermi needs float, one column keeps `avg`/`stddev_samp` uniform. Not `numeric` —
  Drizzle returns that as a *string*, forcing parse-on-read everywhere.
- **Per-round subscores in JSONB.** Always read with the parent row, never queried
  across rows.
- **`source_text` is NOT NULL.** The highest-value bytes here: a parser bug found
  later becomes a replay, not a re-import.
- **Unique on `(player_id, game, puzzle_date)`.** Keyed on date, not puzzle number
  — only some games print one, and a shared date is what makes the daily z
  meaningful.
- **Duplicate submit = upsert**, old row copied to `score_revisions` first.
  Rejecting would leave a manual DB edit as the only remedy, which nobody does.
- **`players.email` is the join key** across seed data, the Slack backfill, and any
  future SSO. A CHECK constraint enforces lowercase, since the uniqueness index is
  on the raw column.

## Identity

No auth in V1. You pick your name; it's remembered in `localStorage` via
`lib/player-store.ts`, read with `useSyncExternalStore` (server snapshot `""`,
client snapshot from storage). Don't refactor that back into a `useEffect` +
`setState` — it lints as a cascading render and reintroduces the hydration
mismatch.

`playerId` comes from the client, so **there is no server-side identity**. Anyone
can submit as anyone; "only overwrite your own row" is social. The visible
"edited ×N" marker is the whole anti-cheat. Adding SSO later means adding
`src/auth.ts` and reading `playerId` from the session instead of the form — no
migration.

Every `localStorage` access is wrapped in try/catch; it throws in private windows
and with site data blocked, and the picker must still render.

## Brand and visual rules

Halda brand: near-black `#0D0D0D`, Plus Jakarta Sans from
`assets.halda.ai/brand/fonts.css`, generously rounded corners, **no shadows**
(`--shadow-*: initial` deletes the utilities), no gradients, wordmark as an
image asset only — never typeset "Halda".

The nav uses a supplied **Halda Maptappers** lockup, `public/halda-maptappers.png`.
It arrived as white glyphs on a black band inside a white page; the checked-in
copy is cropped to the glyphs with the luminance moved into the alpha channel, so
it composites on any dark surface without a visible box. Re-cropping it from the
original means redoing that — a plain `-transparent black` leaves grey fringes.
Note this is a *modified* wordmark, which the corporate brand rules would not
allow on outward-facing work.

**One accent per page**, enforced structurally: the page root sets `data-accent`
and components only reference `bg-accent`/`border-accent`, so no component can
reach a second hex. `DarkCard` and `AccentCard` encode the text rule — white text
only on near-black, black text on every accent.

Two findings worth not rediscovering:

**The four brand accents fail a categorical colorblind check as a set.** Blue and
purple sit at ΔE 12.3 in *normal* vision (floor is 15) and 6.3 under deutan —
verified with the `dataviz` skill's validator, not by eye. The hexes are fixed by
the brand, so game identity is **never carried by colour alone**: every pill spells
the game out in full, column order is fixed, and no chart maps games to
colours. Sparklines are single-series for this reason. Don't add a multi-series
chart coloured by game.

**Never name a theme colour token the same as a size token.** `--color-body` and
`--text-body` both generate a `.text-body` utility in Tailwind v4 and colour wins
— which rendered `#333` body text on `#111` cards at ~1.4:1 contrast across the
whole app. The colour token is now `--color-on-light`.

Fermi's page is monochrome: four accents can't cover five games, and it's already
the odd one out (log scale, float multiplier), so that reads as intent.

## Known gaps

- **MapTap's score formula is unknown.** `99+80+93+80+89 = 441` but the share says
  `872`, and the gap widens as rounds drop. No relation fits across 8 samples.
  `Final score:` is authoritative and rounds are never cross-validated. Size It
  Up's newer layout *does* sum correctly and is checked.
- **Size It Up prints no date.** Sibling inference is the real mitigation; the UI
  marks assumed dates as editable.
- **Typed Globle scores** are matched at low confidence and never auto-saved —
  `Globle #20` is a puzzle number and looks identical. Phrasings where the number
  precedes the keyword ("7 on Globle") or no game is named ("I got it in 10") are
  deliberately not guessed at; the backfill reports them as near-misses instead.
- `data/slack-history.json` (gitignored) has scores, dates, authors and puzzle
  numbers transcribed exactly, but regenerated tile art. Safe where art carries no
  score information; Globle tile *counts* are exact because they're cross-checked
  against the guess count.

## Testing

`npm test` — 86 unit + integration. Integration tests need a database whose name
ends in `_test`; `test/setup-db.ts` refuses otherwise, so they can't touch dev
data. `server-only` is aliased to a stub under Vitest.

`npm run test:e2e` — Playwright, against a running dev server. It writes a real
row dated 2026-09-01 (outside the backfill) — delete it afterwards.

`npx tsx --env-file=.env.local scripts/verify-scoring.ts` prints z-scores for
known slots to cross-check against a hand computation.

Scoring changes need the degenerate cases above re-tested. Parser changes need a
fixture, not an inline string literal — fixtures are real `.txt` so trailing
whitespace, CRLF and raw emoji survive.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
