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
 * 2. **Stripped immediately.** `history.replaceState` takes it out of the
 *    address bar before anything can screenshot it, share it, or leave it in
 *    the tab title of a screen-shared browser. The URL that remains is the view
 *    link — which is exactly what should be copied out of that address bar.
 * 3. **Stored, not held in memory.** A reload must not drop the couple back to
 *    read-only, and asking them to re-open the edit link every time would push
 *    them to keep it somewhere they screenshot.
 */

import {
  EDIT_KEY_FRAGMENT,
  EDIT_KEY_STORAGE_KEY,
} from "@/lib/store/canonical-plan";

/**
 * Take the key out of the URL if it is there, and remember it.
 *
 * Idempotent and safe to call on every boot: with no fragment it simply reads
 * back whatever was stored last time. Returns the key this tab is holding, or
 * null for a plain visitor — which is the common case and not an error.
 */
export function captureEditKey(): string | null {
  if (typeof window === "undefined") return null;

  const fragment = window.location.hash.replace(/^#/, "");
  const found = new URLSearchParams(fragment).get(EDIT_KEY_FRAGMENT);

  if (found) {
    store(found);
    // Everything else in the fragment survives; only the secret is removed.
    const rest = new URLSearchParams(fragment);
    rest.delete(EDIT_KEY_FRAGMENT);
    const tail = rest.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${tail ? `#${tail}` : ""}`,
    );
    return found;
  }

  return readEditKey();
}

export function readEditKey(): string | null {
  try {
    return window.localStorage.getItem(EDIT_KEY_STORAGE_KEY);
  } catch {
    // Safari private mode throws on read. A tab that cannot remember the key is
    // a tab in view mode, which is the safe direction to fail in.
    return null;
  }
}

function store(key: string): void {
  try {
    window.localStorage.setItem(EDIT_KEY_STORAGE_KEY, key);
  } catch {
    // Nothing to do — this tab stays in edit mode for as long as it lives,
    // because `captureEditKey` returned the key regardless.
  }
}

/** Hand the tab back to view mode. The couple's "not on this browser" button. */
export function forgetEditKey(): void {
  try {
    window.localStorage.removeItem(EDIT_KEY_STORAGE_KEY);
  } catch {
    // Already unreachable; there is nothing stored to forget.
  }
}
