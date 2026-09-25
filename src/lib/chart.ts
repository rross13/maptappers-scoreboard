/**
 * Geometry for a diverging bar chart centred on zero, as CSS percentages of the
 * track width. The scale is symmetric so zero sits at the middle and a bar's
 * length compares across the sign.
 */

/** The smallest of 1, 2, 2.5, 5 × 10^k that is ≥ x, so axis ends read as round numbers. */
export function niceCeil(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  // Scaled against a small tolerance so an exact step (0.3 → 0.5, not 1.0 via
  // 0.30000000000000004 / 0.1) lands on itself.
  const m = [1, 2, 2.5, 5, 10].find((s) => s * p >= x * (1 - 1e-12))!;
  return m * p;
}

export interface Bar {
  /** Left edge, percent of the track. */
  left: number;
  /** Width, percent of the track. */
  width: number;
}

export function divergingBars(values: number[]): { extent: number; bars: Bar[] } {
  const extent = niceCeil(Math.max(0, ...values.map(Math.abs)));
  const bars = values.map((v) => {
    const width = (Math.abs(v) / extent) * 50;
    return { left: v >= 0 ? 50 : 50 - width, width };
  });
  return { extent, bars };
}
