/**
 * The Catalog — 413 Capsule ideas, mined in bulk and sifted in the browser.
 *
 * `catalog.json` is the same file the research sweep produced
 * (docs/research/capsule-catalog/catalog.json), copied here so it imports as a
 * module. It ships to the client: it is public research, the sift has to be
 * instant, and 413 rows is not enough data to earn an API round trip.
 *
 * Everything the sift needs per entry is derived once at module load —
 * state prefix, cost bounds in both currencies, facets, search blob — so the
 * filter pass over 413 rows is string and number comparisons only.
 */

import { facetsForTags, warningTagsFor, type FacetId } from "@/lib/facets";

import catalogFile from "./catalog.json";

/** A$1 in EUR. Same rate the capsule research and the cost HUD quote. */
export const AUD_TO_EUR = 0.61;

export type SeasonFit = "good" | "ok" | "poor" | "no";
export type CostConfidence = "low" | "medium" | "high";

/** An entry exactly as `catalog.json` states it — all 13 fields. */
export interface CatalogEntry {
  id: string;
  name: string;
  /** Free-form, but always "STATE — subregion / place". */
  region: string;
  /** Lowercase-kebab, 168 distinct values across the Catalog. */
  tags: string[];
  /** Shortest visit that is still worth the trip. 0 = not a place. */
  days_min: number;
  /** What the research recommends. */
  days_ideal: number;
  /** AUD per couple, "900-1600" or "0". */
  rough_cost_couple_aud: string;
  cost_confidence: CostConfidence;
  /** Judged against Dec 2026 – mid Feb 2027. */
  season_fit_dec_feb: SeasonFit;
  season_note: string;
  why_rated: string;
  /** IATA code of the nearest airport. */
  nearest_airport: string;
  sources: string[];
}

/** An entry plus the fields the sift filters and sorts on. */
export interface CatalogIdea extends CatalogEntry {
  /** "WA", "NSW", "Cross-state" — the bit before the em dash in `region`. */
  state: string;
  /** The bit after it: "Northern Rivers / Mullumbimby". */
  where: string;
  costAudMin: number;
  costAudMax: number;
  costEurMin: number;
  costEurMax: number;
  facets: FacetId[];
  /** Caveat tags, most specific first. Empty for most entries. */
  warnings: string[];
  /** name + region + tags + why_rated, lowercased, for substring search. */
  haystack: string;
}

interface CatalogFile {
  generated: string;
  entry_count: number;
  entries: CatalogEntry[];
}

const file = catalogFile as unknown as CatalogFile;

const SEASON_FITS: readonly SeasonFit[] = ["good", "ok", "poor", "no"];

export const SEASON_LABEL: Record<SeasonFit, string> = {
  good: "in season",
  ok: "workable",
  poor: "degraded",
  no: "wrong window",
};

/** The colour each season fit borrows from the Southbound signal tokens. */
export const SEASON_TOKEN: Record<SeasonFit, string> = {
  good: "var(--sb-good)",
  ok: "var(--sb-sea)",
  poor: "var(--sb-warn)",
  no: "var(--sb-over)",
};

/** Sort weight — good ideas float, wrong-window ideas sink. */
export const SEASON_RANK: Record<SeasonFit, number> = {
  good: 0,
  ok: 1,
  poor: 2,
  no: 3,
};

/** "900-1600" → [900, 1600]; "0" → [0, 0]. */
function parseCostBand(raw: string): [number, number] {
  const parts = raw.split("-").map((part) => Number(part.trim()));
  const clean = parts.filter((n) => Number.isFinite(n));
  if (clean.length === 0) return [0, 0];
  return [clean[0], clean[clean.length - 1]];
}

function derive(entry: CatalogEntry): CatalogIdea {
  const dash = entry.region.indexOf(" — ");
  const [costAudMin, costAudMax] = parseCostBand(entry.rough_cost_couple_aud);
  const facets = facetsForTags(entry.tags);

  return {
    ...entry,
    season_fit_dec_feb: SEASON_FITS.includes(entry.season_fit_dec_feb)
      ? entry.season_fit_dec_feb
      : "ok",
    state: dash === -1 ? entry.region : entry.region.slice(0, dash),
    where: dash === -1 ? "" : entry.region.slice(dash + 3),
    costAudMin,
    costAudMax,
    costEurMin: Math.round(costAudMin * AUD_TO_EUR),
    costEurMax: Math.round(costAudMax * AUD_TO_EUR),
    facets,
    warnings: warningTagsFor(entry.tags),
    haystack: [entry.name, entry.region, entry.tags.join(" "), entry.why_rated]
      .join(" ")
      .toLowerCase(),
  };
}

export const CATALOG: readonly CatalogIdea[] = file.entries.map(derive);

export const CATALOG_GENERATED = file.generated;

const CATALOG_BY_ID = new Map(CATALOG.map((idea) => [idea.id, idea]));

/** One idea by id. The detail card and the cross-links between ideas need it. */
export function catalogIdeaById(id: string): CatalogIdea | undefined {
  return CATALOG_BY_ID.get(id);
}

/** The states, most-entries first, for the region chips. */
export const CATALOG_STATES: readonly string[] = (() => {
  const counts = new Map<string, number>();
  for (const idea of CATALOG) {
    counts.set(idea.state, (counts.get(idea.state) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([state]) => state);
})();

/** "€550–980", "€120", "free". Bands are wide; a single figure would lie. */
export function formatEurBand(idea: CatalogIdea): string {
  if (idea.costEurMax === 0) return "free";
  if (idea.costEurMin === idea.costEurMax) return `€${idea.costEurMin}`;
  return `€${idea.costEurMin}–${idea.costEurMax}`;
}

/** What the row's caveat badge says, or null when there is nothing to flag. */
export function warningLabel(idea: CatalogIdea): string | null {
  const first = idea.warnings[0];
  if (!first) return null;
  if (first === "warning" || first === "negative-information") return "caveat";
  return first.replace(/-/g, " ");
}

/** "2–4 days", "1 day", "half a year" for the Big Lap. */
export function formatDays(idea: CatalogIdea): string {
  const { days_min: min, days_ideal: ideal } = idea;
  if (ideal === 0 && min === 0) return "no fixed length";
  if (ideal >= 90) return `${Math.round(ideal / 30)} months`;
  if (min === ideal || min === 0)
    return ideal === 1 ? "1 day" : `${ideal} days`;
  return `${min}–${ideal} days`;
}
