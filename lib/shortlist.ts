"use client";

/**
 * Shortlist state — the Travellers' verdict on each Catalog idea.
 *
 * Four states from docs/CONTEXT.md: every idea is *unseen* until someone
 * marks it *interested* (on the bench, no calendar days yet), *discarded*, or
 * *placed* (on the Plan). Only the marks are stored — unseen is the absence of
 * a mark, so the payload stays small however long the sift runs.
 *
 * Persistence is localStorage, deliberately: there are no accounts, and a sift
 * session that survives a refresh is worth more than one that syncs. Every
 * access is wrapped — Safari private mode throws on read, a full quota throws
 * on write — and the marks stay in memory either way, so the drawer works with
 * storage switched off. It just won't outlive the tab.
 *
 * The marks live in a module-level store rather than component state so the
 * two mounted drawers (desktop rail, mobile overlay) and any other tab all
 * read the same shortlist.
 */

import { useSyncExternalStore } from "react";

import { setToggled } from "@/lib/engine/scenarios";

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

const EMPTY: ShortlistMap = {};

function isMarked(value: unknown): value is MarkedState {
  return (
    typeof value === "string" && MARKED_STATES.includes(value as MarkedState)
  );
}

function parse(raw: string | null): ShortlistMap {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const clean: Record<string, MarkedState> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (isMarked(value)) clean[id] = value;
    }
    return clean;
  } catch {
    return EMPTY;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// useSyncExternalStore compares snapshots by reference, so the parsed map is
// cached against the raw string it came from and only rebuilt when that
// changes — including when another tab writes it.
let cachedRaw: string | null = null;
let cachedMarks: ShortlistMap = EMPTY;

function getSnapshot(): ShortlistMap {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedMarks = parse(raw);
  }
  return cachedMarks;
}

function getServerSnapshot(): ShortlistMap {
  return EMPTY;
}

const listeners = new Set<() => void>();

function onStorageEvent(event: StorageEvent) {
  if (event.key === null || event.key === STORAGE_KEY) {
    for (const listener of listeners) listener();
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorageEvent);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorageEvent);
    }
  };
}

/** Marking with the state an idea already has clears it back to unseen. */
function setMark(id: string, state: MarkedState): void {
  const current = getSnapshot();
  const next = { ...current };
  if (next[id] === state) delete next[id];
  else next[id] = state;

  const raw = JSON.stringify(next);
  // Cache first: if storage is unavailable the session still gets its marks.
  cachedRaw = raw;
  cachedMarks = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    cachedRaw = null;
  }
  for (const listener of listeners) listener();

  // Membership follows the verdict, into the Scenario that carries it. The
  // marks above are this browser's; the Scenario is the couple's Plan and the
  // thing a Fork copies, so "on the Plan" has to be written there too — see
  // `lib/engine/membership.ts` for why the two are not merged with a union.
  //
  // Ordering matters: the marks are published first so the sift UI repaints
  // from the verdict it was given, and the Plan rebuild follows on the same
  // tick from a store React is separately subscribed to.
  setToggled(id, next[id] === "placed");
}

export interface ShortlistCounts {
  interested: number;
  placed: number;
  discarded: number;
}

export interface Shortlist {
  marks: ShortlistMap;
  counts: ShortlistCounts;
  toggle: (id: string, state: MarkedState) => void;
}

export function countMarks(marks: ShortlistMap): ShortlistCounts {
  const tally: ShortlistCounts = { interested: 0, placed: 0, discarded: 0 };
  for (const state of Object.values(marks)) tally[state] += 1;
  return tally;
}

export function useShortlist(): Shortlist {
  const marks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // `setMark` is module-level, so the rows' memoisation holds across renders.
  return { marks, counts: countMarks(marks), toggle: setMark };
}
