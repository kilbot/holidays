/**
 * Static Catalog slice for the shell.
 *
 * Ten real entries lifted from the research in `docs/research/` — the seven
 * deep-researched Capsules plus three Catalog ideas that show the shortlist
 * states the full sift will need. Costs are the per-couple EUR figures the
 * capsule docs settled on (FX A$1 = €0.61); ranged Catalog ideas are quoted
 * at the middle of their AUD band.
 *
 * Nothing here is wired to state yet — #26 replaces this module with the real
 * Catalog and makes the toggles mean something.
 */

export type SeasonFit = "good" | "ok" | "warning";

export interface CatalogEntry {
  id: string;
  name: string;
  /** Base, region, or shape — the one line under the name. */
  where: string;
  /** Ideal duration as the capsule docs state it. */
  duration: string;
  /** Ideal cost per couple, EUR. */
  costEur: number;
  /** True when the Capsule is currently on the Plan. */
  onPlan: boolean;
  /** Filter facets — these are the chip ids this entry answers to. */
  facets: FacetId[];
  season: SeasonFit;
  /** Set when the entry carries a Lock or a Warning worth surfacing. */
  flag?: { label: string; tone: "warn" | "over" | "lock" };
  /** Where the number came from, for the detail card in #26. */
  source: string;
}

export type FacetId =
  | "her-picks"
  | "season"
  | "music"
  | "food"
  | "outdoors"
  | "city"
  | "wildlife";

export interface Facet {
  id: FacetId;
  label: string;
  /** Chips start pre-selected where the demo Plan implies them. */
  active: boolean;
}

export const CATALOG_FACETS: Facet[] = [
  { id: "her-picks", label: "her picks", active: true },
  { id: "season", label: "good season", active: true },
  { id: "music", label: "music", active: false },
  { id: "food", label: "food", active: false },
  { id: "outdoors", label: "outdoors", active: false },
  { id: "city", label: "city", active: false },
  { id: "wildlife", label: "wildlife", active: false },
];

export const CATALOG_ENTRIES: CatalogEntry[] = [
  {
    id: "great-barrier-reef",
    name: "Great Barrier Reef",
    where: "Port Douglas",
    duration: "5 nights",
    costEur: 2560,
    onPlan: true,
    facets: ["outdoors", "wildlife", "season"],
    season: "good",
    flag: { label: "from 18 Jan", tone: "lock" },
    source: "docs/research/capsule-great-barrier-reef.md",
  },
  {
    id: "margaret-river",
    name: "Margaret River",
    where: "WA south-west, from the Perth home base",
    duration: "3 nights",
    costEur: 1375,
    onPlan: true,
    facets: ["food", "outdoors", "season"],
    season: "ok",
    flag: { label: "school holidays", tone: "warn" },
    source: "docs/research/capsule-wa-southwest.md",
  },
  {
    id: "rottnest-island",
    name: "Rottnest Island",
    where: "Day trip via Fremantle",
    duration: "1 day",
    costEur: 215,
    onPlan: true,
    facets: ["outdoors", "wildlife", "season"],
    season: "good",
    source: "docs/research/capsule-wa-southwest.md",
  },
  {
    id: "sydney-nye",
    name: "Sydney New Year's Eve",
    where: "Sydney, on a train line",
    duration: "6 nights",
    costEur: 2140,
    onPlan: true,
    facets: ["city", "music", "her-picks"],
    season: "good",
    flag: { label: "date-locked · 31 Dec", tone: "over" },
    source: "docs/research/capsule-sydney-nye.md",
  },
  {
    id: "byron-nimbin",
    name: "Byron + Nimbin",
    where: "Northern Rivers, in via OOL",
    duration: "5 nights",
    costEur: 1070,
    onPlan: true,
    facets: ["her-picks", "outdoors", "food", "season"],
    season: "good",
    source: "docs/research/capsule-byron-nimbin.md",
  },
  {
    id: "tasmania-arc",
    name: "Tasmania arc",
    where: "Hobart → Launceston, one way",
    duration: "9 nights",
    costEur: 3460,
    onPlan: true,
    facets: ["outdoors", "food", "her-picks"],
    season: "good",
    flag: { label: "car fleet sells out", tone: "warn" },
    source: "docs/research/capsule-tasmania.md",
  },
  {
    id: "melbourne-finale",
    name: "Melbourne finale",
    where: "Fitzroy / Collingwood",
    duration: "4 nights",
    costEur: 1040,
    onPlan: true,
    facets: ["city", "music", "food"],
    season: "good",
    flag: { label: "Laneway 19 Feb", tone: "lock" },
    source: "docs/research/capsule-melbourne.md",
  },
  {
    id: "mon-repos-turtles",
    name: "Mon Repos turtles",
    where: "Bundaberg rookery, ranger tour",
    duration: "2 days",
    costEur: 120,
    onPlan: false,
    facets: ["wildlife", "outdoors", "season"],
    season: "good",
    flag: { label: "season unlock · late Jan", tone: "lock" },
    source: "docs/research/capsule-catalog/qld.json",
  },
  {
    id: "bremer-bay-orcas",
    name: "Bremer Bay orcas",
    where: "WA Great Southern, 70 km offshore",
    duration: "3 days",
    costEur: 730,
    onPlan: false,
    facets: ["wildlife", "outdoors", "season"],
    season: "good",
    flag: { label: "Jan onward", tone: "lock" },
    source: "docs/research/capsule-catalog/wa-sa.json",
  },
  {
    id: "woodford-folk-festival",
    name: "Woodford Folk Festival",
    where: "Woodfordia, Sunshine Coast hinterland",
    duration: "6 days",
    costEur: 825,
    onPlan: false,
    facets: ["her-picks", "music", "food"],
    season: "good",
    flag: { label: "collides: Sydney NYE", tone: "over" },
    source: "docs/research/capsule-catalog/qld.json",
  },
];

/** The full Catalog behind this slice — shown in the drawer header. */
export const CATALOG_TOTAL_IDEAS = 413;
