import type { ReactNode } from "react";
import { GAMES, type GameSlug } from "@/lib/games/config";

/**
 * Brand primitives.
 *
 * The text-on-background rule is encoded here rather than left to call sites:
 * white text appears only on near-black, and every accent fill takes black text.
 * Components reference `accent` (the CSS variable set by the page's data-accent)
 * and never a specific brand hex, so one-accent-per-page holds structurally.
 */

export function DarkCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card bg-surface text-paper p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function AccentCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card bg-accent text-ink p-6 ${className}`}>
      {children}
    </div>
  );
}

/** Large figures. Capped at the brand's 56pt equivalent and used only in cards. */
export function StatNumber({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-stat font-extrabold leading-none tabular-nums ${className}`}
    >
      {children}
    </div>
  );
}

const PILL_BG: Record<string, string> = {
  blue: "bg-blue",
  purple: "bg-purple",
  yellow: "bg-yellow",
  coral: "bg-coral",
  mono: "bg-paper",
};

/**
 * Game identity badge. Pills are the one sanctioned exception to
 * one-accent-per-page, so several may appear together on a multi-game page.
 * The pill spells the game out, so identity never rests on color alone.
 */
export function GamePill({
  game,
  className = "",
}: {
  game: GameSlug;
  className?: string;
}) {
  const cfg = GAMES[game];
  return (
    <span
      className={`rounded-pill ${PILL_BG[cfg.accent]} text-ink text-pill font-bold px-2.5 py-1 inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}
    >
      {cfg.name}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-lead font-bold text-paper mb-4">{children}</h2>
  );
}

export function MutedLabel({ children }: { children: ReactNode }) {
  return <span className="text-label text-muted">{children}</span>;
}
