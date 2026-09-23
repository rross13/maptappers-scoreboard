"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A score that reveals its per-round breakdown on hover, focus or tap.
 *
 * The panel is a native `popover` so it renders in the top layer: the board's
 * table sits in an `overflow-x-auto` card, which would clip an absolutely
 * positioned child. "manual" rather than "auto" because hover, focus and tap
 * each decide when it opens; "auto" would also light-dismiss the tap it opened on.
 */
export function ScoreBreakdown({
  lines,
  children,
}: {
  lines: string[] | null;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const detach = useRef<(() => void) | null>(null);
  useEffect(() => () => detach.current?.(), []);

  if (!lines) return <span>{children}</span>;

  const place = () => {
    const t = trigger.current;
    const p = panel.current;
    if (!t || !p) return;
    const r = t.getBoundingClientRect();
    const w = p.getBoundingClientRect().width;
    p.style.top = `${r.bottom + 8}px`;
    p.style.left = `${Math.min(
      Math.max(8, r.left + r.width / 2 - w / 2),
      window.innerWidth - w - 8,
    )}px`;
  };

  const open = () => {
    const t = trigger.current;
    const p = panel.current;
    if (!t || !p || p.matches(":popover-open")) return;
    // Shown before placing, so the panel has a width to centre and clamp with.
    p.showPopover();
    place();

    // Fixed-position, so it follows the score through page and table scrolls.
    // And Safari never focuses a tapped button, so blur can't be what closes
    // it there; an outside press does.
    const outside = (e: PointerEvent) => {
      if (!t.contains(e.target as Node)) close();
    };
    window.addEventListener("scroll", place, { capture: true, passive: true });
    document.addEventListener("pointerdown", outside, { capture: true });
    detach.current = () => {
      window.removeEventListener("scroll", place, { capture: true });
      document.removeEventListener("pointerdown", outside, { capture: true });
    };
  };

  const close = () => {
    detach.current?.();
    detach.current = null;
    const p = panel.current;
    if (p?.matches(":popover-open")) p.hidePopover();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-describedby={id}
        className="cursor-help font-[inherit] text-[length:inherit] tabular-nums underline decoration-dotted decoration-muted underline-offset-4 rounded-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
        onPointerEnter={(e) => e.pointerType === "mouse" && open()}
        onPointerLeave={(e) => e.pointerType === "mouse" && close()}
        onClick={open}
        onFocus={open}
        onBlur={close}
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        {children}
      </button>
      <div
        ref={panel}
        id={id}
        popover="manual"
        role="tooltip"
        className="fixed inset-auto m-0 rounded-tile border border-muted bg-surface-raised text-paper px-4 py-3 text-body leading-relaxed text-left whitespace-pre tabular-nums"
      >
        {lines.join("\n")}
      </div>
    </>
  );
}
