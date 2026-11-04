export type Rect = { top: number; bottom: number; left: number; width: number };

export type Placement = {
  top: number;
  left: number;
  /** Set only when the panel fits on neither side and must be capped. */
  maxHeight: number | null;
};

const GAP = 8;
const MARGIN = 8;

/**
 * Where a fixed-position panel goes relative to its trigger: below if it fits,
 * else above if that fits, else whichever side has more room, height-capped.
 * Below is preferred so the panel doesn't jump sides as rows scroll past.
 */
export function placePanel(
  trigger: Rect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
): Placement {
  const left = Math.min(
    Math.max(MARGIN, trigger.left + trigger.width / 2 - panel.width / 2),
    viewport.width - panel.width - MARGIN,
  );
  const below = viewport.height - trigger.bottom - GAP - MARGIN;
  const above = trigger.top - GAP - MARGIN;

  if (panel.height <= below) return { top: trigger.bottom + GAP, left, maxHeight: null };
  if (panel.height <= above)
    return { top: trigger.top - GAP - panel.height, left, maxHeight: null };
  if (below >= above) return { top: trigger.bottom + GAP, left, maxHeight: below };
  return { top: MARGIN, left, maxHeight: above };
}
