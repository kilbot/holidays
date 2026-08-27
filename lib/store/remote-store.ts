"use client";

/**
 * The `ScenarioStore` that syncs with the server.
 *
 * It is a **wrapper**, not a replacement. `lib/engine/scenarios.ts` left a seam
 * with four methods; the obvious way to fill it would be to fetch on read and
 * await on write, and that would be the wrong shape for this site. The Plan is
 * a couple of kilobytes, the audience is two people who edit it while sitting
 * next to each other, and the failure that actually matters is a phone with no
 * signal halfway up a mountain.
 *
 * So localStorage stays the store. It answers every read synchronously, it
 * absorbs every write, and the server is something this wrapper reconciles it
 * with: hydrate once at boot, then push debounced. A dropped network degrades to
 * exactly the local-only mode the site had before #30 — the traveller keeps
 * editing, and the next successful save carries everything.
 *
 * ## Who wins
 *
 * On hydrate, the server wins — it is the canonical Plan, and a visitor's stale
 * localStorage from last week should not be what they see. But only until the
 * first local edit: if the traveller has already touched something while the
 * fetch was in flight, their edit stands and the hydrate is discarded. Losing a
 * keystroke to a race is worse than showing a slightly older Plan for 200ms.
 *
 * There is no merge and no conflict dialogue. Two simultaneous editors is a
 * problem this site does not have, `updatedAt` comes back on every write so the
 * UI can say when it last saved, and ADR 0001's whole premise is that the
 * audience is small enough not to need the machinery.
 *
 * ## What a visitor's write does (#58)
 *
 * A tab holding only the view link may not touch the canonical Plan — that is
 * ADR 0001, and it is not negotiable. But "may not save" is not "may not act":
 * the write still lands in localStorage, everything downstream recomputes, and
 * the visitor gets a working **preview** of their own version, which is the
 * "fork to play" invitation actually functioning.
 *
 * What was missing was the second half. The push used to be skipped in silence,
 * so the pill went on saying whatever it last said and nothing anywhere told the
 * visitor their rearranged trip would evaporate on reload. The status is now
 * `"preview"` from the first such write, and it is the UI's job to be loud about
 * it once.
 */

import { toPlanDoc, type PlanDoc } from "@/lib/engine/scenario-doc";
import type { ScenarioState, ScenarioStore } from "@/lib/engine/scenarios";
import { EDIT_KEY_HEADER } from "@/lib/store/guards";

/**
 * How long a knob must sit still before the Plan is pushed.
 *
 * Dragging a date fires a write per frame; 800ms is long enough that a whole
 * drag is one request and short enough that closing the laptop right after an
 * edit still saves it (`pagehide` flushes anything outstanding regardless).
 */
export const SAVE_DEBOUNCE_MS = 800;

/**
 * What the share UI shows about the connection.
 *
 * `"preview"` is the one that is about permission rather than plumbing: this
 * tab holds the view link, so its edits are real, immediate and local, and will
 * never reach the canonical Plan. Before #58 that case had no status at all —
 * the push was skipped and the pill went on saying whatever it last said — and
 * a visitor could rearrange the trip for ten minutes without a single word
 * telling them it was theirs alone.
 */
export type SyncStatus =
  | "local"
  | "loading"
  | "synced"
  | "saving"
  | "offline"
  | "rejected"
  | "preview";

/* ------------------------------------------------------------------ */
/* Status, as its own tiny external store                              */
/* ------------------------------------------------------------------ */

let status: SyncStatus = "local";
let savedAt: string | null = null;
const statusListeners = new Set<() => void>();

/**
 * One frozen snapshot object, swapped on change.
 *
 * `useSyncExternalStore` compares snapshots by reference, and a fresh object per
 * call is an infinite render loop — the same trap `use-plan.ts` documents for
 * its live fares.
 */
let snapshot: Readonly<{ status: SyncStatus; savedAt: string | null }> =
  Object.freeze({ status, savedAt });

function setStatus(next: SyncStatus, at: string | null = savedAt) {
  if (next === status && at === savedAt) return;
  status = next;
  savedAt = at;
  snapshot = Object.freeze({ status, savedAt });
  for (const listener of statusListeners) listener();
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export const readSyncStatus = () => snapshot;

const SERVER_STATUS = Object.freeze({
  status: "local" as SyncStatus,
  savedAt: null,
});
export const readSyncStatusOnServer = () => SERVER_STATUS;

/* ------------------------------------------------------------------ */
/* The store                                                           */
/* ------------------------------------------------------------------ */

export interface RemoteStoreOptions {
  planId: string;
  /** Read fresh each time: the key can arrive after the store is built. */
  getEditKey: () => string | null;
}

/**
 * Pull the Plan down again, overwriting what this tab holds.
 *
 * One caller: adopt. The server has just appended a Scenario the browser knows
 * nothing about, and re-reading is both simpler and more honest than patching
 * the local copy to match what the route *probably* did.
 *
 * Null until the remote store is built, so a local-only tab calling it is a
 * no-op rather than a crash.
 */
let refresh: (() => Promise<void>) | null = null;

export async function refreshPlanFromServer(): Promise<void> {
  await refresh?.();
}

/**
 * Throw away a view-mode preview and go back to the couple's Plan.
 *
 * The same re-read as `refreshPlanFromServer`, under the name the visitor's
 * button means — and the only way back, since the preview overwrote the tab's
 * localStorage on its way through. A reload would do it too; a button says so
 * out loud.
 */
export async function discardPreview(): Promise<void> {
  await refresh?.();
}

export function remoteScenarioStore(
  local: ScenarioStore,
  { planId, getEditKey }: RemoteStoreOptions,
): ScenarioStore {
  let editedLocally = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function hydrate(force = false) {
    setStatus("loading");
    try {
      const response = await fetch(`/api/plan/${planId}`, { cache: "no-store" });
      if (!response.ok) {
        setStatus(response.status === 404 ? "local" : "offline");
        return;
      }
      const body = (await response.json()) as { plan?: unknown };
      const plan = toPlanDoc(body.plan);
      // The traveller got there first. Their edit is the one to keep — unless
      // this is the deliberate re-read after an adopt, which is asking for the
      // server's copy precisely because it now has something the tab lacks.
      if (editedLocally && !force) {
        setStatus("synced");
        return;
      }
      local.write({ scenarios: plan.scenarios, currentId: plan.currentId });
      setStatus("synced", plan.updatedAt);
    } catch {
      // No network, or a Vercel deployment-protection redirect standing in
      // front of the API. Either way: local-only, and the site still works.
      setStatus("offline");
    }
  }

  async function push(state: ScenarioState, keepalive = false) {
    const editKey = getEditKey();
    // Belt and braces: `write` already turns a keyless edit into a preview, and
    // an unguarded push would be a request the route can only answer with 403.
    if (!editKey) {
      setStatus("preview");
      return;
    }
    setStatus("saving");
    try {
      const response = await fetch(`/api/plan/${planId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          [EDIT_KEY_HEADER]: editKey,
        },
        body: JSON.stringify(state),
        keepalive,
      });
      if (response.status === 403) {
        // The key is wrong or has been rotated. Say so rather than spinning on
        // "saving" forever — the traveller needs to know their edits are local.
        setStatus("rejected");
        return;
      }
      if (!response.ok) {
        setStatus("offline");
        return;
      }
      const body = (await response.json()) as { plan?: PlanDoc };
      setStatus("synced", body.plan?.updatedAt ?? new Date().toISOString());
    } catch {
      setStatus("offline");
    }
  }

  function schedulePush() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void push(local.read());
    }, SAVE_DEBOUNCE_MS);
  }

  // A closing tab must not take an unsaved drag with it. `pagehide` is the one
  // event iOS Safari reliably fires, and `keepalive` lets the request outlive
  // the document.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      void push(local.read(), true);
    });
  }

  refresh = async () => {
    // The tab is asking for the server's copy on purpose — as an adopt, or as a
    // visitor discarding their preview — so its own edits stop counting.
    editedLocally = false;
    await hydrate(true);
  };
  void hydrate();

  return {
    kind: "remote",
    read: () => local.read(),
    subscribe: (listener) => local.subscribe(listener),
    write(state) {
      editedLocally = true;
      // The write always lands locally, in every mode. That is the whole shape
      // of this store — localStorage is where the state lives — and it is what
      // makes a view-mode edit a working preview rather than a dead click.
      local.write(state);

      if (!getEditKey()) {
        // …but it stops here. Saying so is the point: the visitor gets their
        // recomputed total *and* the news that it is theirs alone.
        setStatus("preview");
        return;
      }
      schedulePush();
    },
  };
}
