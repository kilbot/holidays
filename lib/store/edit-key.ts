"use client";

/**
 * How the edit key gets into the browser, and where it stays.
 *
 * ADR 0001 gives the canonical Plan two links, and the difference between them
 * is this string. The couple opens `#edit=<key>` once — from a bookmark, a
 * password manager, a note to themselves — and after that the tab is in edit
 * mode because the key is in localStorage, not because the URL still says so.
 *
 * Three decisions, each doing real work:
 *
 * 1. **A fragment, not a query string.** `#edit=` is never sent to the server,
 *    so the key appears in no access log, no `Referer` header and nothing
 *    Vercel records. A `?edit=` would have been in the request line of every
 *    proxy between the couple and the site.
 * 2. **Stripped from the address bar.** What remains is the view link — which is
 *    exactly what should be copied out of that address bar, and what a
 *    screen-share or a screenshot then shows.
 * 3. **Stored, not held in memory.** A reload must not drop the couple back to
 *    read-only, and asking them to re-open the edit link every time would push
 *    them to keep it somewhere they screenshot.
 *
 * ## Why capture and strip are two functions
 *
 * Capture runs at module load, so the first paint already knows the tab is in
 * edit mode. Stripping cannot: Next's App Router patches `history` and rewrites
 * the URL as it hydrates, so a `replaceState` fired before hydration is simply
 * undone — measured, not assumed. The strip therefore runs from an effect, one
 * tick later, which is after the router has settled and still long before
 * anybody could have read the address bar.
 */

import {
  EDIT_KEY_FRAGMENT,
  EDIT_KEY_STORAGE_KEY,
} from "@/lib/store/canonical-plan";

let current: string | null = null;
const listeners = new Set<() => void>();

/**
 * Take the key out of the URL if it is there, and remember it.
 *
 * Idempotent and safe to call on every boot and on every `hashchange`: with no
 * fragment it reads back whatever was stored last time. Returns the key this tab
 * is holding, or null for a plain visitor — which is the common case and not an
 * error.
 */
export function captureEditKey(): string | null {
  if (typeof window === "undefined") return null;

  const fragment = window.location.hash.replace(/^#/, "");
  const found = new URLSearchParams(fragment).get(EDIT_KEY_FRAGMENT);
  const next = found || readStored();

  if (found) persist(found);
  if (next !== current) {
    current = next;
    for (const listener of listeners) listener();
  }
  return current;
}

/**
 * Remove `#edit=` from the address bar, keeping everything else in the URL.
 *
 * Call from an effect, never at module load — see the note above about the
 * router rewriting the URL during hydration.
 */
export function stripEditKeyFromUrl(): void {
  if (typeof window === "undefined") return;
  const fragment = window.location.hash.replace(/^#/, "");
  const rest = new URLSearchParams(fragment);
  if (!rest.has(EDIT_KEY_FRAGMENT)) return;

  rest.delete(EDIT_KEY_FRAGMENT);
  const tail = rest.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}${tail ? `#${tail}` : ""}`,
  );
}

/** The key this tab holds, without re-reading the URL. */
export function readEditKey(): string | null {
  return current ?? readStored();
}

export function subscribeEditKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(EDIT_KEY_STORAGE_KEY);
  } catch {
    // Safari private mode throws on read. A tab that cannot remember the key is
    // a tab in view mode, which is the safe direction to fail in.
    return null;
  }
}

function persist(key: string): void {
  try {
    window.localStorage.setItem(EDIT_KEY_STORAGE_KEY, key);
  } catch {
    // Nothing to do — this tab stays in edit mode for as long as it lives,
    // because the key is held in `current` regardless.
  }
}

/** Hand the tab back to view mode. The couple's "not on this browser" button. */
export function forgetEditKey(): void {
  current = null;
  try {
    window.localStorage.removeItem(EDIT_KEY_STORAGE_KEY);
  } catch {
    // Already unreachable; there is nothing stored to forget.
  }
  for (const listener of listeners) listener();
}
