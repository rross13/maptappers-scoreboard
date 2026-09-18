"use client";

import { useRef } from "react";
import {
  SubmitPanel,
  type ExistingScore,
  type RosterEntry,
} from "@/components/SubmitPanel";

/**
 * The "Play & Submit" trigger and the dialog it opens.
 *
 * Built on the native <dialog> so focus trapping, Esc-to-close and inerting the
 * page behind come from the platform instead of hand-rolled key handlers.
 *
 * The dialog stays open after a save: the result list ("Saved MapTap 866 …") is
 * the only confirmation the user gets, and the board behind has already
 * revalidated by the time they close it.
 */
export function SubmitModal({
  roster,
  existing,
  today,
}: {
  roster: RosterEntry[];
  existing: Record<string, Partial<Record<string, ExistingScore>>>;
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-pill bg-accent text-ink text-body font-bold px-5 py-2.5 shrink-0"
      >
        Play &amp; Submit
      </button>

      <dialog
        ref={ref}
        aria-labelledby="submit-dialog-title"
        // A click whose target is the dialog element itself landed on the
        // backdrop; clicks inside the panel target the panel's own nodes.
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] bg-transparent p-0 text-paper backdrop:bg-ink/80"
      >
        <div className="rounded-card bg-surface p-6 max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 id="submit-dialog-title" className="text-lead font-bold">
                Submit a score
              </h2>
              <p className="text-label text-muted mt-1">
                One game per tab. Submitting moves you to the next one.
              </p>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="text-muted hover:text-paper text-lead leading-none px-2 py-1 shrink-0"
            >
              &times;
            </button>
          </div>

          <SubmitPanel roster={roster} existing={existing} today={today} />
        </div>
      </dialog>
    </>
  );
}
