/**
 * Column sorting for the server-rendered tables, carried in the URL as
 * `?sort=key` or `?sort=-key` (reversed), so a header is a plain link.
 *
 * Every column has a natural first order — names A→Z, scores best-first — and
 * clicking the active header reverses it. Rows with no value always sort last in
 * both directions: an unplayed game is never "the best" nor "the worst".
 */

export interface SortState {
  key: string;
  reversed: boolean;
}

export interface SortColumn<T> {
  key: string;
  /** null means no data for this row. */
  value: (row: T) => number | string | null;
  /** Whether the natural first order is largest-first. */
  descending: boolean;
}

export function parseSort(
  raw: string | undefined,
  keys: readonly string[],
  fallback: string,
): SortState {
  const reversed = raw?.startsWith("-") ?? false;
  const key = reversed ? raw!.slice(1) : raw;
  return key && keys.includes(key) ? { key, reversed } : { key: fallback, reversed: false };
}

export function sortParam(s: SortState): string {
  return (s.reversed ? "-" : "") + s.key;
}

/** Where clicking `key`'s header goes from `current`. */
export function nextSort(current: SortState, key: string): SortState {
  return { key, reversed: current.key === key ? !current.reversed : false };
}

export function isDescending<T>(column: SortColumn<T>, state: SortState): boolean {
  return column.descending !== state.reversed;
}

/** Stable, so rows that tie keep the order they came in. */
export function sortRows<T>(rows: T[], column: SortColumn<T>, state: SortState): T[] {
  const sign = isDescending(column, state) ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = column.value(a);
    const vb = column.value(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    const c =
      typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb, undefined, { sensitivity: "base" })
        : Number(va) - Number(vb);
    return sign * c;
  });
}
