/**
 * The sift, as data.
 *
 * Everything the Capsules page filters *with*, separated from everything it
 * filters *into pixels*. Three things needed one home rather than three:
 *
 * 1. The filter set has to survive a URL round trip — a filtered view is
 *    shareable, so `?q=reef&f=beach&r=QLD` has to mean the same thing on
 *    someone else's screen. Encode and decode belong next to the shape they
 *    read and write, or they drift.
 * 2. Two tiers are sifted by the same controls. The eight researched Capsules
 *    are not Catalog entries — different module, different fields — but a
 *    traveller who types "reef" means both. `SiftCandidate` is the small
 *    projection both tiers can answer to, so there is exactly one predicate
 *    rather than one per tier that has to be kept in step.
 * 3. It is pure. No React, no DOM: the whole thing is string and number
 *    comparisons over 421 rows, which is what lets the grid re-filter on every
 *    keystroke without a debounce.
 */

import type { CatalogIdea, SeasonFit } from "@/lib/catalog";
import { SEASON_RANK } from "@/lib/catalog";
import type { DeepCapsule } from "@/lib/deep-capsules";
import { capsuleState } from "@/lib/deep-capsules";
import type { FacetId } from "@/lib/facets";
import { FACETS } from "@/lib/facets";
import type { ShortlistMap } from "@/lib/shortlist";

/** Which shelf of the shortlist is on show. */
export type ShelfId = "open" | "unseen" | "interested" | "placed" | "discarded";

const SHELF_IDS: readonly ShelfId[] = [
  "open",
  "unseen",
  "interested",
  "placed",
  "discarded",
];

const SEASON_FITS: readonly SeasonFit[] = ["good", "ok", "poor", "no"];

/**
 * Slider stops rather than a linear range: 284 of the 413 are one-day ideas,
 * so a linear 1–90 slider would spend 95% of its travel on eight entries.
 */
export const DAY_STOPS: readonly number[] = [1, 2, 3, 4, 5, 7, 10, 14, Infinity];

/**
 * EUR, top of the entry's band. Stops bunch where the Catalog bunches: half of
 * it tops out under €215, and 23 entries carry the long tail.
 */
export const COST_STOPS: readonly number[] = [
  25, 50, 100, 150, 200, 300, 400, 600, 800, 1200, 1800, 2500, Infinity,
];

export interface CatalogFilters {
  /** Free text, matched as a substring against the entry's haystack. */
  query: string;
  /** OR, not AND — chips gather rather than narrow. */
  facets: FacetId[];
  /** "QLD", "Cross-state" — the bit before the em dash in a region. */
  states: string[];
  seasons: SeasonFit[];
  /** Longest stay to show. `Infinity` is "any". */
  maxDays: number;
  /** Cost ceiling in EUR, per couple. `Infinity` is "any". */
  maxCost: number;
  shelf: ShelfId;
}

export const NO_FILTERS: CatalogFilters = {
  query: "",
  facets: [],
  states: [],
  seasons: [],
  maxDays: Infinity,
  maxCost: Infinity,
  shelf: "open",
};

/* ------------------------------------------------------------------ */
/* The URL                                                             */
/* ------------------------------------------------------------------ */

/**
 * The reading half of the URL contract. Deliberately typed against the one
 * method both `URLSearchParams` and Next's `ReadonlyURLSearchParams` share, so
 * the same decoder serves a live page and a plain string.
 */
export interface ReadableParams {
  get(key: string): string | null;
}

/** Short keys, because a shared Catalog link should still fit in a message. */
const KEY = {
  query: "q",
  facets: "f",
  states: "r",
  seasons: "s",
  days: "d",
  cost: "c",
  shelf: "shelf",
} as const;

const FACET_IDS = new Set<string>(FACETS.map((facet) => facet.id));

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * A ceiling as it appears in the URL — a real number, not a slider index, so
 * the link keeps meaning what it says if the stops are ever re-cut. Anything
 * unparseable, or a number no stop offers, snaps up to the nearest stop.
 */
function decodeCeiling(raw: string | null, stops: readonly number[]): number {
  if (!raw) return Infinity;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return Infinity;
  return stops.find((stop) => stop >= value) ?? Infinity;
}

export function decodeFilters(params: ReadableParams): CatalogFilters {
  const shelf = params.get(KEY.shelf);
  return {
    query: params.get(KEY.query) ?? "",
    facets: splitList(params.get(KEY.facets)).filter((id): id is FacetId =>
      FACET_IDS.has(id),
    ),
    states: splitList(params.get(KEY.states)),
    seasons: splitList(params.get(KEY.seasons)).filter(
      (fit): fit is SeasonFit => SEASON_FITS.includes(fit as SeasonFit),
    ),
    maxDays: decodeCeiling(params.get(KEY.days), DAY_STOPS),
    maxCost: decodeCeiling(params.get(KEY.cost), COST_STOPS),
    shelf: SHELF_IDS.includes(shelf as ShelfId) ? (shelf as ShelfId) : "open",
  };
}

/**
 * The query string for a filter set, without the leading `?`. Defaults are
 * omitted, so an unfiltered Catalog has a clean URL and the browser's address
 * bar stays quiet until the traveller actually sifts.
 */
export function encodeFilters(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set(KEY.query, filters.query);
  if (filters.facets.length > 0) {
    params.set(KEY.facets, filters.facets.join(","));
  }
  if (filters.states.length > 0) params.set(KEY.states, filters.states.join(","));
  if (filters.seasons.length > 0) {
    params.set(KEY.seasons, filters.seasons.join(","));
  }
  if (Number.isFinite(filters.maxDays)) {
    params.set(KEY.days, String(filters.maxDays));
  }
  if (Number.isFinite(filters.maxCost)) {
    params.set(KEY.cost, String(filters.maxCost));
  }
  if (filters.shelf !== "open") params.set(KEY.shelf, filters.shelf);
  return params.toString();
}

/** How many of the four narrowing controls are set. Drives the "· 3" badge. */
export function narrowingCount(filters: CatalogFilters): number {
  return (
    filters.states.length +
    filters.seasons.length +
    (Number.isFinite(filters.maxDays) ? 1 : 0) +
    (Number.isFinite(filters.maxCost) ? 1 : 0)
  );
}

/** Whether anything at all has been done to the Catalog. Drives Reset. */
export function isSifted(filters: CatalogFilters): boolean {
  return (
    narrowingCount(filters) > 0 ||
    filters.facets.length > 0 ||
    filters.query !== "" ||
    filters.shelf !== "open"
  );
}

/* ------------------------------------------------------------------ */
/* The predicate                                                       */
/* ------------------------------------------------------------------ */

/**
 * The fields a filter actually touches, from either tier.
 *
 * `costCeiling` is the number the cost slider compares against, and the two
 * tiers pick it differently on purpose: a Catalog idea offers the top of its
 * rough band (the honest worst case for a figure the sweep guessed), a
 * researched Capsule offers its *ideal* cost, because that is the figure the
 * research argues for and the one the card puts on screen.
 */
export interface SiftCandidate {
  id: string;
  state: string;
  seasonFit: SeasonFit;
  daysMin: number;
  costCeiling: number;
  facets: readonly FacetId[];
  /** Lowercased blob of everything worth searching. */
  haystack: string;
}

export function candidateFromIdea(idea: CatalogIdea): SiftCandidate {
  return {
    id: idea.id,
    state: idea.state,
    seasonFit: idea.season_fit_dec_feb,
    daysMin: idea.days_min,
    costCeiling: idea.costEurMax,
    facets: idea.facets,
    haystack: idea.haystack,
  };
}

export function candidateFromCapsule(capsule: DeepCapsule): SiftCandidate {
  return {
    id: capsule.id,
    state: capsuleState(capsule),
    seasonFit: capsule.seasonFit,
    daysMin: capsule.days.min,
    costCeiling: capsule.cost.ideal.eur,
    facets: capsule.facets,
    haystack: [
      capsule.name,
      capsule.region,
      capsule.tagline,
      capsule.tags.join(" "),
      capsule.why,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

/**
 * One entry against one filter set.
 *
 * `needle` is passed in already trimmed and lowercased rather than derived per
 * call — this runs 421 times per keystroke and the trim is the only part of it
 * that allocates.
 */
export function matchesFilters(
  candidate: SiftCandidate,
  filters: CatalogFilters,
  marks: ShortlistMap,
  needle: string,
): boolean {
  const mark = marks[candidate.id];
  if (filters.shelf === "open") {
    if (mark === "discarded") return false;
  } else if (filters.shelf === "unseen") {
    if (mark) return false;
  } else if (mark !== filters.shelf) {
    return false;
  }

  if (needle && !candidate.haystack.includes(needle)) return false;
  if (filters.states.length > 0 && !filters.states.includes(candidate.state)) {
    return false;
  }
  if (
    filters.seasons.length > 0 &&
    !filters.seasons.includes(candidate.seasonFit)
  ) {
    return false;
  }
  if (candidate.daysMin > filters.maxDays) return false;
  if (candidate.costCeiling > filters.maxCost) return false;
  if (
    filters.facets.length > 0 &&
    !filters.facets.some((facet) => candidate.facets.includes(facet))
  ) {
    return false;
  }
  return true;
}

export function searchNeedle(filters: CatalogFilters): string {
  return filters.query.trim().toLowerCase();
}

/**
 * The Catalog, sifted and ordered.
 *
 * One order, always: the ideas that suit a December-to-February trip float,
 * and ties break alphabetically. Nothing re-ranks behind the traveller's back.
 */
export function siftCatalog(
  catalog: readonly CatalogIdea[],
  filters: CatalogFilters,
  marks: ShortlistMap,
): CatalogIdea[] {
  const needle = searchNeedle(filters);
  return catalog
    .filter((idea) =>
      matchesFilters(candidateFromIdea(idea), filters, marks, needle),
    )
    .toSorted(
      (a, b) =>
        SEASON_RANK[a.season_fit_dec_feb] - SEASON_RANK[b.season_fit_dec_feb] ||
        a.name.localeCompare(b.name),
    );
}

/**
 * The researched Capsules, sifted by the same controls but never re-ordered:
 * they are published in trip order and that order is content, not a ranking
 * the sift is entitled to touch.
 */
export function siftDeepCapsules(
  capsules: readonly DeepCapsule[],
  filters: CatalogFilters,
  marks: ShortlistMap,
): DeepCapsule[] {
  const needle = searchNeedle(filters);
  return capsules.filter((capsule) =>
    matchesFilters(candidateFromCapsule(capsule), filters, marks, needle),
  );
}
