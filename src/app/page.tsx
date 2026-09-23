import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { SubmitModal } from "@/components/SubmitModal";
import { DarkCard, GamePill, StreakBadge } from "@/components/brand";
import { breakdownFor } from "@/lib/games/breakdown";
import { DAILY_GAMES, formatScore, type GameSlug } from "@/lib/games/config";
import { getPlayers, getScores } from "@/lib/queries";
import { civilDateIn, SCOREBOARD_TZ } from "@/lib/parser/dates";
import { getStreaks } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const today = civilDateIn(new Date(), SCOREBOARD_TZ);
  const [roster, todayScores, streakDays] = await Promise.all([
    getPlayers(),
    getScores(today, today),
    getStreaks(),
  ]);

  const filled = new Set(todayScores.map((s) => `${s.playerId}|${s.game}`));

  // What each player has already logged today, which is what locks a tab in the
  // submit dialog. Seven players times five games — small enough to hand over
  // whole rather than fetch per selection.
  const already: Record<
    string,
    Partial<Record<GameSlug, { score: number; puzzleDate: string; revisions: number }>>
  > = {};
  for (const row of todayScores) {
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
          <h1 className="text-title font-extrabold">Today &middot; {today}</h1>
          <SubmitModal
            roster={roster.map((p) => ({ id: p.id, displayName: p.displayName }))}
            existing={already}
            today={today}
          />
        </div>
        <DarkCard className="overflow-x-auto p-0">
          <table className="w-full text-body border-collapse">
            <thead>
              <tr>
                <th className="text-left text-label text-muted font-bold p-4">
                  Player
                </th>
                {DAILY_GAMES.map((g) => (
                  <th key={g.slug} className="p-4 text-center">
                    <GamePill game={g.slug} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id} className="border-t border-surface-raised">
                  <td className="p-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {p.displayName}
                      <StreakBadge days={streakDays.get(p.id)} />
                    </span>
                  </td>
                  {DAILY_GAMES.map((g) => {
                    const row = todayScores.find(
                      (s) => s.playerId === p.id && s.game === g.slug,
                    );
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
        {filled.size === 0 && (
          <p className="text-label text-muted mt-3">
            Nobody has posted yet today.
          </p>
        )}
      </section>
    </div>
  );
}

