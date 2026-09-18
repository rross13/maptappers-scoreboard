/**
 * Single-series sparkline, drawn as inline SVG.
 *
 * Deliberately one series: the Halda accents fail a categorical CVD check as a
 * set (blue and purple sit at deltaE 12.3 in normal vision, below the floor of
 * 15), so game identity is never carried by color anywhere in this app. Each
 * chart plots one line in the page's own accent, and the heading names it.
 */
export function Sparkline({
  values,
  width = 280,
  height = 56,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label: string;
}) {
  if (values.length < 2) {
    return <p className="text-label text-muted">Not enough days to plot yet.</p>;
  }

  const pad = 4;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0);
  const last = values[values.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${values.length} days, ending at ${last.toFixed(2)}`}
      className="overflow-visible"
    >
      {/* Recessive baseline at zero — the reference the whole metric is read against. */}
      <line
        x1={pad}
        x2={width - pad}
        y1={zeroY}
        y2={zeroY}
        stroke="currentColor"
        strokeWidth={1}
        className="text-muted"
      />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r={4} fill="var(--accent)" />
    </svg>
  );
}
