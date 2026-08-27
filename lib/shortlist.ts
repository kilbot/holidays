"use client";

/**
 * Shortlist state — the Travellers' verdict on each Catalog idea.
 *
 * Four states from docs/CONTEXT.md: every idea is *unseen* until someone marks
 * it *interested* (on the bench, no calendar days yet), *discarded*, or *placed*
 * (on the Plan). Only the marks are stored — unseen is the absence of a mark, so
 * the payload stays small however long the sift runs.
 *
 * ## Three of the four live here (#58)
 *
 * *Placed* does not. "On the Plan" is the current Scenario's `toggled` list, and
 * this module writes it through on every verdict that bears on it — because
 * membership has to sync to the canonical Plan, travel in a Fork, and be
 * restorable when a visitor discards a preview, and localStorage can do none of
 * those. `lib/engine/membership.ts` carries the argument and the reconciliation;
 * `usePlanShortlist` is what every surface should read.
 *
 * The other three are exactly right here. A bench is one traveller's working
 * set and a discard pile is one traveller's patience; neither is a fact about
 * the trip, and neither should turn up on the other person's phone.
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

import { isToggled, setToggled } from "@/lib/engine/scenarios";

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
      // A *placed* mark can only be one written before #58 moved membership
      // into the Scenario. Read it as *interested* rather than dropping it: the
      // idea lands back on the bench, one click from the Plan, instead of
      // vanishing out of a sift somebody did.
      if (value === "placed") clean[id] = "interested";
      else if (isMarked(value)) clean[id] = value;
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

/**
 * Record a verdict. Marking with the verdict an idea already has clears it.
 *
 * Two things here are load-bearing and both come out of #58.
 *
 * **The Scenario is written through.** *Placed* is not stored as a mark at all:
 * "on the Plan" lives in the current Scenario's `toggled` list, which is what
 * syncs to the canonical Plan, travels in a Fork, and can be *put back* when a
 * visitor discards a preview. `lib/engine/membership.ts` has the argument.
 *
 * **The comparison is against the effective verdict, not the stored one.** The
 * nine researched Adventures are on the Plan with nothing recorded about them,
 * so a first press of *Plan* on one of them has to read as "already placed —
 * take it off" and not as "place it", which would be a click that did nothing.
 * That is the gesture the bug report describes.
 */
function setMark(id: string, state: MarkedState): void {
  const current = getSnapshot();
  const effective: MarkedState | undefined = isToggled(id)
    ? "placed"
    : current[id];
  const clearing = effective === state;

  const next = { ...current };
  // Nothing writes a *placed* mark: it is the Scenario's list, below.
  if (clearing || state === "placed") delete next[id];
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

  // The marks are published first so the sift repaints from the verdict it was
  // given; the Plan rebuild follows on the same tick, from a store React is
  // separately subscribed to.
  setToggled(id, !clearing && state === "placed");
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
