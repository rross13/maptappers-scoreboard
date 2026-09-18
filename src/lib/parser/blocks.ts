import type { Block, GameDefinition } from "./types";

/**
 * Splits a paste into per-game blocks by locating each game's signature line.
 *
 * Blank-line splitting is not viable against the real data: Krillion puts a
 * blank line inside its own block, and games pasted back to back have no
 * separator at all, so a blank-line splitter both over- and under-splits. The
 * signature line is the one reliable landmark, so detection and segmentation are
 * the same operation.
 */

interface Anchor {
  def: GameDefinition;
  line: number;
  col: number;
  match: RegExpMatchArray;
  hasPrefix: boolean;
}

function findAnchors(lines: string[], defs: GameDefinition[]): Anchor[] {
  const found: Anchor[] = [];
  for (const def of defs) {
    for (const re of def.anchors) {
      for (let i = 0; i < lines.length; i++) {
        const m = re.exec(lines[i]);
        if (!m) continue;
        const col = m.index ?? 0;
        found.push({
          def,
          line: i,
          col,
          match: m,
          // Prose before the anchor on the same line, e.g.
          // "that was horrible Krillion #62". Used to soften a score-less match.
          hasPrefix: lines[i].slice(0, col).trim().length > 0,
        });
      }
    }
  }
  return found;
}

function dedupe(anchors: Anchor[]): Anchor[] {
  const sorted = [...anchors].sort(
    (a, b) =>
      a.line - b.line || a.col - b.col || b.def.priority - a.def.priority,
  );

  const kept: Anchor[] = [];
  for (const a of sorted) {
    // One line can only belong to one game: highest priority wins. Because the
    // list is pre-sorted by priority, an existing entry on this line already won.
    if (kept.some((k) => k.line === a.line)) continue;

    // A game whose header spans several lines (Size It Up's title plus "Overall
    // Score", Globle's optional "Globle Stats") anchors more than once; collapse
    // those to the earliest.
    const recentSameGame = kept.some(
      (k) =>
        k.def.game === a.def.game && a.line - k.line <= a.def.mergeWindow,
    );
    if (recentSameGame) continue;

    kept.push(a);
  }
  return kept;
}

export function splitIntoBlocks(
  lines: string[],
  defs: GameDefinition[],
): Block[] {
  const anchors = dedupe(findAnchors(lines, defs));

  return anchors.map((a, i) => {
    const nextStart = anchors[i + 1]?.line ?? lines.length;
    const end = Math.min(nextStart, a.line + a.def.maxBlockLines, lines.length);
    const slice = lines.slice(a.line, end);
    // Trailing blanks belong to nobody.
    while (slice.length > 0 && slice[slice.length - 1] === "") slice.pop();

    return {
      game: a.def.game,
      lines: slice,
      text: slice.join("\n"),
      startLine: a.line,
      endLine: a.line + slice.length,
      anchorHasPrefix: a.hasPrefix,
      anchorMatch: a.match,
    };
  });
}

export function defForBlock(
  block: Block,
  defs: GameDefinition[],
): GameDefinition {
  return defs.find((d) => d.game === block.game)!;
}
