"use client";

/**
 * Shortlist state — the Travellers' verdict on each Catalog idea.
 *
 * Four states from docs/CONTEXT.md: every idea is *unseen* until someone
 * marks it *interested* (on the bench, no calendar days yet), *discarded*, or
 * *placed* (on the Plan). Only the marks are stored — unseen is the absence of
 * a mark, so the payload stays small however long the sift runs.
 *
 * Persistence is localStorage, deliberately: there are no accounts, and a
 * sift session that survives a refresh is worth more than one that syncs.
 * Every access is wrapped — Safari private mode throws on read, a full quota
 * throws on write, and the drawer has to work regardless.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export type ShortlistState = "unseen" | "interested" | "discarded" | "placed";

/** The three states worth writing down. */
export type MarkedState = Exclude<ShortlistState, "unseen">;

export type ShortlistMap = Readonly<Record<string, MarkedState>>;

const STORAGE_KEY = "southbound.shortlist.v1";

const MARKED_STATES: readonly MarkedState[] = [
  "interested",
  "placed",
  "discarded",
];

function isMarked(value: unknown): value is MarkedState {
  return (
    typeof value === "string" && MARKED_STATES.includes(value as MarkedState)
  );
}

function readStored(): ShortlistMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const clean: Record<string, MarkedState> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (isMarked(value)) clean[id] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

function writeStored(map: ShortlistMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // No storage, or no room in it. The session still works, it just won't
    // outlive the tab.
  }
}

export interface ShortlistCounts {
  interested: number;
  placed: number;
  discarded: number;
}

export interface Shortlist {
  marks: ShortlistMap;
  counts: ShortlistCounts;
  /** Marking with the state an idea already has clears it back to unseen. */
  toggle: (id: string, state: MarkedState) => void;
  clear: () => void;
}

export function useShortlist(): Shortlist {
  // Starts empty so the server render and the first client render agree;
  // the stored marks arrive on the effect that follows hydration.
  const [marks, setMarks] = useState<ShortlistMap>({});

  useEffect(() => {
    const stored = readStored();
    if (Object.keys(stored).length > 0) setMarks(stored);
  }, []);

  const toggle = useCallback((id: string, state: MarkedState) => {
    setMarks((current) => {
      const next = { ...current };
      if (next[id] === state) delete next[id];
      else next[id] = state;
      writeStored(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setMarks({});
    writeStored({});
  }, []);

  const counts = useMemo(() => {
    const tally: ShortlistCounts = { interested: 0, placed: 0, discarded: 0 };
    for (const state of Object.values(marks)) tally[state] += 1;
    return tally;
  }, [marks]);

  return { marks, counts, toggle, clear };
}
