import type { ReactNode } from "react";
import Link from "next/link";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { SortHeader } from "@/components/SortHeader";
import { SubmitModal } from "@/components/SubmitModal";
import { DarkCard, GamePill, StreakBadge } from "@/components/brand";
import { DAY_DEFAULT_SORT, dayColumns } from "@/lib/board";
import { breakdownFor } from "@/lib/games/breakdown";
import { DAILY_GAMES, formatScore, type GameSlug } from "@/lib/games/config";
import { getPlayers, getScores } from "@/lib/queries";
import { addDays, civilDateIn, parseCivil, SCOREBOARD_TZ } from "@/lib/parser/dates";
import { parseSort, sortRows } from "@/lib/sort";
import { getStreaks } from "@/lib/standings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = civilDateIn(new Date(), SCOREBOARD_TZ);
  // A future or malformed date shows today rather than an empty board.
  const requested = parseCivil(one(sp.date));
  const date = requested && requested < today ? requested : today;
  const isToday = date === today;

  const [roster, dayScores, todayScores, streakDays] = await Promise.all([
    getPlayers(),
    getScores(date, date),
    isToday ? null : getScores(today, today),
    getStreaks(),
  ]);

  const columns = dayColumns<(typeof rows)[number]>();
  const sort = parseSort(one(sp.sort), columns.map((c) => c.key), DAY_DEFAULT_SORT);
  const href = (params: { date?: string; sort?: string }) => {
    const q = new URLSearchParams();
    const d = params.date ?? date;
    const s = params.sort ?? one(sp.sort);
    if (d !== today) q.set("date", d);
    if (s && s !== DAY_DEFAULT_SORT) q.set("sort", s);
    const qs = q.toString();
    return qs ? `/?${qs}` : "/";
  };

  const rows = roster.map((p) => {
    const mine = dayScores.filter((s) => s.playerId === p.id);
    return {
      player: p,
      name: p.displayName,
      streak: streakDays.get(p.id),
      byGame: new Map(mine.map((s) => [s.game, s])),
      scores: Object.fromEntries(mine.map((s) => [s.game, s.rawScore])),
    };
  });
  const sorted = sortRows(rows, columns.find((c) => c.key === sort.key)!, sort);

  // What each player has already logged today, which is what locks a tab in the
  // submit dialog. Seven players times five games — small enough to hand over
  // whole rather than fetch per selection.
  const already: Record<
    string,
    Partial<Record<GameSlug, { score: number; puzzleDate: string; revisions: number }>>
  > = {};
  for (const row of todayScores ?? dayScores) {
    (already[row.playerId] ??= {})[row.game] = {
      score: row.rawScore,
      puzzleDate: row.puzzleDate,
      revisions: row.revisionCount,
    };
  }

  return (
    <div className="space-y-12">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-title font-extrabold">
              {isToday ? "Today" : weekday(date)} &middot;{" "}
              <span className="whitespace-nowrap">{date}</span>
            </h1>
            <nav aria-label="Day" className="flex items-center gap-2">
              <DayLink href={href({ date: addDays(date, -1) })} label="Previous day">
                &larr;
              </DayLink>
              {isToday ? (
                <span
                  aria-hidden="true"
                  className="rounded-pill bg-surface-raised text-muted text-label px-3.5 py-1.5 opacity-40"
                >
                  &rarr;
                </span>
              ) : (
                <>
                  <DayLink href={href({ date: addDays(date, 1) })} label="Next day">
                    &rarr;
                  </DayLink>
                  <Link
                    href={href({ date: today })}
                    className="rounded-pill bg-surface-raised text-muted text-label px-3.5 py-1.5 hover:text-paper"
                  >
                    Today
                  </Link>
                </>
              )}
            </nav>
          </div>
          <SubmitModal
            roster={roster.map((p) => ({ id: p.id, displayName: p.displayName }))}
            existing={already}
            today={today}
          />
        </div>
        <DarkCard className="overflow-x-auto p-0">
          <table className="w-full text-body border-collapse">
            <thead>
              <tr className="text-label text-muted">
                <SortHeader
                  column={columns[0]}
                  state={sort}
                  href={(s) => href({ sort: s })}
                >
                  Player
                </SortHeader>
                <SortHeader
                  column={columns[1]}
                  state={sort}
                  href={(s) => href({ sort: s })}
                  align="center"
                >
                  Streak
                </SortHeader>
                {DAILY_GAMES.map((g) => (
                  <SortHeader
                    key={g.slug}
                    column={columns.find((c) => c.key === g.slug)!}
                    state={sort}
                    href={(s) => href({ sort: s })}
                    align="center"
                  >
                    <GamePill game={g.slug} />
                  </SortHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ player: p, streak, byGame }) => (
                <tr key={p.id} className="border-t border-surface-raised">
                  <td className="p-4 whitespace-nowrap">{p.displayName}</td>
                  <td className="p-4 text-center">
                    <StreakBadge days={streak} />
                  </td>
                  {DAILY_GAMES.map((g) => {
                    const row = byGame.get(g.slug);
                    return (
                      <td key={g.slug} className="p-4 text-center tabular-nums">
                        {row ? (
                          <ScoreBreakdown
                            lines={breakdownFor(row.detail, row.artVerified)?.lines ?? null}
                          >
                            {formatScore(g.slug, row.rawScore)}
                          </ScoreBreakdown>
                        ) : (
                          <span className="text-muted">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </DarkCard>
        {dayScores.length === 0 && (
          <p className="text-label text-muted mt-3">
            {isToday ? "Nobody has posted yet today." : "Nobody posted on this day."}
          </p>
        )}
      </section>
    </div>
  );
}


function DayLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      scroll={false}
      className="rounded-pill bg-surface-raised text-muted text-label px-3.5 py-1.5 hover:text-paper"
    >
      {children}
    </Link>
  );
}

function weekday(date: string): string {
  // Noon UTC, so the civil date can't slip a day in any timezone.
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}
