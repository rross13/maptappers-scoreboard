import Link from "next/link";
import { DarkCard, GamePill, StatNumber, StreakBadge } from "@/components/brand";
import { StandingsChart } from "@/components/StandingsChart";
import { Toggles } from "@/components/Toggles";
import { DAILY_GAMES } from "@/lib/games/config";
import { metricValue, type Metric } from "@/lib/scoring/aggregate";
import {
  getStandings,
  getStreaks,
  parseMetric,
  parseRange,
  RANGES,
} from "@/lib/standings";

export const dynamic = "force-dynamic";

const METRICS: { key: Metric; label: string }[] = [
  { key: "avg", label: "Average" },
  { key: "total", label: "Total" },
  { key: "adj", label: "Adjusted" },
];

const METRIC_NAME: Record<Metric, string> = {
  avg: "average",
  total: "total",
  adj: "adjusted",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const range = parseRange(one(sp.range), "7d");
  const metric = parseMetric(one(sp.metric));
  const [{ named, eligibleSlots }, streakDays] = await Promise.all([
    getStandings(range, metric),
    getStreaks(),
  ]);

  const qualified = named.filter((s) => s.qualified);
  const unqualified = named.filter((s) => !s.qualified);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-extrabold mb-2">Scoreboard</h1>
        {/* The ranking is only trusted if the math is legible, so this stays
            visible rather than hiding in a tooltip. */}
        <p className="text-body text-muted max-w-2xl">
          Each day, your score in a game is compared against everyone else who
          played it that day. +1.0 means you were a full standard deviation
          better than the group. Fermi is compared on a log scale. Days when only
          one person played don&rsquo;t count.
        </p>
        <p className="text-body text-muted max-w-2xl mt-2">
          Total adds up your days, so it rewards playing more. Adjusted pulls a
          short record toward zero. When everyone plays most days, all three
          rank people the same way.
        </p>
      </div>

      <div className="flex flex-wrap gap-6">
        <Toggles
          options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
          active={range}
          hrefFor={(k) => `/scoreboard?range=${k}&metric=${metric}`}
        />
        <Toggles
          options={METRICS}
          active={metric}
          hrefFor={(k) => `/scoreboard?range=${range}&metric=${k}`}
        />
      </div>

      {named.length === 0 ? (
        <DarkCard>
          <p className="text-body text-muted">
            No scored days in this range yet. A game needs at least two players
            on the same day before it can be ranked.
          </p>
        </DarkCard>
      ) : (
        <>
          <DarkCard>
            <StandingsChart
              label={`Each player's ${METRIC_NAME[metric]} z, against the group at zero`}
              format={fmt}
              rows={[...qualified, ...unqualified].map((s) => ({
                id: s.playerId,
                name: s.player?.displayName ?? "Unknown",
                value: metricValue(s, metric),
                muted: !s.qualified,
                detail: `${s.entries} of ${eligibleSlots} entries${s.qualified ? "" : ", not ranked"}`,
              }))}
            />
          </DarkCard>

          <div className="space-y-3">
            {qualified.map((s, i) => (
              <Row
                key={s.playerId}
                rank={i + 1}
                s={s}
                metric={metric}
                eligible={eligibleSlots}
                streak={streakDays.get(s.playerId)}
              />
            ))}
          </div>

          {unqualified.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-surface-raised">
              <p className="text-label text-muted pt-4">
                Not ranked &mdash; fewer than half the eligible days.
              </p>
              {unqualified.map((s) => (
                <Row
                  key={s.playerId}
                  s={s}
                  metric={metric}
                  eligible={eligibleSlots}
                  streak={streakDays.get(s.playerId)}
                  muted
                />
              ))}
            </div>
          )}

          <p className="text-label text-muted">
            {eligibleSlots} scored game-days in this range.
          </p>
        </>
      )}
    </div>
  );
}

type Named = Awaited<ReturnType<typeof getStandings>>["named"][number];

function Row({
  s,
  metric,
  rank,
  eligible,
  streak,
  muted = false,
}: {
  s: Named;
  metric: Metric;
  rank?: number;
  eligible: number;
  streak?: number;
  muted?: boolean;
}) {
  return (
    <DarkCard className={muted ? "opacity-60" : undefined}>
      {/* Fixed two-line structure so every row is the same height regardless of
          how many games the player has played. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-4 w-64 shrink-0">
          {rank !== undefined && (
            <span className="text-lead text-muted tabular-nums w-5">{rank}</span>
          )}
          {s.player ? (
            <Link
              href={`/players/${s.player.handle}`}
              className="text-lead font-bold hover:text-accent transition-colors"
            >
              {s.player.displayName}
            </Link>
          ) : (
            <span className="text-lead font-bold">Unknown</span>
          )}
          <StreakBadge days={streak} />
        </div>

        <StatNumber className="w-44 shrink-0">{fmt(metricValue(s, metric))}</StatNumber>

        {/* The two metrics not ranked on, so switching the toggle visibly moves
            one number into the big slot. */}
        <div className="text-label text-muted space-y-0.5">
          <div>
            {METRICS.filter((m) => m.key !== metric)
              .map((m) => `${METRIC_NAME[m.key]} ${fmt(metricValue(s, m.key))}`)
              .join(" · ")}
          </div>
          <div>
            {s.entries} of {eligible} entries
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-surface-raised">
        {DAILY_GAMES.map((g) => {
          const b = s.byGame[g.slug];
          return (
            <div key={g.slug} className="flex items-center gap-1.5">
              <GamePill game={g.slug} />
              <span className="text-label tabular-nums w-11">
                {b ? fmt(b.average) : "\u2014"}
              </span>
            </div>
          );
        })}
      </div>
    </DarkCard>
  );
}

function fmt(n: number): string {
  const rounded = n.toFixed(2);
  // Without this, a value like -0.003 renders as "-0.00", which reads as a bug.
  if (rounded === "-0.00" || rounded === "0.00") return "0.00";
  return (n >= 0 ? "+" : "") + rounded;
}
