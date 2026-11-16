import type { ParsedEntry } from "@/lib/parser/types";

/**
 * Why a parsed entry can't be recorded for `forDate`, or null if it can.
 *
 * Recording a past day is strict: the person picked that day on the board, so a
 * share for any other day is a slip, usually today's puzzle pasted by habit.
 * Saving it would quietly land on a day they aren't looking at. Today's dialog
 * passes no `forDate` and stays permissive, because a paste just after midnight
 * of the puzzle you finished before it is ordinary.
 *
 * Shared by the browser preview and the server action, so both say the same thing.
 */
export function wrongDayReason(
  entry: Pick<ParsedEntry, "displayName" | "puzzleDate">,
  forDate: string | undefined,
): string | null {
  if (forDate === undefined || entry.puzzleDate === forDate) return null;
  return `That's the ${entry.displayName} puzzle for ${entry.puzzleDate}, not ${forDate}. Go to ${entry.puzzleDate} on the board to record it.`;
}
