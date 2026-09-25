import { describe, expect, it } from "vitest";
import { divergingBars, niceCeil } from "../chart";

describe("niceCeil", () => {
  it("rounds up to 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceCeil(0.77)).toBe(1);
    expect(niceCeil(1.2)).toBe(2);
    expect(niceCeil(2.1)).toBe(2.5);
    expect(niceCeil(18.14)).toBe(20);
    expect(niceCeil(0.04)).toBeCloseTo(0.05);
  });

  it("keeps an exact step", () => {
    expect(niceCeil(0.3)).toBeCloseTo(0.5);
    expect(niceCeil(2)).toBe(2);
    expect(niceCeil(10)).toBe(10);
  });

  it("returns 1 for zero or non-finite input, so an all-zero board still draws", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(NaN)).toBe(1);
    expect(niceCeil(Infinity)).toBe(1);
  });
});

describe("divergingBars", () => {
  it("grows positive bars right from the centre and negative bars left", () => {
    const { extent, bars } = divergingBars([0.5, -0.25, 0]);
    expect(extent).toBe(0.5);
    expect(bars[0]).toEqual({ left: 50, width: 50 });
    expect(bars[1]).toEqual({ left: 25, width: 25 });
    expect(bars[2]).toEqual({ left: 50, width: 0 });
  });

  it("uses one symmetric scale set by the largest magnitude of either sign", () => {
    const { extent, bars } = divergingBars([0.3, -1.8]);
    expect(extent).toBe(2);
    expect(bars[1].width).toBeCloseTo(45);
    expect(bars[0].width).toBeCloseTo(7.5);
  });

  it("never draws past the track", () => {
    for (const b of divergingBars([13.05, -9.39, 0.47]).bars) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.left + b.width).toBeLessThanOrEqual(100);
    }
  });
});
