import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { MIN_PARTICIPANTS, sampleStdev, scoreSlot, transform } from "../z";

const entry = (playerId: string, rawScore: number) => ({ playerId, rawScore });

describe("degenerate slots", () => {
  it("does not score a slot with only one player", () => {
    // Assigning 0 would quietly pay out a free average day for playing alone,
    // which is farmable. The slot is excluded instead.
    expect(scoreSlot("maptap", [entry("a", 900)])).toBeNull();
  });

  it("gives everyone z = 0 when the group ties", () => {
    const r = scoreSlot("maptap", [entry("a", 800), entry("b", 800), entry("c", 800)])!;
    expect(r.map((e) => e.z)).toEqual([0, 0, 0]);
    // Not NaN and not null: a tie is a real outcome that counts as participation.
    expect(r.every((e) => Number.isFinite(e.z))).toBe(true);
  });

  it("always yields exactly +/-0.7071 with two players, whatever the margin", () => {
    const narrow = scoreSlot("maptap", [entry("a", 801), entry("b", 800)])!;
    const wide = scoreSlot("maptap", [entry("a", 1000), entry("b", 600)])!;
    const half = Math.SQRT1_2;
    expect(narrow[0].z).toBeCloseTo(half, 10);
    expect(narrow[1].z).toBeCloseTo(-half, 10);
    // This artifact is inherent to n=2. Asserted so nobody "fixes" it later.
    expect(wide[0].z).toBeCloseTo(narrow[0].z, 10);
  });

  it("requires at least two participants", () => {
    expect(MIN_PARTICIPANTS).toBe(2);
  });

  it("returns null stdev below two values", () => {
    expect(sampleStdev([1])).toBeNull();
    expect(sampleStdev([1, 3])).toBeCloseTo(Math.SQRT2, 10);
  });
});

describe("direction", () => {
  it("gives the highest MapTap score the highest z", () => {
    const r = scoreSlot("maptap", [entry("lo", 600), entry("hi", 950)])!;
    expect(r.find((e) => e.playerId === "hi")!.z).toBeGreaterThan(
      r.find((e) => e.playerId === "lo")!.z,
    );
  });

  it("gives the LOWEST Globle guess count the highest z", () => {
    const r = scoreSlot("globle", [entry("few", 4), entry("many", 20)])!;
    expect(r.find((e) => e.playerId === "few")!.z).toBeGreaterThan(0);
    expect(r.find((e) => e.playerId === "many")!.z).toBeLessThan(0);
  });

  it("gives the LOWEST Fermi multiplier the highest z", () => {
    const r = scoreSlot("fermi", [entry("good", 1.5), entry("bad", 300)])!;
    expect(r.find((e) => e.playerId === "good")!.z).toBeGreaterThan(0);
    expect(r.find((e) => e.playerId === "bad")!.z).toBeLessThan(0);
  });
});

describe("Fermi log transform", () => {
  const day = [
    entry("a", 1.67), entry("b", 1.9), entry("c", 2.1),
    entry("d", 2.28), entry("e", 2.5), entry("outlier", 349),
  ];

  it("separates the clustered players far better than a linear scale would", () => {
    const logged = scoreSlot("fermi", day)!;
    const clustered = logged.filter((e) => e.playerId !== "outlier").map((e) => e.z);
    const logSpread = Math.max(...clustered) - Math.min(...clustered);

    // The same day scored linearly, to show what the transform actually buys.
    const raw = day.map((e) => e.rawScore);
    const mu = raw.reduce((a, b) => a + b, 0) / raw.length;
    const sd = Math.sqrt(
      raw.reduce((acc, x) => acc + (x - mu) ** 2, 0) / (raw.length - 1),
    );
    const linear = day
      .filter((e) => e.playerId !== "outlier")
      .map((e) => -1 * ((e.rawScore - mu) / sd));
    const linearSpread = Math.max(...linear) - Math.min(...linear);

    // One 349x outlier flattens the five real performances into near-identical
    // z values on a raw scale; the log keeps them an order of magnitude apart.
    // Measured on this fixture: 0.192 logged vs 0.0058 linear, a 33x gain.
    expect(logSpread / linearSpread).toBeGreaterThan(10);
    expect(linearSpread).toBeLessThan(0.01);

    // Ordering must survive the transform: better multiplier, higher z.
    const ordered = logged
      .filter((e) => e.playerId !== "outlier")
      .sort((a, b) => a.rawScore - b.rawScore);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i - 1].z).toBeGreaterThan(ordered[i].z);
    }
  });

  it("rejects a non-positive Fermi multiplier", () => {
    expect(() => transform("fermi", 0)).toThrow();
    expect(() => transform("fermi", -1)).toThrow();
  });

  it("leaves the other games untransformed", () => {
    expect(transform("maptap", 872)).toBe(872);
    expect(transform("globle", 9)).toBe(9);
  });
});

/**
 * Sum(z) = 0 and Sum(z^2) = n-1 hold exactly in real arithmetic. In float64 the
 * subtraction (x - mu) loses precision in proportion to |mu|/sigma, so the
 * residual has to be judged against that condition number rather than a fixed
 * epsilon. A tightly clustered slot at a large magnitude (Fermi's log10 puts
 * 49999.78 and 49999.81 at ~4.699 apart by 3e-10) is well conditioned as a
 * ranking and badly conditioned as a subtraction; both facts are real.
 */
function expectZIdentities(zs: number[], values: number[]): void {
  const n = zs.length;
  if (zs.every((z) => z === 0)) return; // tied slot: both identities are trivial

  const mu = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(
    values.reduce((acc, x) => acc + (x - mu) ** 2, 0) / (n - 1),
  );
  const condition = sd === 0 ? 1 : 1 + Math.abs(mu) / sd;
  const tol = 1e-12 * condition;

  const sumZ = zs.reduce((a, b) => a + b, 0);
  const sumZ2 = zs.reduce((a, b) => a + b * b, 0);

  expect(Math.abs(sumZ)).toBeLessThan(Math.max(tol, 1e-9));
  expect(Math.abs(sumZ2 - (n - 1))).toBeLessThan(Math.max(tol, 1e-9) * n);
}

describe("algebraic invariants", () => {
  it("sums z to 0 and z^2 to n-1 for integer-scored games", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 2, maxLength: 12 }),
        (scores) => {
          const r = scoreSlot("maptap", scores.map((s, i) => entry(`p${i}`, s)))!;
          expectZIdentities(r.map((e) => e.z), r.map((e) => e.value));
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("holds for Fermi under the log transform", () => {
    fc.assert(
      fc.property(
        // Observed Fermi totals run 1.25x to 349x; this spans that with headroom
        // and keeps two decimals, which is what the game actually prints.
        fc.array(
          fc.integer({ min: 100, max: 100_000 }).map((n) => n / 100),
          { minLength: 2, maxLength: 12 },
        ),
        (scores) => {
          const r = scoreSlot("fermi", scores.map((s, i) => entry(`p${i}`, s)))!;
          expectZIdentities(r.map((e) => e.z), r.map((e) => e.value));
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });

  it("keeps ranking consistent with direction for any integer slot", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 2, maxLength: 8 }),
        (guesses) => {
          const r = scoreSlot("globle", guesses.map((g, i) => entry(`p${i}`, g)))!;
          const sorted = [...r].sort((a, b) => a.rawScore - b.rawScore);
          for (let i = 1; i < sorted.length; i++) {
            // Fewer guesses is better, so z must be non-increasing.
            expect(sorted[i - 1].z).toBeGreaterThanOrEqual(sorted[i].z - 1e-12);
          }
          return true;
        },
      ),
      { numRuns: 300 },
    );
  });
});
