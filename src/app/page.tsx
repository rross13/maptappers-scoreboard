import { SubmitPanel } from "@/components/SubmitPanel";
import { DarkCard, GamePill, SectionTitle } from "@/components/brand";
import { DAILY_GAMES } from "@/lib/games/config";
import { getPlayers, getScores } from "@/lib/queries";
import { civilDateIn, SCOREBOARD_TZ } from "@/lib/parser/dates";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const today = civilDateIn(new Date(), SCOREBOARD_TZ);
  const [roster, todayScores] = await Promise.all([
    getPlayers(),
    getScores(today, today),
  ]);

  const filled = new Set(todayScores.map((s) => `${s.playerId}|${s.game}`));

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-title font-extrabold mb-2">Submit a score</h1>
        <p className="text-body text-muted mb-6">
          Paste the share text from any game. Several at once is fine.
        </p>
        <SubmitPanel
          roster={roster.map((p) => ({ id: p.id, displayName: p.displayName }))}
        />
      </section>

      <section>
        <SectionTitle>Today &middot; {today}</SectionTitle>
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
                  <td className="p-4 whitespace-nowrap">{p.displayName}</td>
                  {DAILY_GAMES.map((g) => {
                    const row = todayScores.find(
                      (s) => s.playerId === p.id && s.game === g.slug,
                    );
                    return (
                      <td key={g.slug} className="p-4 text-center tabular-nums">
                        {row ? (
                          <span>{formatScore(row.rawScore, g.precision)}</span>
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

function formatScore(v: number, precision: number): string {
  return v.toFixed(precision);
}
