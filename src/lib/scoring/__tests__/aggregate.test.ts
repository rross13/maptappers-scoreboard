import { describe, expect, it } from "vitest";
import {
  PARTICIPATION_FLOOR,
  groupIntoSlots,
  metricValue,
  standings,
  type Slot,
} from "../aggregate";
import { scoreSlot } from "../z";
import type { GameSlug } from "@/lib/games/config";

function slot(game: GameSlug, date: string, scores: Record<string, number>): Slot {
  return {
    game,
    date,
    scored: scoreSlot(
      game,
      Object.entries(scores).map(([playerId, rawScore]) => ({ playerId, rawScore })),
    ),
  };
}

describe("standings", () => {
  it("excludes slots only one person played", () => {
    const r = standings([slot("maptap", "2026-09-18", { a: 900 })]);
    expect(r.eligibleSlots).toBe(0);
    expect(r.standings).toHaveLength(0);
  });

  it("counts a tied slot as participation for everyone", () => {
    const r = standings([slot("maptap", "2026-09-18", { a: 800, b: 800 })]);
    expect(r.eligibleSlots).toBe(1);
    expect(r.standings.map((s) => s.entries)).toEqual([1, 1]);
    expect(r.standings.every((s) => s.total === 0)).toBe(true);
  });

  it("ranks by average z when qualified", () => {
    const slots = [
      slot("maptap", "2026-09-17", { a: 950, b: 700, c: 800 }),
      slot("maptap", "2026-09-18", { a: 900, b: 750, c: 820 }),
    ];
    const r = standings(slots);
    expect(r.standings[0].playerId).toBe("a");
    expect(r.standings.at(-1)!.playerId).toBe("b");
    expect(r.standings.every((s) => s.qualified)).toBe(true);
  });

  it("does not let a cherry-picker outrank a full participant", () => {
    // 10 slots. `grinder` plays all of them at middling scores; `sniper` plays
    // only 2 and wins both. Average alone would hand it to the sniper.
    const slots: Slot[] = [];
    for (let i = 0; i < 10; i++) {
      const date = `2026-09-${String(i + 1).padStart(2, "0")}`;
      const scores: Record<string, number> = { grinder: 850, filler: 800 };
      if (i < 2) scores.sniper = 1000;
      slots.push(slot("maptap", date, scores));
    }
    const r = standings(slots);
    const sniper = r.standings.find((s) => s.playerId === "sniper")!;
    const grinder = r.standings.find((s) => s.playerId === "grinder")!;

    expect(sniper.average).toBeGreaterThan(grinder.average);
    expect(sniper.qualified).toBe(false);
    expect(grinder.qualified).toBe(true);
    // Qualification, not raw average, decides the order.
    expect(r.standings.findIndex((s) => s.playerId === "grinder")).toBeLessThan(
      r.standings.findIndex((s) => s.playerId === "sniper"),
    );
  });

  it("qualifies exactly at the participation floor", () => {
    const slots: Slot[] = [];
    for (let i = 0; i < 10; i++) {
      const date = `2026-09-${String(i + 1).padStart(2, "0")}`;
      const scores: Record<string, number> = { full: 800, other: 700 };
      if (i < 5) scores.half = 750; // exactly 5 of 10
      slots.push(slot("maptap", date, scores));
    }
    const r = standings(slots);
    expect(r.eligibleSlots).toBe(10);
    const half = r.standings.find((s) => s.playerId === "half")!;
    expect(half.entries).toBe(PARTICIPATION_FLOOR * r.eligibleSlots);
    expect(half.qualified).toBe(true);
  });

  it("ranks by total or the shrinkage estimator when asked", () => {
    const slots = [
      slot("maptap", "2026-09-17", { a: 950, b: 700, c: 800 }),
      slot("maptap", "2026-09-18", { a: 900, b: 750, c: 820 }),
    ];
    expect(standings(slots, "total").standings[0].playerId).toBe("a");
    const adj = standings(slots, "adj").standings;
    // Shrinkage pulls every record toward zero, so |adjusted| < |average|.
    for (const s of adj) expect(Math.abs(s.adjusted)).toBeLessThan(Math.abs(s.average) + 1e-9);
  });

  it("reads the value each metric ranks on", () => {
    const [s] = standings([slot("maptap", "2026-09-17", { a: 950, b: 700 })]).standings;
    expect(metricValue(s, "avg")).toBe(s.average);
    expect(metricValue(s, "total")).toBe(s.total);
    expect(metricValue(s, "adj")).toBe(s.adjusted);
    // With one entry the average is the total; only the shrinkage moves it.
    expect(s.total).toBe(s.average);
    expect(s.adjusted).not.toBe(s.average);
  });

  it("breaks standings down per game", () => {
    const r = standings([
      slot("maptap", "2026-09-18", { a: 950, b: 700 }),
      slot("globle", "2026-09-18", { a: 4, b: 12 }),
    ]);
    const a = r.standings.find((s) => s.playerId === "a")!;
    expect(Object.keys(a.byGame).sort()).toEqual(["globle", "maptap"]);
    // Best at both, so positive in both.
    expect(a.byGame.maptap.average).toBeGreaterThan(0);
    expect(a.byGame.globle.average).toBeGreaterThan(0);
  });

  it("handles an empty window", () => {
    const r = standings([]);
    expect(r.eligibleSlots).toBe(0);
    expect(r.standings).toEqual([]);
  });
});

describe("groupIntoSlots", () => {
  it("groups by game and date", () => {
    const rows = [
      { game: "maptap" as GameSlug, puzzleDate: "2026-09-18", playerId: "a", rawScore: 900 },
      { game: "maptap" as GameSlug, puzzleDate: "2026-09-18", playerId: "b", rawScore: 800 },
      { game: "maptap" as GameSlug, puzzleDate: "2026-09-17", playerId: "a", rawScore: 850 },
      { game: "globle" as GameSlug, puzzleDate: "2026-09-18", playerId: "a", rawScore: 5 },
    ];
    const slots = groupIntoSlots(rows);
    expect(slots).toHaveLength(3);
    expect(slots.find((s) => s.game === "maptap" && s.date === "2026-09-18")!.entries).toHaveLength(2);
  });
});
