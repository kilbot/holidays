/**
 * Generated placeholder art for Capsules.
 *
 * Every Capsule and every one of the 413 Catalog ideas wants a picture, and
 * there are three ways to get one. Hotlinking scraped photography is fragile
 * (dead links, hotlink blocks) and the rights are unclear. Bundling a photo
 * library means hundreds of megabytes in a repo that is otherwise text. Grey
 * boxes are honest and ugly.
 *
 * So: a deterministic scene, drawn from the entry's own facets, tags and
 * region, with the state set large over it. Not a photograph and not
 * pretending to be one — closer to a book cover than to a stock image. Because
 * it is derived, an entry always has the *same* picture, so the Catalog reads
 * as a set of places rather than a set of shuffling gradients.
 *
 * This module is the pure half: which scene, which palette, and where the
 * elements land. `components/capsule-art.tsx` draws it.
 *
 * When real photography arrives it goes in `images?: string[]` on the Capsule
 * and the card renders a strip instead — the scene is the fallback, not a
 * layer the photos have to sit on top of.
 */

import type { FacetId } from "@/lib/facets";

export type SceneId =
  | "reef"
  | "coast"
  | "night"
  | "ochre"
  | "forest"
  | "alpine"
  | "city"
  | "harvest";

/** [hue, saturation %, lightness %]. */
type Hsl = readonly [number, number, number];

interface ScenePalette {
  skyTop: Hsl;
  skyBottom: Hsl;
  landFar: Hsl;
  landNear: Hsl;
  glow: Hsl;
}

/**
 * Every palette sits in a mid-to-dark luminance band on purpose: the state
 * name is bone-white over the top of it, in both themes, and a scene that
 * drifted light would lose the type. The art is not theme-aware for the same
 * reason a photograph is not — it is content, and the card frames it.
 */
const PALETTES: Record<SceneId, ScenePalette> = {
  // Underwater: sea-greens with light shafts coming down through them.
  reef: {
    skyTop: [194, 58, 17],
    skyBottom: [176, 46, 33],
    landFar: [180, 40, 24],
    landNear: [170, 44, 14],
    glow: [48, 82, 74],
  },
  // Temperate coast: cold blues, a low sun, wave lines.
  coast: {
    skyTop: [215, 52, 20],
    skyBottom: [199, 54, 43],
    landFar: [203, 38, 27],
    landNear: [208, 34, 15],
    glow: [38, 86, 74],
  },
  // Doof and dancefloor: night purples with a magenta glow.
  night: {
    skyTop: [267, 56, 12],
    skyBottom: [303, 48, 25],
    landFar: [285, 44, 17],
    landNear: [272, 46, 9],
    glow: [318, 86, 68],
  },
  // The dry interior and the west: ochre, rust, warm sand.
  ochre: {
    skyTop: [20, 56, 24],
    skyBottom: [31, 70, 47],
    landFar: [24, 58, 32],
    landNear: [14, 54, 19],
    glow: [40, 90, 68],
  },
  // Rainforest and bush: layered canopy under a green haze.
  forest: {
    skyTop: [162, 36, 12],
    skyBottom: [138, 33, 27],
    landFar: [146, 34, 17],
    landNear: [152, 42, 9],
    glow: [72, 58, 62],
  },
  // Cold high country and the southern coast: slate and snowlight.
  alpine: {
    skyTop: [223, 44, 18],
    skyBottom: [206, 38, 39],
    landFar: [210, 24, 33],
    landNear: [216, 28, 20],
    glow: [199, 48, 86],
  },
  // City after dark: indigo with a skyline and lit windows.
  city: {
    skyTop: [236, 42, 14],
    skyBottom: [256, 38, 29],
    landFar: [240, 28, 19],
    landNear: [232, 32, 10],
    glow: [28, 88, 66],
  },
  // Vines, orchards, markets and long lunches: warm clay and amber.
  harvest: {
    skyTop: [28, 42, 20],
    skyBottom: [42, 56, 41],
    landFar: [40, 44, 31],
    landNear: [34, 44, 18],
    glow: [46, 86, 68],
  },
};

const TAG_SETS: Record<string, readonly string[]> = {
  tropicalWater: ["reef", "coral-cay", "snorkel", "diving", "island"],
  // Deliberately narrow. `swimming` and `boat` used to live here and dragged
  // the Pilbara's gorges and Kakadu's billabong cruise into a blue coastal
  // scene — a swimming hole is not a shore and a wetland cruise is not the sea.
  shore: ["beach", "coast", "surf", "sailing", "waterfront", "ferry"],
  night: ["doof", "psytrance", "techno", "electronic", "nightlife", "music", "reggae"],
  dry: ["desert", "outback", "4wd", "roadside", "geology", "gorge", "station-stay"],
  green: ["rainforest", "forest", "national-park", "waterfall", "hiking", "wildlife", "river"],
  cold: ["alpine", "mountain", "wilderness", "lake"],
  urban: ["city", "museum", "art", "architecture", "nightlife", "queer", "multicultural"],
  table: ["wine", "food", "seafood", "market", "beer", "pub", "food-pilgrimage"],
};

/** Dry-set tags that only mean "dry" in a dry state. See rule 5. */
const AMBIGUOUS_DRY: readonly string[] = ["gorge", "geology"];

/** States whose default weather is hot and dry rather than green. */
const DRY_STATES = new Set(["WA", "NT", "SA"]);
/** States whose default light is cold. */
const COLD_STATES = new Set(["TAS"]);
/** States where "beach" means tropical water. */
const TROPICAL_STATES = new Set(["QLD", "NT"]);

function hits(tags: readonly string[], set: readonly string[]): number {
  let count = 0;
  for (const tag of tags) if (set.includes(tag)) count += 1;
  return count;
}

/**
 * Which scene an entry gets.
 *
 * Ordered rather than scored, and the order is the argument: the loudest thing
 * about an entry wins. A bush doof in the WA desert is a *night*, not an
 * ochre landscape, because that is what you went for.
 */
export function sceneFor(input: {
  state: string;
  tags: readonly string[];
  facets: readonly FacetId[];
}): SceneId {
  const { state, tags, facets } = input;
  const has = (facet: FacetId) => facets.includes(facet);

  // 1. After dark beats everything. `doof`, `psytrance` and `nye` are on their
  //    own unambiguous; everything else needs two signals, so a folk festival
  //    in a field doesn't come out as a rave.
  if (tags.includes("doof") || tags.includes("psytrance") || tags.includes("nye")) {
    return "night";
  }
  if (hits(tags, TAG_SETS.night) >= 2) return "night";
  if (has("music") && has("hippie")) return "night";

  // 2. A wine region is a wine region, even when it also has a coastline.
  //    Without this, Margaret River and the Fleurieu come out as generic blue
  //    coast and lose the one thing they are actually known for.
  if (tags.includes("wine")) return "harvest";

  // 3. Water, split by latitude — the reef is a different colour to the Bight.
  if (hits(tags, TAG_SETS.tropicalWater) >= 1) {
    return TROPICAL_STATES.has(state) || hits(tags, TAG_SETS.tropicalWater) >= 2
      ? "reef"
      : "coast";
  }
  if (hits(tags, TAG_SETS.shore) >= 1) {
    return TROPICAL_STATES.has(state) ? "reef" : "coast";
  }

  // 4. Cold high country, before the generic outdoors rule swallows it.
  if (hits(tags, TAG_SETS.cold) >= 1 && (COLD_STATES.has(state) || tags.includes("alpine"))) {
    return "alpine";
  }

  // 5. The dry interior. `road-trip` alone isn't enough — the Great Ocean Road
  //    is a road trip and it is not ochre. `gorge` and `geology` are the two
  //    ambiguous members of the set: the Pilbara's gorges are red rock,
  //    Tasmania's are wet green, so on their own they only count in a dry
  //    state and otherwise fall through to the green rule below.
  const dryHits = hits(tags, TAG_SETS.dry);
  if (dryHits >= 1) {
    const onlyAmbiguous = dryHits === hits(tags, AMBIGUOUS_DRY);
    if (!onlyAmbiguous || DRY_STATES.has(state)) return "ochre";
  }

  // 6. Green country.
  if (hits(tags, TAG_SETS.green) >= 1) return COLD_STATES.has(state) ? "alpine" : "forest";

  // 7. Culture: the table before the city, because a market day does not read
  //    as a skyline.
  if (hits(tags, TAG_SETS.table) >= 1) return "harvest";
  if (hits(tags, TAG_SETS.urban) >= 1 || has("city")) return "city";

  // 8. Nothing said anything. Fall back on where it is.
  if (DRY_STATES.has(state)) return "ochre";
  if (COLD_STATES.has(state)) return "alpine";
  return "forest";
}

/** FNV-1a. Small, stable, and the same answer on the server and the client. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — a tiny deterministic PRNG, seeded off the entry's id. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function css([h, s, l]: Hsl, shiftHue = 0, shiftLight = 0): string {
  return `hsl(${(h + shiftHue + 360) % 360} ${s}% ${Math.min(96, Math.max(4, l + shiftLight))}%)`;
}

/** One mark in the scene's repeated motif — a shaft, a peak, a tower, a wave. */
export interface SceneMark {
  /** 0–1 across the frame. */
  x: number;
  /** 0–1 of the available height for this motif. */
  size: number;
  /** 0–1, free variation the motif can use however it likes. */
  wobble: number;
}

export interface CapsuleScene {
  id: SceneId;
  skyTop: string;
  skyBottom: string;
  landFar: string;
  landNear: string;
  glow: string;
  /** Where the sun, moon or glare sits. Fractions of the frame. */
  disc: { x: number; y: number; r: number };
  /** Fraction of the frame height where land meets sky. */
  horizon: number;
  marks: SceneMark[];
  /** Stars, sparks, fish — the scatter layer. */
  specks: { x: number; y: number; r: number }[];
}

/**
 * Build the scene for one entry.
 *
 * Deterministic in `seed` (always the entry's id), so the same idea draws the
 * same picture on every render, on the server and in the browser.
 */
export function capsuleScene(input: {
  seed: string;
  state: string;
  tags: readonly string[];
  facets: readonly FacetId[];
}): CapsuleScene {
  const id = sceneFor(input);
  const palette = PALETTES[id];
  const random = makeRandom(hashSeed(input.seed));

  // Hue drift is deliberately small — enough that two reef entries are not the
  // same picture, not so much that "reef" stops meaning sea-green.
  const hueShift = Math.round((random() - 0.5) * 18);
  const lightShift = Math.round((random() - 0.5) * 8);

  const horizon = id === "reef" ? 0.78 + random() * 0.1 : 0.6 + random() * 0.14;

  const markCount = id === "city" ? 9 : id === "coast" ? 4 : 3 + Math.floor(random() * 3);
  const marks: SceneMark[] = Array.from({ length: markCount }, (_, index) => ({
    // Spread across the frame with jitter, rather than evenly: even spacing
    // reads as a chart, jittered reads as a landscape.
    x: (index + 0.5) / markCount + (random() - 0.5) * (0.9 / markCount),
    size: 0.35 + random() * 0.65,
    wobble: random(),
  }));

  const speckCount = id === "night" ? 22 : id === "reef" ? 14 : 8;
  const specks = Array.from({ length: speckCount }, () => ({
    x: random(),
    y: random() * (horizon - 0.06),
    r: 0.6 + random() * 1.5,
  }));

  return {
    id,
    skyTop: css(palette.skyTop, hueShift, lightShift),
    skyBottom: css(palette.skyBottom, hueShift, lightShift),
    landFar: css(palette.landFar, hueShift, lightShift),
    landNear: css(palette.landNear, hueShift, lightShift),
    glow: css(palette.glow, hueShift * 0.4),
    disc: {
      x: 0.18 + random() * 0.64,
      y: horizon * (0.24 + random() * 0.4),
      r: 0.06 + random() * 0.05,
    },
    horizon,
    marks,
    specks,
  };
}

/** Human label for the scene, so the art carries an alt text worth reading. */
export const SCENE_LABEL: Record<SceneId, string> = {
  reef: "sea-green water with light shafts",
  coast: "cold blue coast under a low sun",
  night: "night purples with a stage glow",
  ochre: "ochre country under a hot sky",
  forest: "layered green canopy",
  alpine: "slate peaks under cold light",
  city: "an indigo skyline after dark",
  harvest: "warm clay hills and vine rows",
};
