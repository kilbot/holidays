/**
 * Topical facets over the Catalog's free-form tags.
 *
 * The 415 entries carry 168 lowercase-kebab tags between them — too many to
 * put in front of the Travellers, and too specific to sift with ("sandblow",
 * "pearling", "glow-worms"). Each facet below is a named constant listing the
 * tags that feed it, read off the actual vocabulary in `catalog.json` rather
 * than guessed: every tag named here appears in the data.
 *
 * Facets deliberately overlap — a bush doof is `music` AND `hippie` AND
 * `festival`, and that is the honest answer. Selecting several facets is an
 * OR, so the chips widen the list rather than narrowing it to nothing.
 *
 * Tags left out of every facet are the ones that describe logistics or
 * flavour rather than a topic (`day-trip`, `cheap`, `underrated`, `remote`,
 * `bucket-list`, `heritage`, `quirky`, `date-locked`, …). Those stay
 * searchable; they just don't earn a chip.
 */

export type FacetId =
  | "outdoors"
  | "road-trip"
  | "beach"
  | "wildlife"
  | "city"
  | "food"
  | "market"
  | "music"
  | "festival"
  | "hippie"
  | "sport"
  | "warning";

export interface Facet {
  id: FacetId;
  label: string;
  /** The tag names in `catalog.json` that put an entry in this facet. */
  tags: readonly string[];
  /** Which signal token lights the chip when it is on. */
  tone: "accent" | "sea" | "warn";
  /** Shown under the chip row when the facet is the only one selected. */
  hint: string;
}

/** Walking, paddling, climbing and camping — the land half of the outdoors. */
export const FACET_OUTDOORS: Facet = {
  id: "outdoors",
  label: "outdoors",
  tone: "accent",
  hint: "National parks, walks, gorges, waterfalls, camping",
  tags: [
    "national-park",
    "hiking",
    "camping",
    "coastal-walk",
    "waterfall",
    "rainforest",
    "forest",
    "gorge",
    "desert",
    "mountain",
    "alpine",
    "wilderness",
    "swimming-hole",
    "cave",
    "canyoning",
    "kayak",
    "rafting",
    "adventure",
    "4wd",
    "lookout",
    "river",
    "lake",
    "hot-springs",
    "geology",
    "endurance",
    "cycling",
    "horse-riding",
    "skydive",
    "sandboarding",
    "fishing",
  ],
};

/**
 * The journey as the destination: highways, rail and the long crossings.
 * Not on the original facet list, but 95 entries deep and the one CONTEXT.md
 * singles out as carrying value beyond its cost math — leaving it out
 * stranded the Ghan, the Explorers Way and the Nullarbor with no chip at all.
 */
export const FACET_ROAD_TRIP: Facet = {
  id: "road-trip",
  label: "road trip",
  tone: "sea",
  hint: "Highways, rail journeys, ferries and the long crossings",
  tags: [
    "road-trip",
    "scenic-drive",
    "roadside",
    "cross-state",
    "train",
    "ferry",
    "transport",
    "epic",
    "slow-travel",
  ],
};

/** Anything where the water is the point — sand, reef, boat or island. */
export const FACET_BEACH: Facet = {
  id: "beach",
  label: "beach & reef",
  tone: "accent",
  hint: "Sand, snorkelling, reef, islands and boats",
  tags: [
    "beach",
    "coast",
    "swimming",
    "surf",
    "snorkel",
    "diving",
    "reef",
    "coral-cay",
    "island",
    "sailing",
    "boat",
    "waterfront",
  ],
};

/** Animals as the attraction, including the named species tags. */
export const FACET_WILDLIFE: Facet = {
  id: "wildlife",
  label: "wildlife",
  tone: "accent",
  hint: "Animals as the attraction, from quokkas to orcas",
  tags: [
    "wildlife",
    "birds",
    "penguins",
    "platypus",
    "koala",
    "turtles",
    "glow-worms",
    "conservation",
  ],
};

/** Urban culture. `heritage` is left out — it is mostly convict sites,
 *  ghost towns and lighthouses, not city life. */
export const FACET_CITY: Facet = {
  id: "city",
  label: "city",
  tone: "accent",
  hint: "City days, galleries, museums, nightlife",
  tags: [
    "city",
    "museum",
    "art",
    "culture",
    "architecture",
    "multicultural",
    "nightlife",
    "queer",
  ],
};

/** Eating and drinking as the reason to go. Markets get their own facet. */
export const FACET_FOOD: Facet = {
  id: "food",
  label: "food & wine",
  tone: "accent",
  hint: "Wine regions, seafood, food crawls, country pubs",
  tags: ["food", "wine", "seafood", "food-pilgrimage", "beer", "pub"],
};

/** One tag, but a first-class one for this couple — 32 entries and worth its
 *  own chip. */
export const FACET_MARKET: Facet = {
  id: "market",
  label: "markets",
  tone: "accent",
  hint: "Craft, farmers' and night markets",
  tags: ["market"],
};

/** Live music of any genre, including the doof end of the spectrum. */
export const FACET_MUSIC: Facet = {
  id: "music",
  label: "music",
  tone: "accent",
  hint: "Live music — folk, psytrance, techno, festivals",
  tags: [
    "music",
    "doof",
    "psytrance",
    "electronic",
    "techno",
    "folk",
    "reggae",
  ],
};

/** Dated happenings. Most carry `date-locked` too, which the Scheduler reads. */
export const FACET_FESTIVAL: Facet = {
  id: "festival",
  label: "festivals",
  tone: "accent",
  hint: "Festivals and dated events inside the trip window",
  tags: ["festival", "event", "doof", "nye", "australia-day"],
};

/** First-class Event spend for the couple: alternative culture, doofs,
 *  spa and ecovillage country. */
export const FACET_HIPPIE: Facet = {
  id: "hippie",
  label: "hippie",
  tone: "accent",
  hint: "Alternative culture, doofs, hot springs, ecovillages",
  tags: ["hippie", "doof", "psytrance", "wellness", "reggae"],
};

/** A minor shared interest, and a small facet: 20 entries, most of them
 *  cricket. Cheap outings, never a big spend or a relocation driver. */
export const FACET_SPORT: Facet = {
  id: "sport",
  label: "sport",
  tone: "sea",
  hint: "Cricket, tennis, surf and street machines",
  tags: ["sport", "cricket", "tennis", "cars"],
};

/** Not a topic — a caveat. Everything the sweep flagged as wrong season,
 *  closed, overrated, over-priced or legally fraught. Informs, never blocks. */
export const FACET_WARNING: Facet = {
  id: "warning",
  label: "caveats",
  tone: "warn",
  hint: "Flagged: wrong season, closed, overrated or over-priced",
  tags: [
    "warning",
    "negative-information",
    "wrong-season",
    "closed",
    "closed-risk",
    "heat-warning",
    "storm-season",
    "budget-hostile",
    "overrated",
    "uncertain",
    "unpredictable",
    "stale-lore",
    "anchor-conflict",
    "legal-constraint",
    "welfare",
  ],
};

/** Chip order: land, water, road, animals, then culture, then the two
 *  taste chips, with caveats last because it filters *for* problems. */
export const FACETS: readonly Facet[] = [
  FACET_OUTDOORS,
  FACET_BEACH,
  FACET_ROAD_TRIP,
  FACET_WILDLIFE,
  FACET_CITY,
  FACET_FOOD,
  FACET_MARKET,
  FACET_MUSIC,
  FACET_FESTIVAL,
  FACET_HIPPIE,
  FACET_SPORT,
  FACET_WARNING,
];

/** tag → the facets it feeds. Built once; the Catalog derivation hits it 415×. */
const FACETS_BY_TAG: ReadonlyMap<string, readonly FacetId[]> = (() => {
  const index = new Map<string, FacetId[]>();
  for (const facet of FACETS) {
    for (const tag of facet.tags) {
      const bucket = index.get(tag);
      if (bucket) bucket.push(facet.id);
      else index.set(tag, [facet.id]);
    }
  }
  return index;
})();

/** The two caveat tags that say "there is a problem" without saying what. */
const GENERIC_WARNINGS = new Set(["warning", "negative-information"]);

/**
 * The caveat tags an entry carries, specific ones first — the row badge shows
 * the first, and "wrong season" is worth more than a bare "warning".
 */
export function warningTagsFor(tags: readonly string[]): string[] {
  return FACET_WARNING.tags
    .filter((tag) => tags.includes(tag))
    .sort(
      (a, b) =>
        Number(GENERIC_WARNINGS.has(a)) - Number(GENERIC_WARNINGS.has(b)),
    );
}

/** The facets an entry answers to, in FACETS order. */
export function facetsForTags(tags: readonly string[]): FacetId[] {
  const hit = new Set<FacetId>();
  for (const tag of tags) {
    for (const id of FACETS_BY_TAG.get(tag) ?? []) hit.add(id);
  }
  return FACETS.filter((facet) => hit.has(facet.id)).map((facet) => facet.id);
}
