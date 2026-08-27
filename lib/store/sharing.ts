"use client";

/**
 * The browser's whole view of sharing: which link this tab arrived on, and the
 * three things it can do about it.
 *
 * ADR 0001 gives the site two links and one button. The link the tab holds
 * decides the mode — a plain URL is **view**, `#edit=<key>` is **edit**, and no
 * reachable server at all is **local**, which is the site working exactly as it
 * did before #30. The button is Fork, and it is the only write a visitor has.
 *
 * ## Boot
 *
 * Two things happen once, at module load, before any component renders:
 * the edit key is lifted out of the URL fragment and stored, and the Scenario
 * store is swapped for the server-synced wrapper. Doing it here rather than in
 * an effect means the first paint already knows which mode it is in — a view-mode
 * visitor never sees an edit affordance flash and disappear.
 *
 * Both are no-ops on the server and when the Plan has not been bootstrapped,
 * which is what keeps `npm run dev` working on a fresh clone with no store.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { installScenarioStore } from "@/lib/engine/scenarios";
import type { PlanInput } from "@/lib/engine/types";
import {
  CANONICAL_PLAN_ID,
  FORK_QUERY_PARAM,
  forkShareUrl,
} from "@/lib/store/canonical-plan";
import { captureEditKey, readEditKey } from "@/lib/store/edit-key";
import { EDIT_KEY_HEADER } from "@/lib/store/guards";
import {
  readSyncStatus,
  readSyncStatusOnServer,
  refreshPlanFromServer,
  remoteScenarioStore,
  subscribeSyncStatus,
  type SyncStatus,
} from "@/lib/store/remote-store";

/** What a visitor's Fork looks like once it has come back off the wire. */
export interface ForkView {
  forkId: string;
  name: string;
  authorNote?: string;
  createdAt: string;
}

export type ShareMode = "local" | "view" | "edit";

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

let editKey: string | null = null;

if (typeof window !== "undefined") {
  editKey = captureEditKey();
  if (CANONICAL_PLAN_ID) {
    installScenarioStore((local) =>
      remoteScenarioStore(local, {
        planId: CANONICAL_PLAN_ID,
        // Read through rather than captured: the key is already in hand here,
        // but a tab that stores it later should start saving without a reload.
        getEditKey: () => editKey ?? readEditKey(),
      }),
    );
  }
}

/** Whether this tab holds the edit link. Safe to call during render. */
export function isEditor(): boolean {
  return Boolean(CANONICAL_PLAN_ID) && Boolean(editKey);
}

/** Nothing to subscribe to: these facts are fixed for the life of the tab. */
const subscribeNever = () => () => undefined;
const readOrigin = () => window.location.origin;
const readNoOrigin = () => "";
const readNotEditor = () => false;

function forkIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(
    FORK_QUERY_PARAM,
  );
  return value && value.length > 0 ? value : null;
}

/* ------------------------------------------------------------------ */
/* The hook                                                            */
/* ------------------------------------------------------------------ */

export interface SharingApi {
  mode: ShareMode;
  status: SyncStatus;
  /** ISO instant of the last accepted server write, if there has been one. */
  savedAt: string | null;
  /** The link to hand to a friend. Read-only, and the current page's origin. */
  viewLink: string;
  /** The Fork this tab was opened on, if it was opened on one. */
  visiting: ForkView | null;
  /** Save the current Scenario as a Fork and get its shareable URL. */
  saveFork: (
    name: string,
    input: PlanInput,
    authorNote?: string,
  ) => Promise<string | null>;
  /** Copy the visited Fork into the Plan. Edit mode only. */
  adopt: (forkId: string) => Promise<boolean>;
}

export function useSharing(): SharingApi {
  const sync = useSyncExternalStore(
    subscribeSyncStatus,
    readSyncStatus,
    readSyncStatusOnServer,
  );

  // Two client-only facts, read through `useSyncExternalStore` rather than set
  // in an effect. Neither ever changes after boot, so there is nothing to
  // subscribe to — but the server snapshot is what keeps the markup React
  // renders on the server identical to the markup it hydrates, and an effect
  // that called `setState` would be a cascading render for a constant.
  const origin = useSyncExternalStore(subscribeNever, readOrigin, readNoOrigin);
  const editing = useSyncExternalStore(subscribeNever, isEditor, readNotEditor);
  const [visiting, setVisiting] = useState<ForkView | null>(null);

  // Fetch the Fork this tab was opened on, once. A Fork that has been deleted
  // or was never real leaves `visiting` null and the page behaves as a plain
  // view — a dead link should not be an error screen.
  useEffect(() => {
    const forkId = forkIdFromUrl();
    if (!forkId || !CANONICAL_PLAN_ID) return;
    let live = true;
    void (async () => {
      try {
        const response = await fetch(
          `/api/plan/${CANONICAL_PLAN_ID}/fork/${forkId}`,
          { cache: "no-store" },
        );
        if (!response.ok || !live) return;
        const body = (await response.json()) as {
          forkId?: string;
          fork?: { name?: string; authorNote?: string; createdAt?: string };
        };
        if (!live || !body.fork) return;
        setVisiting({
          forkId,
          name: body.fork.name ?? "Untitled fork",
          ...(body.fork.authorNote ? { authorNote: body.fork.authorNote } : {}),
          createdAt: body.fork.createdAt ?? "",
        });
      } catch {
        // Offline. The Plan still renders from localStorage.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const saveFork = useCallback(
    async (name: string, input: PlanInput, authorNote?: string) => {
      if (!CANONICAL_PLAN_ID) return null;
      try {
        const response = await fetch(`/api/plan/${CANONICAL_PLAN_ID}/fork`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, planInput: input, authorNote }),
        });
        if (!response.ok) return null;
        const body = (await response.json()) as { forkId?: string };
        if (!body.forkId) return null;
        return forkShareUrl(window.location.origin, body.forkId);
      } catch {
        return null;
      }
    },
    [],
  );

  const adopt = useCallback(async (forkId: string) => {
    const key = readEditKey();
    if (!CANONICAL_PLAN_ID || !key) return false;
    try {
      const response = await fetch(`/api/plan/${CANONICAL_PLAN_ID}/adopt`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [EDIT_KEY_HEADER]: key,
        },
        body: JSON.stringify({ forkId }),
      });
      if (!response.ok) return false;
      // The Plan now holds a Scenario this tab has never seen. Re-read rather
      // than guess at what the route did.
      await refreshPlanFromServer();
      return true;
    } catch {
      return false;
    }
  }, []);

  const mode: ShareMode = !CANONICAL_PLAN_ID
    ? "local"
    : editing
      ? "edit"
      : "view";

  return {
    mode,
    status: sync.status,
    savedAt: sync.savedAt,
    viewLink: origin ? `${origin}/` : "",
    visiting,
    saveFork,
    adopt,
  };
}
