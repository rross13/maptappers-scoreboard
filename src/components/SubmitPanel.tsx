"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { parsePaste, SCOREBOARD_TZ, type ParseResult } from "@/lib/parser";
import { submitScore, type SubmitState } from "@/app/actions/scores";
import { gameTabClass } from "@/components/brand";
import {
  DAILY_GAMES,
  formatScore,
  GAMES,
  type GameSlug,
} from "@/lib/games/config";
import {
  getServerSnapshot,
  getSnapshot,
  setStoredPlayer,
  subscribe,
} from "@/lib/player-store";

export interface RosterEntry {
  id: string;
  displayName: string;
}

/** A score already on record for today, from the server or from this session. */
export interface ExistingScore {
  score: number;
  puzzleDate: string;
  /** Absent for a save made in this session; the page carries it after a refresh. */
  revisions?: number;
}

type SavedMap = Partial<Record<GameSlug, ExistingScore>>;

/**
 * One tab per daily game, one submission per tab.
 *
 * Submitting advances to the next game still unlogged in this session, so the
 * common case — play all five, paste each as you go — is a straight walk with no
 * extra clicks, while clicking a tab directly handles "I only came to fix
 * Globle". A tab switch clears the box, because each tab is its own submission;
 * the one exception is the "switch to X" button on a wrong-tab paste, which
 * carries the text over rather than making the user paste it twice.
 *
 * A game you have already logged today opens locked, showing what is on record.
 * "Replace it" unlocks the box rather than the score being uneditable: the
 * schema keeps the old value in `score_revisions`, and a mis-pasted score whose
 * only remedy is a manual DB edit is a score nobody ever fixes.
 */
export function SubmitPanel({
  roster,
  existing,
  today,
}: {
  roster: RosterEntry[];
  /** Today's scores keyed by player, then game. */
  existing: Record<string, Partial<Record<string, ExistingScore>>>;
  /** The scoreboard's civil date, computed on the server. */
  today: string;
}) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [active, setActive] = useState<GameSlug>(DAILY_GAMES[0].slug);
  const [text, setText] = useState("");
  const [state, setState] = useState<SubmitState | null>(null);
  const [saved, setSaved] = useState<SavedMap>({});
  const [replacing, setReplacing] = useState<GameSlug | null>(null);
  const [pending, startTransition] = useTransition();

  // A remembered id that is no longer on the roster falls back to unselected.
  const playerId = roster.some((p) => p.id === stored) ? stored : "";
  const cfg = GAMES[active];

  // Same parser as the server, so the preview cannot disagree with what is saved.
  const preview: ParseResult | null = useMemo(
    () => (text.trim() ? parsePaste(text, { timeZone: SCOREBOARD_TZ }) : null),
    [text],
  );

  // This session's saves win over the server map: a revalidation may not have
  // landed yet, and either way the newer one is ours. Only a save *for today*
  // locks a tab — backdating yesterday's Globle must not block today's.
  const onRecord = (g: GameSlug): ExistingScore | null => {
    const here = saved[g];
    if (here && here.puzzleDate === today) return here;
    return playerId ? existing[playerId]?.[g] ?? null : null;
  };

  const recorded = onRecord(active);
  const locked = recorded !== null && replacing !== active;

  const mine = preview?.entries.filter((e) => e.game === active) ?? [];
  const elsewhere = preview?.entries.filter((e) => e.game !== active) ?? [];
  const failures = preview?.failures.filter((f) => f.game === active) ?? [];
  const hasLowConfidence = mine.some((e) => e.scoreConfidence === "low");

  function selectGame(game: GameSlug, keepText = false) {
    if (game === active) return;
    setActive(game);
    setState(null);
    setReplacing(null);
    if (!keepText) setText("");
  }

  function onSubmit(acceptLowConfidence: boolean) {
    const game = active;
    startTransition(async () => {
      const result = await submitScore(playerId, text, acceptLowConfidence, game);
      setState(result);
      if (!result.ok) return;

      const [first] = result.saved;
      const next: SavedMap = {
        ...saved,
        [game]: { score: first.score, puzzleDate: first.puzzleDate },
      };
      setSaved(next);
      setText("");
      setReplacing(null);
      const advance = nextUnlogged(game, (g) => {
        const here = next[g];
        if (here && here.puzzleDate === today) return true;
        return Boolean(playerId && existing[playerId]?.[g]);
      });
      if (advance) {
        setActive(advance);
        setState(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="player" className="text-label text-muted">
          You are
        </label>
        <select
          id="player"
          value={playerId}
          onChange={(e) => setStoredPlayer(e.target.value)}
          className="rounded-tile bg-surface-raised text-paper text-body px-3 py-2 border border-surface-raised focus:border-accent outline-none"
        >
          <option value="">Pick your name…</option>
          {roster.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Same strip as the per-game pages, but these switch tabs rather than
          pages — see gameTabClass. */}
      <div role="tablist" aria-label="Game" className="flex flex-wrap gap-2">
        {DAILY_GAMES.map((g) => {
          const on = g.slug === active;
          return (
            <button
              key={g.slug}
              type="button"
              role="tab"
              id={`tab-${g.slug}`}
              aria-selected={on}
              data-accent={g.accent}
              onClick={() => selectGame(g.slug)}
              className={gameTabClass(on)}
            >
              {g.name}
              {onRecord(g.slug) && <span aria-hidden> &#10003;</span>}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-lead font-bold">{cfg.name}</h3>
          {cfg.url && (
            <a
              href={cfg.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-label text-muted hover:text-paper underline underline-offset-4"
            >
              Play {cfg.name} &#8599;
            </a>
          )}
        </div>

        <textarea
          value={locked ? "" : text}
          onChange={(e) => setText(e.target.value)}
          disabled={locked}
          rows={7}
          placeholder={
            locked
              ? `Already logged for today.`
              : `Paste your ${cfg.name} share text here.`
          }
          // bg-ink, not bg-surface: the panel sits on a bg-surface dialog card,
          // so the paste box has to read as an inset well against it.
          className="w-full rounded-card bg-ink text-paper text-body p-4 font-mono border border-surface-raised focus:border-accent outline-none resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* The score on record reads like a parsed preview, because it is the
            same fact at a later moment. */}
        {recorded && <OnRecord game={active} score={recorded} />}

        {!locked && preview && (
          <Preview
            game={active}
            mine={mine}
            elsewhere={elsewhere}
            failures={failures}
            onSwitch={(g) => selectGame(g, true)}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          {locked ? (
            <button
              type="button"
              onClick={() => setReplacing(active)}
              className="rounded-pill border border-accent text-paper text-body px-5 py-2.5"
            >
              Replace it
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSubmit(false)}
              disabled={pending || !playerId || mine.length === 0}
              className="rounded-pill bg-accent text-ink text-body font-bold px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? "Saving…" : "Submit"}
            </button>
          )}
          {!locked && hasLowConfidence && (
            <button
              type="button"
              onClick={() => onSubmit(true)}
              disabled={pending || !playerId}
              className="rounded-pill border border-accent text-paper text-body px-5 py-2.5 disabled:opacity-40"
            >
              Confirm &amp; save the uncertain one
            </button>
          )}
          {!playerId && (
            <span className="text-label text-muted">
              Pick your name to submit.
            </span>
          )}
          {replacing === active && (
            <span className="text-label text-muted">
              The old score is kept in the history.
            </span>
          )}
        </div>
      </div>

      {state && !state.ok && <Problems state={state} />}
      {Object.keys(saved).length > 0 && <SavedSoFar saved={saved} />}
    </div>
  );
}

/** The next game with nothing on record for today, wrapping once. */
function nextUnlogged(
  from: GameSlug,
  isLogged: (game: GameSlug) => boolean,
): GameSlug | null {
  const i = DAILY_GAMES.findIndex((g) => g.slug === from);
  for (let k = 1; k <= DAILY_GAMES.length; k++) {
    const g = DAILY_GAMES[(i + k) % DAILY_GAMES.length];
    if (!isLogged(g.slug)) return g.slug;
  }
  return null;
}

function Preview({
  game,
  mine,
  elsewhere,
  failures,
  onSwitch,
}: {
  game: GameSlug;
  mine: ParseResult["entries"];
  elsewhere: ParseResult["entries"];
  failures: ParseResult["failures"];
  onSwitch: (game: GameSlug) => void;
}) {
  return (
    <div className="space-y-3">
      {mine.map((e, i) => (
        <div
          key={`${e.game}-${i}`}
          className="rounded-tile bg-surface-raised p-4 flex flex-wrap items-center gap-3"
        >
          <span className="text-body tabular-nums font-bold">{e.score}</span>
          <span className="text-label text-muted">{e.puzzleDate}</span>
          {e.dateConfidence !== "high" && (
            <span className="text-label text-muted">(date assumed)</span>
          )}
          {e.scoreConfidence === "low" && (
            <span className="text-label text-muted">needs confirmation</span>
          )}
          {e.issues.map((iss, k) => (
            <span key={k} className="text-label text-muted w-full">
              {iss.message}
            </span>
          ))}
        </div>
      ))}

      {failures.map((f, i) => (
        <div key={`f-${i}`} className="rounded-tile bg-surface-raised p-4">
          {f.issues.map((iss, k) => (
            <p key={k} className="text-label text-muted">
              {iss.message}
            </p>
          ))}
        </div>
      ))}

      {mine.length === 0 && failures.length === 0 && elsewhere.length === 0 && (
        <p className="text-label text-muted">
          No {GAMES[game].name} score in there yet — keep pasting.
        </p>
      )}

      {elsewhere.length > 0 && (
        <Elsewhere
          found={elsewhere}
          kept={mine.length > 0}
          game={game}
          onSwitch={onSwitch}
        />
      )}
    </div>
  );
}

/**
 * A paste can name a game other than the open tab — the usual slip is copying a
 * whole Slack message. Say what was seen and offer the tab, rather than silently
 * saving it or silently dropping it.
 */
function Elsewhere({
  found,
  kept,
  game,
  onSwitch,
}: {
  found: ParseResult["entries"];
  kept: boolean;
  game: GameSlug;
  onSwitch: (game: GameSlug) => void;
}) {
  const slugs = [...new Set(found.map((e) => e.game))];
  const tabbed = slugs.filter((s) => GAMES[s].isDaily);
  const untabbed = slugs.filter((s) => !GAMES[s].isDaily);

  return (
    <div className="rounded-tile bg-surface-raised p-4 space-y-3">
      <p className="text-label text-muted">
        {kept
          ? `Also found ${list(slugs)} in that paste. Only the ${GAMES[game].name} score saves here.`
          : `That reads as ${list(slugs)}, not ${GAMES[game].name}.`}
      </p>
      {tabbed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tabbed.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSwitch(s)}
              className="rounded-pill border border-accent text-paper text-label px-3.5 py-1.5"
            >
              Switch to {GAMES[s].name}
            </button>
          ))}
        </div>
      )}
      {untabbed.length > 0 && (
        <p className="text-label text-muted">
          {list(untabbed)} has no tab — it isn&rsquo;t part of the daily board.
        </p>
      )}
    </div>
  );
}

/** The score already stored for today, shown where the parsed preview goes. */
function OnRecord({ game, score }: { game: GameSlug; score: ExistingScore }) {
  return (
    <div className="rounded-tile bg-surface-raised p-4 flex flex-wrap items-center gap-3">
      <span className="text-body tabular-nums font-bold">
        {formatScore(game, score.score)}
      </span>
      <span className="text-label text-muted">{score.puzzleDate}</span>
      <span className="text-label text-muted">on record</span>
      {score.revisions !== undefined && score.revisions > 0 && (
        <span className="text-label text-muted">
          edited &times;{score.revisions}
        </span>
      )}
    </div>
  );
}

function Problems({ state }: { state: SubmitState }) {
  return (
    <div className="rounded-tile bg-surface-raised p-4 space-y-1">
      {state.problems.map((p, i) => (
        <p key={i} className="text-label text-muted">
          {p}
        </p>
      ))}
      {state.message && <p className="text-label text-muted">{state.message}</p>}
    </div>
  );
}

function SavedSoFar({ saved }: { saved: SavedMap }) {
  const done = DAILY_GAMES.filter((g) => saved[g.slug]);
  return (
    <div className="rounded-tile bg-surface-raised p-4 space-y-1">
      {done.map((g) => {
        const s = saved[g.slug]!;
        return (
          <p key={g.slug} className="text-label">
            <span className="font-bold">
              Saved {g.name} {formatScore(g.slug, s.score)}
            </span>{" "}
            <span className="text-muted">{s.puzzleDate}</span>
          </p>
        );
      })}
      {done.length === DAILY_GAMES.length && (
        <p className="text-label text-muted pt-1">
          That&rsquo;s all five. Close this to see the board.
        </p>
      )}
    </div>
  );
}

function list(slugs: GameSlug[]): string {
  const names = slugs.map((s) => GAMES[s].name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
