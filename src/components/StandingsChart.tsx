import { divergingBars } from "@/lib/chart";

/**
 * Every player on one diverging bar chart, centred on the group (zero).
 *
 * One series in the page accent, for the same reason the sparklines are single
 * series: identity is carried by the name on each row, never by colour. The
 * value sits on the empty side of zero rather than at the bar's tip, so the
 * longest bar can run to the edge without its label being clipped.
 */
export function StandingsChart({
  rows,
  format,
  label,
}: {
  rows: { id: string; name: string; value: number; muted: boolean; detail: string }[];
  format: (n: number) => string;
  label: string;
}) {
  const { extent, bars } = divergingBars(rows.map((r) => r.value));

  return (
    <figure aria-label={label}>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const bar = bars[i];
          const positive = r.value >= 0;
          return (
            <div
              key={r.id}
              title={`${r.name}: ${format(r.value)} (${r.detail})`}
              className={`grid grid-cols-[minmax(0,7rem)_1fr] sm:grid-cols-[10rem_1fr] items-center gap-3 rounded-tile px-1 py-0.5 hover:bg-surface-raised ${r.muted ? "opacity-60" : ""}`}
            >
              <span className="text-label font-bold truncate">{r.name}</span>
              <div className="relative h-7">
                {/* Zero is the group; every bar is read against it. */}
                <div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-muted" />
                <div
                  aria-hidden="true"
                  className={`absolute top-1 h-5 bg-accent ${positive ? "rounded-r-[4px]" : "rounded-l-[4px]"}`}
                  style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                />
                <span
                  className="absolute top-0 leading-7 text-label tabular-nums text-paper"
                  style={
                    positive
                      ? { right: "calc(50% + 0.5rem)" }
                      : { left: "calc(50% + 0.5rem)" }
                  }
                >
                  {format(r.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[minmax(0,7rem)_1fr] sm:grid-cols-[10rem_1fr] gap-3 px-1 mt-2">
        <span />
        <div className="relative h-4 text-label text-muted tabular-nums">
          <span className="absolute left-0">{format(-extent)}</span>
          <span className="absolute left-1/2 -translate-x-1/2">0</span>
          <span className="absolute right-0">{format(extent)}</span>
        </div>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
