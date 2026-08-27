/**
 * Which Plan this site is.
 *
 * There is exactly one canonical Plan — one couple, one trip, one itinerary —
 * so its id is a constant in the code rather than a route parameter the user
 * types or an environment variable nobody would ever change. Written once by
 * `scripts/bootstrap-plan.mjs` and pasted in here.
 *
 * **The id is not a secret.** It is the view link, which the ADR says is shared
 * freely: `docs/adr/0001-link-as-permission-sharing.md` — *"a view link shared
 * freely and an edit link held by the couple"*. Anyone holding it can read the
 * Plan and fork it, and neither of those is a thing to protect against.
 *
 * **The edit key is a secret, and it is not here.** It lives in KV and in the
 * URL the couple bookmarked, and nowhere else. The repo is public; the ADR's
 * closing line is *"the edit link must live in deployment env/data, never
 * committed here"*, and this file is the one most likely to tempt someone into
 * breaking that.
 */

/** The canonical Plan's id, from the bootstrap. Empty means "not bootstrapped". */
export const CANONICAL_PLAN_ID = "";

/**
 * Where the site lives, for links the bootstrap prints.
 *
 * The browser never reads this — share links are built from
 * `window.location.origin`, so a preview deployment produces preview links and
 * a friend forking from one gets a URL that works where they found it.
 */
export const PRODUCTION_ORIGIN =
  "https://holidays-paul-kilmurrays-projects.vercel.app";

/**
 * The URL fragment the edit key arrives in, once: `#edit=<key>`.
 *
 * A fragment and not a query string, deliberately. Fragments are never sent to
 * the server, so the key stays out of access logs, out of the Referer header
 * and out of anything Vercel records — and the client strips it from the
 * address bar the moment it has been stored.
 */
export const EDIT_KEY_FRAGMENT = "edit";

/** The query parameter a Fork link travels in: `?fork=<forkId>`. */
export const FORK_QUERY_PARAM = "fork";

/** Where the couple's browser remembers the edit key. */
export const EDIT_KEY_STORAGE_KEY = "southbound.editKey.v1";

export function viewUrl(origin: string): string {
  return `${origin}/`;
}

export function editUrl(origin: string, editKey: string): string {
  return `${origin}/#${EDIT_KEY_FRAGMENT}=${editKey}`;
}

export function forkShareUrl(origin: string, forkId: string): string {
  return `${origin}/?${FORK_QUERY_PARAM}=${forkId}`;
}
