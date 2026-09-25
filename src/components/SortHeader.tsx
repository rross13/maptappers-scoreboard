import type { ReactNode } from "react";
import Link from "next/link";
import { isDescending, nextSort, sortParam, type SortColumn, type SortState } from "@/lib/sort";

/**
 * A table header that sorts by linking to the same page with a new `?sort=`.
 * A link rather than a button, so sorting needs no client JS and a sorted view
 * can be shared.
 */
export function SortHeader<T>({
  column,
  state,
  href,
  align = "left",
  children,
}: {
  column: SortColumn<T>;
  state: SortState;
  /** Builds the page URL for a `sort` param value. */
  href: (sort: string) => string;
  align?: "left" | "center" | "right";
  children: ReactNode;
}) {
  const active = state.key === column.key;
  const desc = isDescending(column, state);
  const justify = { left: "justify-start", center: "justify-center", right: "justify-end" }[align];

  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? "descending" : "ascending") : undefined}
      className="p-4 font-bold"
    >
      <Link
        href={href(sortParam(nextSort(state, column.key)))}
        scroll={false}
        className={`inline-flex w-full items-center gap-1 ${justify} rounded-tile hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper ${active ? "text-paper" : ""}`}
      >
        {children}
        {/* Reserved width either way, so the headers don't shift on click. */}
        <span aria-hidden="true" className="inline-block w-3 text-label">
          {active ? (desc ? "▼" : "▲") : ""}
        </span>
      </Link>
    </th>
  );
}
