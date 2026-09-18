"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { parsePaste, SCOREBOARD_TZ, type ParseResult } from "@/lib/parser";
import { submitScore, type SubmitState } from "@/app/actions/scores";
import { GamePill } from "@/components/brand";
import type { GameSlug } from "@/lib/games/config";
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

export function SubmitPanel({ roster }: { roster: RosterEntry[] }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [text, setText] = useState("");
  const [state, setState] = useState<SubmitState | null>(null);
  const [pending, startTransition] = useTransition();

  // A remembered id that is no longer on the roster falls back to unselected.
  const playerId = roster.some((p) => p.id === stored) ? stored : "";

  // Same parser as the server, so the preview cannot disagree with what is saved.
  const preview: ParseResult | null = useMemo(
    () => (text.trim() ? parsePaste(text, { timeZone: SCOREBOARD_TZ }) : null),
    [text],
  );

  const hasLowConfidence =
    preview?.entries.some((e) => e.scoreConfidence === "low") ?? false;

  function onSubmit(acceptLowConfidence: boolean) {
    startTransition(async () => {
      const result = await submitScore(playerId, text, acceptLowConfidence);
      setState(result);
      if (result.ok) setText("");
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

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Paste your score here — any game, or all of them at once."
        className="w-full rounded-card bg-surface text-paper text-body p-4 font-mono border border-surface-raised focus:border-accent outline-none resize-y"
      />

      {preview && <Preview result={preview} />}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => onSubmit(false)}
          disabled={pending || !playerId || !preview?.entries.length}
          className="rounded-pill bg-accent text-ink text-body font-bold px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Submit"}
        </button>
        {hasLowConfidence && (
          <button
            onClick={() => onSubmit(true)}
            disabled={pending || !playerId}
            className="rounded-pill border border-accent text-paper text-body px-5 py-2.5 disabled:opacity-40"
          >
            Confirm &amp; save the uncertain one
          </button>
        )}
        {!playerId && (
          <span className="text-label text-muted">Pick your name to submit.</span>
        )}
      </div>

      {state && <Result state={state} />}
    </div>
  );
}

function Preview({ result }: { result: ParseResult }) {
  if (result.status === "empty" && result.failures.length === 0) {
    return (
      <p className="text-label text-muted">
        No game recognized yet — keep pasting.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {result.entries.map((e, i) => (
        <div
          key={`${e.game}-${i}`}
          className="rounded-tile bg-surface-raised p-4 flex flex-wrap items-center gap-3"
        >
          <GamePill game={e.game as GameSlug} />
          <span className="text-body font-bold">{e.displayName}</span>
          <span className="text-body tabular-nums">{e.score}</span>
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

      {result.failures.map((f, i) => (
        <div key={`f-${i}`} className="rounded-tile bg-surface-raised p-4">
          <span className="text-body font-bold">{f.displayName}</span>
          {f.issues.map((iss, k) => (
            <p key={k} className="text-label text-muted mt-1">
              {iss.message}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Result({ state }: { state: SubmitState }) {
  return (
    <div className="rounded-tile bg-surface-raised p-4 space-y-1">
      {state.saved.map((s, i) => (
        <p key={i} className="text-body">
          Saved {s.displayName} {s.score} for {s.puzzleDate}
          {s.replaced !== null && (
            <span className="text-muted"> — replaced {s.replaced}</span>
          )}
        </p>
      ))}
      {state.problems.map((p, i) => (
        <p key={`p-${i}`} className="text-label text-muted">
          {p}
        </p>
      ))}
      {state.message && <p className="text-label text-muted">{state.message}</p>}
    </div>
  );
}
