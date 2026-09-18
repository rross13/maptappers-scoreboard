# Maptappers Scoreboard

Daily puzzle scores for the Real Maptappers. Paste the share text from any game,
the app works out which game it is and what you scored, and it ranks everyone on
a normalized cross-game leaderboard.

Five games: **MapTap**, **Krillion**, **Size It Up**, **Globle**, **Fermi**.

## How the scoring works

Raw scores aren't comparable — MapTap runs 0–1000 where higher is better, Fermi is
a multiplier where *lower* is better and one bad round can produce a 266,667×.

So each `(game, day)` is scored as its own group:

```
z = direction × (transform(score) − mean) / sample_stdev
```

- `direction` is −1 for Globle and Fermi, so **positive z always means "beat the
  group"** on every game.
- `transform` is `log10` for Fermi only. On a raw scale a single huge outlier
  compresses everyone else into an indistinguishable clump; the log keeps real
  performances an order of magnitude further apart.
- **A day with one player is not scored.** There's no group to compare against,
  and awarding a free 0 would be farmable.
- **A day where everyone ties scores 0 for everyone** — a real outcome that still
  counts as participation.

Players are ranked on **average z**, gated by a participation floor (half the
eligible game-days). Sum would reward turnout over skill; an ungated average lets
someone play only their best game. `?metric=total|adj` shows the alternatives —
`adj` is a shrinkage estimator with no hard gate.

## Running it

Requires Node 22+ and Postgres 17 (`brew install postgresql@17`).

```bash
npm install
createdb maptappers
cp .env.example .env.local        # then set DATABASE_URL
npm run db:migrate
npm run db:seed                   # the seven players
npm run dev                       # http://localhost:3000
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit + integration (needs `maptappers_test`) |
| `npm run test:e2e` | Playwright smoke, against a running dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed players (idempotent) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:backfill -- --dry-run` | Report what the Slack backfill would import |
| `npm run db:backfill -- --commit` | Import it (idempotent) |

Integration tests need a scratch database whose name ends in `_test`; the setup
file refuses to run otherwise, so they can't touch dev data.

```bash
createdb maptappers_test
DATABASE_URL="postgresql://$USER@localhost:5432/maptappers_test" npx drizzle-kit push --force
```

## Deploying

Nothing here needs an external account until you deploy — there is no auth in V1.

1. **Neon** — create a project, copy the *pooled* connection string.
2. **Vercel** — import the repo, set `DATABASE_URL` to that string. The Postgres
   client already sets `prepare: false`, which transaction pooling requires.
3. Run `npm run db:migrate` and `npm run db:seed` against the Neon database once.

## Identity

V1 has **no authentication**. You pick your name from a list and it's remembered
in `localStorage`. Anyone can submit as anyone, and "only overwrite your own row"
is a social rule, not an enforced one — which is the right trade for seven
coworkers and a joke-stakes leaderboard.

Every score keeps its original pasted text, and overwriting one files the previous
value in `score_revisions`; the UI marks any score that's been edited. That visible
marker is the whole anti-cheat.

Adding Google sign-in later is a drop-in: `players.email` is already the stable
join key, so it means adding `src/auth.ts` and reading `playerId` from the session
instead of the form. No migration, no data change.

## Layout

```
src/lib/parser/     share-text parser — pure, isomorphic, runs in both browser and server
  games/            one file per game; adding a sixth is one file + one registry line
  __fixtures__/     real .txt pastes, exact bytes
src/lib/scoring/    z.ts (per-slot z) and aggregate.ts (standings)
src/lib/games/      game config: direction, transform, bounds, accent
src/db/             Drizzle schema
src/app/            App Router pages; everything is a server component except
                    the submit panel and the range toggles
scripts/            seed, backfill, scoring cross-check
```

The parser splits a paste by **anchor line**, not by blank lines: Krillion puts a
blank line inside its own block and games pasted back to back have no separator,
so a blank-line splitter both over- and under-splits. Normalization is
line-count-preserving, which is what lets an error quote your original text back.

## Things worth knowing

- **MapTap's round scores don't sum to its final score.** `99+80+93+80+89 = 441`
  but the share says `872`, and the gap widens as rounds drop. The formula is
  unknown, so `Final score:` is taken as authoritative and never cross-checked.
- **Krillion and Fermi encode their date only as a puzzle number.** The anchors
  (`Krillion #56 = 2026-09-09`, `Fermi No. 50 = 2026-09-14`) were verified against
  every post in the history. `puzzle_number` is stored alongside the date so a
  renumbering is a recompute, not lost data.
- **Size It Up prints no date at all.** It borrows the date from a confidently
  dated game in the same paste, falling back to today.
- **Typed Globle scores** ("Globle in 9") are matched but never saved without
  confirmation — `Globle #20` is a puzzle number and looks identical.
- **The brand's four accents fail a categorical colorblind check** as a set: blue
  and purple sit at ΔE 12.3 in normal vision, below the floor of 15. So game
  identity is never carried by color alone — every pill has a short code, column
  order is fixed, and no chart maps games to colors.
