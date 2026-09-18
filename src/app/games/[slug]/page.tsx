import { notFound } from "next/navigation";
import { DarkCard, SectionTitle } from "@/components/brand";
import { Toggles } from "@/components/Toggles";
import { GAMES, isGameSlug } from "@/lib/games/config";
import { getPlayers, getScores } from "@/lib/queries";
import { buildSlots, parseRange, rangeBounds, RANGES } from "@/lib/standings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  if (!isGameSlug(slug) || !GAMES[slug].isDaily) notFound();
  const cfg = GAMES[slug];

  const sp = await searchParams;
  const range = parseRange(one(sp.range), "7d");
  const { from, to } = rangeBounds(range);

  const [roster, allRows] = await Promise.all([getPlayers(), getScores(from, to)]);
  const rows = allRows.filter((r) => r.game === slug);
  const byId = new Map(roster.map((p) => [p.id, p]));

  // z is computed from this game's slots only; the value is identical to the
  // cross-game board because every slot is scored independently.
  const slots = buildSlots(rows).filter((s) => s.game === slug);
  const zByScore = new Map<string, number>();
  const participants = new Map<string, number>();
  for (const s of slots) {
    participants.set(s.date, s.scored?.length ?? 0);
    for (const e of s.scored ?? []) {
      zByScore.set(`${e.playerId}|${s.date}`, e.z);
    }
  }

  const dates = [...new Set(rows.map((r) => r.puzzleDate))].sort().reverse();

  const perPlayer = roster
    .map((p) => {
      const mine = rows.filter((r) => r.playerId === p.id);
      if (mine.length === 0) return null;
      const zs = mine
        .map((r) => zByScore.get(`${r.playerId}|${r.puzzleDate}`))
        .filter((z): z is number => z !== undefined);
      const raws = mine.map((r) => r.rawScore);
      const best = cfg.direction === 1 ? Math.max(...raws) : Math.min(...raws);
      return {
        player: p,
        entries: mine.length,
        avgRaw: raws.reduce((a, b) => a + b, 0) / raws.length,
        best,
        avgZ: zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b.avgZ ?? -Infinity) - (a.avgZ ?? -Infinity));

  return (
    <div data-accent={cfg.accent} className="space-y-8">
      <h1 className="text-title font-extrabold">{cfg.name}</h1>

      <Toggles
        options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
        active={range}
        hrefFor={(k) => `/games/${slug}?range=${k}`}
      />

      {rows.length === 0 ? (
        <DarkCard>
          <p className="text-body text-muted">No scores in this range yet.</p>
        </DarkCard>
      ) : (
        <>
          <section>
            <SectionTitle>Standings</SectionTitle>
            <DarkCard className="overflow-x-auto p-0">
              <table className="w-full text-body border-collapse">
                <thead>
                  <tr className="text-label text-muted">
                    <th className="text-left font-bold p-4">Player</th>
                    <th className="text-right font-bold p-4">Avg z</th>
                    <th className="text-right font-bold p-4">Avg score</th>
                    <th className="text-right font-bold p-4">Best</th>
                    <th className="text-right font-bold p-4">Played</th>
                  </tr>
                </thead>
                <tbody>
                  {perPlayer.map((r) => (
                    <tr key={r.player.id} className="border-t border-surface-raised">
                      <td className="p-4 whitespace-nowrap">{r.player.displayName}</td>
                      <td className="p-4 text-right tabular-nums">
                        {r.avgZ === null ? "—" : fmtZ(r.avgZ)}
                      </td>
                      <td className="p-4 text-right tabular-nums">
                        {r.avgRaw.toFixed(cfg.precision)}
                        {cfg.suffix ?? ""}
                      </td>
                      <td className="p-4 text-right tabular-nums">
                        {r.best.toFixed(cfg.precision)}
                        {cfg.suffix ?? ""}
                      </td>
                      <td className="p-4 text-right tabular-nums">{r.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DarkCard>
          </section>

          <section>
            <SectionTitle>By day</SectionTitle>
            <div className="space-y-3">
              {dates.map((date) => {
                const n = participants.get(date) ?? 0;
                const dayRows = rows
                  .filter((r) => r.puzzleDate === date)
                  .sort((a, b) =>
                    cfg.direction === 1
                      ? b.rawScore - a.rawScore
                      : a.rawScore - b.rawScore,
                  );
                return (
                  <DarkCard key={date}>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-body font-bold">{date}</span>
                      {n < 2 && (
                        <span className="text-label text-muted">
                          not scored &mdash; only {n} player
                          {n === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayRows.map((r) => (
                        <div key={r.id} className="flex items-center gap-4 text-body">
                          <span className="min-w-36">
                            {byId.get(r.playerId)?.displayName ?? "Unknown"}
                          </span>
                          <span className="tabular-nums min-w-20">
                            {r.rawScore.toFixed(cfg.precision)}
                            {cfg.suffix ?? ""}
                          </span>
                          <span className="tabular-nums text-muted min-w-16">
                            {n >= 2
                              ? fmtZ(zByScore.get(`${r.playerId}|${date}`) ?? 0)
                              : ""}
                          </span>
                          {r.revisionCount > 0 && (
                            <span className="text-label text-muted">
                              edited &times;{r.revisionCount}
                            </span>
                          )}
                          {cfg.rounds && r.rounds && (
                            <span className="text-label text-muted tabular-nums">
                              {r.rounds.join(" · ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </DarkCard>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function fmtZ(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}
