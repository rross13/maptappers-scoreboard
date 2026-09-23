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
src/app/              App Router; server components except SubmitModal/Panel + toggles
  admin/              unlisted roster editor — plain form posts, no client JS
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

**Never count with a correlated subquery in a `sql` template.** Drizzle renders
the columns inside one *unqualified*, so
``sql`(select count(*) from ${scoreRevisions} where ${scoreRevisions.scoreId} = ${scores.id})` ``
becomes `where "score_id" = "id"` — two columns of the inner table, compared to
each other. It never errors; every row just counts 0, which is exactly what
`revisionCount` did until it was caught. Use a `leftJoin` + `groupBy` on the
primary key, and assert a real number in a test. `persistence.test.ts` covers
both counts.

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
- **`source_text` is NOT NULL, but it is not the paste.** It holds one game's
  block *after* normalization (shortcodes, links stripped): enough to re-run a
  game parser, not to replay a bug in `normalize.ts` or block splitting.
- **`raw_paste` is the paste**, byte for byte, including the other games and the
  chatter around them. It's the highest-value column here, because it turns any
  parser bug into a replay. It's nullable, and null for every row saved before it
  existed and for the backfill. `score_revisions` copies it on replace.
- **Emoji art shows only when `raw_paste` is present.** `build-history.py`
  *regenerated* the backfill's tile art (Krillion alternates fish/bubbles, every
  MapTap round is `:dart:`), so for those rows the hover breakdown
  (`lib/games/breakdown.ts`) shows only the numbers, and Krillion shows nothing.
  Globle never has one: its guess count is the score and the tiles add nothing.
  `getScores` turns the column into an `artVerified` boolean so the paste
  never reaches a page.
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

`/` is the day's board, and submitting happens in a dialog behind its
"Play & Submit" button. `SubmitModal` uses the native `<dialog>`, so focus
trapping, Esc-to-close and inerting the page come from the platform — don't
replace it with a div and hand-rolled key handlers. It deliberately stays open
after a save, because the result list is the only confirmation of what was
stored; the board behind it has already revalidated.

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

## Submit flow

One tab per daily game, one save per tab. Submitting advances to the next game
with nothing logged *this session*, so playing all five and pasting as you go is
a straight walk; clicking a tab directly covers "I only came to fix Globle".

`submitScore` takes an `onlyGame` argument and the tab supplies it, so scoping
happens on the server. Pasting a whole Slack message on the Globle tab saves the
Globle line and nothing else — the client's parse is still only a preview.
Calling it without `onlyGame` keeps the old save-everything behaviour, which the
backfill wants.

A game already scored for **today** opens locked: the box is disabled and the
stored value sits where the parsed preview would, so the modal shows one fact in
one place either way. "Replace it" unlocks it — the schema keeps the old value in
`score_revisions`, and a mis-pasted score whose only remedy is a manual DB edit
is a score nobody ever fixes. The lock is date-scoped on purpose: pasting
yesterday's Globle must not block today's, so a save made in this session only
locks its tab when its `puzzleDate` matches the server-computed `today`.

A paste that names a different game is neither saved nor silently dropped: the
panel says what it read and offers that game's tab, and switching that way is the
one case that carries the text across (an ordinary tab click clears the box,
because each tab is its own submission).

The tab strip is built from game pills, each carrying its own `data-accent`.
That is the sanctioned pill exception to one-accent-per-page — everything else in
the dialog (Submit, the switch buttons) stays on the page accent.

The same strip appears on `/games/[slug]`, where the tabs are links to the other
games rather than buttons. Both render `gameTabClass()` from `brand.tsx`; the
mechanics differ, the look must not, so change the classes there and nowhere
else.

`GAMES[g].url` is the "Play X" link. All but Krillion's are lifted from the URL
the game's own share text carries; Krillion's share text has none in any observed
post, so that one came from Riley by hand. Don't guess one — a wrong link sends
the team to a parked domain, and `config.test.ts` can only check the shape, not
the destination.

## Admin

`/admin` edits the roster: add, rename, deactivate, delete. It is linked from
nowhere and carries `robots: noindex`, and that is the whole of its protection —
the app has no auth, so anyone who knows the path can use it. Say so out loud
rather than letting the missing link read as security.

The page is a server component with plain `<form action={serverAction}>` posts
and no client JS; results come back as `?ok=` / `?error=` on the redirect. Unique
violations (23505) are translated into which field collided.

**Delete is blocked for anyone holding scores**, because `scores.player_id`
cascades — deleting would take the history with it and quietly move every other
player's z-scores for those days. Deactivating is the real remove: `getPlayers()`
already filters on `is_active`, so it drops them from the roster, the board and
the name picker while the history stays. The check is enforced in the action, not
just by the disabled button.

## Known gaps

- **MapTap's score formula is unknown.** `99+80+93+80+89 = 441` but the share says
  `872`, and the gap widens as rounds drop. No relation fits across 8 samples.
  `Final score:` is authoritative and rounds are never cross-validated. Size It
  Up's newer layout *does* sum correctly and is checked.
- **Rows from before `raw_paste` show numbers only** in the hover, even real web
  submissions whose art was genuine. Size It Up rows from before `grid` was
  captured in `meta` fall back to row scores.
- **Size It Up prints no date.** Sibling inference is the real mitigation; the UI
  marks assumed dates as editable.
- **Krillion ∞ can no longer be submitted through the UI.** The tabs cover the
  five daily games only, and `onlyGame` scoping means a ∞ paste matches no tab.
  The parser still reads it and the panel names it explicitly rather than
  dropping it silently. Re-enabling it means a sixth tab or a separate route.
- **Typed Globle scores** are matched at low confidence and never auto-saved —
  `Globle #20` is a puzzle number and looks identical. Phrasings where the number
  precedes the keyword ("7 on Globle") or no game is named ("I got it in 10") are
  deliberately not guessed at; the backfill reports them as near-misses instead.
- `data/slack-history.json` (gitignored) has scores, dates, authors and puzzle
  numbers transcribed exactly, but regenerated tile art. Safe where art carries no
  score information; Globle tile *counts* are exact because they're cross-checked
  against the guess count.

## Testing

`npm test` — unit + integration. Integration tests need a database whose name
ends in `_test`; `test/setup-db.ts` refuses otherwise, so they can't touch dev
data. `server-only` is aliased to a stub under Vitest.

`npm run test:e2e` — Playwright, against a running dev server. It writes a real
row dated 2026-09-01 (outside the backfill) — delete it afterwards.

`npx tsx --env-file=.env.local scripts/verify-scoring.ts` prints z-scores for
known slots to cross-check against a hand computation.

Scoring changes need the degenerate cases above re-tested. Parser changes need a
fixture, not an inline string literal — fixtures are real `.txt` so trailing
whitespace, CRLF and raw emoji survive.

## Deploying

Vercel watches the repo: **a push to `main` deploys production**, any other
branch gets a preview URL. Neon holds the production database (`neondb`, PG
18.6); the local Homebrew `maptappers` is separate and nothing syncs between
them.

**`next build` does not run migrations.** The build script is plain `next
build`, so nothing in the deploy pipeline touches Neon's schema. Applying one is
a manual step you run from a laptop:

```
npm run db:generate      # schema.ts → drizzle/NNNN_*.sql
npm run db:migrate       # local, then npm test
npm run db:migrate:prod  # Neon
```

**Order the migration against the deploy by which direction is safe.** Additive
changes (new table, new nullable column) go to Neon *first* — old code ignores
what it doesn't reference. Destructive ones (drop, rename, tighten a constraint)
go *after* the deploy that stops using the column. Getting it backwards leaves a
window where production queries something that isn't there.

`db:migrate:prod` reads `.env.neon` (gitignored by `.env*`) through Node's
`--env-file`, **not** through `drizzle.config.ts`'s dotenv call. That is the
point: dotenv loads `.env.local` and won't override an already-set variable, so
a prod script that failed to find its own env file would quietly migrate the dev
database instead. `--env-file` exits 9 on a missing file, so it fails loudly.

**Never run `db:push` against Neon.** It diffs the schema against the live
database and will drop a column to make them agree. Local dev only.

Commit `drizzle/*.sql` — it is the record of what has been applied, and
`drizzle.__drizzle_migrations` on Neon is what makes a re-run a no-op.

**Preview deploys share the production database.** `DATABASE_URL` is set on all
three Vercel scopes, so a preview URL writes real scores and a preview of a
branch with an unapplied migration 500s. The fix is a Neon branch (copy-on-write,
instant) with its string overriding `DATABASE_URL` on the Preview scope only.

Vercel's Instant Rollback restores **code, not schema**. A rolled-back deploy
still faces whatever migration shipped with it — another reason to keep
migrations additive and separate from the code that uses them.

### psql against Neon needs an SSL override

`~/.postgresql/root.crt` on Riley's machine is an Amazon RDS bundle from an
unrelated project. libpq treats that path as the default root CA and documents
that its presence silently upgrades `sslmode=require` to `verify-ca`, so psql
and pg_dump reject Neon's Let's Encrypt chain with `certificate verify failed`.
Append `sslmode=verify-full&sslrootcert=system` to point libpq at the OS trust
store — `require` alone is refused alongside `sslrootcert=system`. Deleting
root.crt would fix it too and break the RDS project.

The app is unaffected: postgres.js is pure Node and never reads that file.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
