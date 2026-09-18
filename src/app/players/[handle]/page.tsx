import { notFound } from "next/navigation";
import { DarkCard, GamePill, SectionTitle } from "@/components/brand";
import { Sparkline } from "@/components/Sparkline";
import { DAILY_GAMES } from "@/lib/games/config";
import { getPlayerByHandle, getPlayers, getScores } from "@/lib/queries";
import { buildSlots } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const player = await getPlayerByHandle(handle);
  if (!player) notFound();

  const [roster, rows] = await Promise.all([getPlayers(), getScores()]);
  const slots = buildSlots(rows);

  const mine = new Map<string, { z: number; game: string; date: string }[]>();
  for (const slot of slots) {
    for (const e of slot.scored ?? []) {
      if (e.playerId !== player.id) continue;
      const list = mine.get(slot.date) ?? [];
      list.push({ z: e.z, game: slot.game, date: slot.date });
      mine.set(slot.date, list);
    }
  }

  const dates = [...mine.keys()].sort();
  const dailyAvg = dates.map((d) => {
    const list = mine.get(d)!;
    return list.reduce((a, b) => a + b.z, 0) / list.length;
  });

  const cumulative = dailyAvg.reduce<number[]>(
    (acc, v) => [...acc, (acc.at(-1) ?? 0) + v],
    [],
  );

  const myRows = rows.filter((r) => r.playerId === player.id);
  const edited = myRows.filter((r) => r.revisionCount > 0).length;

  const best = dates.length
    ? dates[dailyAvg.indexOf(Math.max(...dailyAvg))]
    : null;
  const worst = dates.length
    ? dates[dailyAvg.indexOf(Math.min(...dailyAvg))]
    : null;

  const perGame = DAILY_GAMES.map((g) => {
    const gRows = myRows.filter((r) => r.game === g.slug);
    const zs = dates.flatMap((d) =>
      (mine.get(d) ?? []).filter((e) => e.game === g.slug).map((e) => e.z),
    );
    const raws = gRows.map((r) => r.rawScore);
    return {
      game: g,
      entries: gRows.length,
      avgZ: zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : null,
      best: raws.length
        ? g.direction === 1
          ? Math.max(...raws)
          : Math.min(...raws)
        : null,
    };
  }).filter((r) => r.entries > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title font-extrabold">{player.displayName}</h1>
        <p className="text-label text-muted mt-1">
          {myRows.length} scores &middot; {dates.length} days played
          {edited > 0 && ` · ${edited} edited`}
        </p>
      </div>

      <section>
        <SectionTitle>Cumulative z over time</SectionTitle>
        <DarkCard>
          <Sparkline
            values={cumulative}
            width={640}
            height={90}
            label={`${player.displayName} cumulative z`}
          />
          <div className="flex flex-wrap gap-6 mt-4 text-label text-muted">
            <span>
              Now{" "}
              <span className="text-paper tabular-nums">
                {cumulative.length ? fmt(cumulative.at(-1)!) : "—"}
              </span>
            </span>
            {best && (
              <span>
                Best day <span className="text-paper">{best}</span>
              </span>
            )}
            {worst && (
              <span>
                Worst day <span className="text-paper">{worst}</span>
              </span>
            )}
          </div>
        </DarkCard>
      </section>

      <section>
        <SectionTitle>By game</SectionTitle>
        {/* The table is the accessible view of the chart above: every value is
            readable as text, not only as a plotted point. */}
        <DarkCard className="overflow-x-auto p-0">
          <table className="w-full text-body border-collapse">
            <thead>
              <tr className="text-label text-muted">
                <th className="text-left font-bold p-4">Game</th>
                <th className="text-right font-bold p-4">Avg z</th>
                <th className="text-right font-bold p-4">Best</th>
                <th className="text-right font-bold p-4">Played</th>
              </tr>
            </thead>
            <tbody>
              {perGame.map((r) => (
                <tr key={r.game.slug} className="border-t border-surface-raised">
                  <td className="p-4">
                    <GamePill game={r.game.slug} />
                  </td>
                  <td className="p-4 text-right tabular-nums">
                    {r.avgZ === null ? "—" : fmt(r.avgZ)}
                  </td>
                  <td className="p-4 text-right tabular-nums">
                    {r.best === null
                      ? "—"
                      : r.best.toFixed(r.game.precision) + (r.game.suffix ?? "")}
                  </td>
                  <td className="p-4 text-right tabular-nums">{r.entries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DarkCard>
      </section>

      <section>
        <SectionTitle>Everyone</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {roster.map((p) => (
            <a
              key={p.id}
              href={`/players/${p.handle}`}
              className={
                p.id === player.id
                  ? "rounded-pill bg-accent text-ink text-label font-bold px-3.5 py-1.5"
                  : "rounded-pill bg-surface-raised text-muted text-label px-3.5 py-1.5 hover:text-paper"
              }
            >
              {p.displayName}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function fmt(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}
