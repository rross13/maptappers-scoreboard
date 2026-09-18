/**
 * Remembers which player is submitting, in localStorage.
 *
 * Exposed as an external store rather than read in an effect: the value does not
 * exist during server rendering, and useSyncExternalStore is the supported way to
 * express that (server snapshot "", client snapshot from storage) without a
 * setState-in-effect cascade or a hydration mismatch.
 *
 * Every access is wrapped: storage throws in private windows and with site data
 * blocked, and the picker has to render correctly when it comes back empty.
 */
const KEY = "maptappers.playerId";

const listeners = new Set<() => void>();
let cached: string | null = null;
let cacheValid = false;

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Another tab changing the value should be reflected here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cacheValid = false;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Cached because useSyncExternalStore requires a referentially stable snapshot. */
export function getSnapshot(): string {
  if (!cacheValid) {
    try {
      cached = localStorage.getItem(KEY);
    } catch {
      cached = null;
    }
    cacheValid = true;
  }
  return cached ?? "";
}

export function getServerSnapshot(): string {
  return "";
}

export function setStoredPlayer(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* non-fatal: the choice just won't be remembered */
  }
  cached = id;
  cacheValid = true;
  for (const fn of listeners) fn();
}
