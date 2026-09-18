import type { Metadata } from "next";
import { DarkCard, SectionTitle } from "@/components/brand";
import { getPlayersForAdmin } from "@/lib/queries";
import {
  createPlayer,
  deletePlayer,
  setPlayerActive,
  updatePlayer,
} from "@/app/actions/players";

export const dynamic = "force-dynamic";

// Unlinked, so keep it out of indexes too. This is obscurity, not access
// control — there is no auth in the app, and anyone who knows the path gets in.
export const metadata: Metadata = {
  title: "Roster",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const INPUT =
  "rounded-tile bg-ink text-paper text-body px-3 py-2 border border-surface-raised focus:border-accent outline-none w-full";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const ok = one(sp.ok);
  const error = one(sp.error);
  const roster = await getPlayersForAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title font-extrabold mb-2">Roster</h1>
        <p className="text-body text-muted max-w-2xl">
          Add, rename or remove players. There is no sign-in on this page &mdash;
          it is unlisted, not protected.
        </p>
      </div>

      {(ok || error) && (
        <div
          className={`rounded-tile p-4 text-body ${
            error ? "bg-accent text-ink" : "bg-surface-raised text-paper"
          }`}
        >
          {error ?? ok}
        </div>
      )}

      <section>
        <SectionTitle>Add a player</SectionTitle>
        <DarkCard>
          <form action={createPlayer} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1.5 block">
                <span className="text-label text-muted">Display name</span>
                <input name="displayName" required className={INPUT} />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-label text-muted">Email</span>
                <input name="email" type="email" required className={INPUT} />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-label text-muted">
                  Handle <span className="opacity-60">(optional)</span>
                </span>
                <input name="handle" className={INPUT} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-pill bg-accent text-ink text-body font-bold px-5 py-2.5"
              >
                Add player
              </button>
              <span className="text-label text-muted">
                The handle is the URL slug. Left blank, it comes from the name.
              </span>
            </div>
          </form>
        </DarkCard>
      </section>

      <section className="space-y-3">
        <SectionTitle>{roster.length} players</SectionTitle>
        {roster.map((p) => (
          <DarkCard key={p.id} className={p.isActive ? undefined : "opacity-60"}>
            {/* Stable hook for the row: the edit form and the delete button are
                separate forms, so they need a common ancestor to select on. */}
            <div data-player={p.handle} className="space-y-4">
              <form action={updatePlayer} className="space-y-4">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="space-y-1.5 block">
                    <span className="text-label text-muted">Display name</span>
                    <input
                      name="displayName"
                      defaultValue={p.displayName}
                      required
                      className={INPUT}
                    />
                  </label>
                  <label className="space-y-1.5 block">
                    <span className="text-label text-muted">Email</span>
                    <input
                      name="email"
                      type="email"
                      defaultValue={p.email}
                      required
                      className={INPUT}
                    />
                  </label>
                  <label className="space-y-1.5 block">
                    <span className="text-label text-muted">Handle</span>
                    <input
                      name="handle"
                      defaultValue={p.handle}
                      required
                      className={INPUT}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-pill border border-accent text-paper text-body px-5 py-2.5"
                  >
                    Save
                  </button>
                  <span className="text-label text-muted">
                    {p.scoreCount} score{p.scoreCount === 1 ? "" : "s"}
                    {p.isActive ? "" : " · off the roster"}
                  </span>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-surface-raised">
                <form action={setPlayerActive}>
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={p.isActive ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="rounded-pill bg-surface-raised text-paper text-label px-3.5 py-1.5 hover:text-paper"
                  >
                    {p.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </form>

                <form action={deletePlayer}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    disabled={p.scoreCount > 0}
                    className="rounded-pill bg-surface-raised text-muted text-label px-3.5 py-1.5 hover:text-paper disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </form>

                <span className="text-label text-muted">
                  {p.scoreCount > 0
                    ? "Deleting cascades to their scores, so it is blocked while they have any. Deactivating keeps the history and takes them off the roster."
                    : "No scores yet, so this one can be deleted outright."}
                </span>
              </div>
            </div>
          </DarkCard>
        ))}
      </section>
    </div>
  );
}
