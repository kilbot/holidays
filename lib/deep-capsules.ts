/**
 * The deep-researched Capsules.
 *
 * `docs/research/capsule-*.md` holds seven long-form research documents —
 * roughly 2,800 lines of argued prose, tables and sourced prices. None of that
 * belongs in a 420px card, and none of it should be re-derived at render time.
 * This module is the distillation: the numbers, the shape and the verdicts,
 * lifted from those documents by hand, with the document left in place as the
 * citation.
 *
 * The rules the distillation follows, so a later editor can hold the line:
 *
 * - **Every figure here appears in the research.** Nothing is recomputed,
 *   averaged or rounded into a nicer number. Where a doc gives a plan-on figure
 *   and a band, both come across, because the band is the honest part.
 * - **Costs are per couple, in EUR**, at the research's own A$1 = €0.61. The
 *   AUD plan-on rides along because every operator quote is in AUD.
 * - **The day sketch is the *ideal* version only.** Minimum and maximum are
 *   durations and prices; only the ideal gets an itinerary, because that is the
 *   only one the docs actually write out day by day.
 * - **Caveats keep their teeth.** "January is the worst croc month" survives
 *   the trip through this file. A caveat that reads as marketing has been
 *   distilled wrong.
 *
 * Seven documents, eight Capsules: `capsule-wa-southwest.md` defines two
 * (Margaret River and Rottnest Island) and says so in its title — they have
 * different bases, durations and cost scales, and splitting them here is what
 * the document itself does.
 *
 * The ninth, `mundaring-arrival`, has **no document at all**. It comes from
 * docs/CONTEXT.md's Anchor and Home-base entries — a user directive rather than
 * a research sweep — and it says so in its own comment and its own sources
 * rather than borrowing a citation. Its ceiling rung is labelled "If you paid
 * for it" instead of "As published" for the same reason: there is nothing
 * published to quote.
 *
 * These Capsules are deliberately **not** in `catalog.json`. The Catalog is the
 * shallow tier — 415 unsifted ideas — and the sweep left the marquee blocks out
 * because they were already researched. `related` points the other way instead:
 * the Catalog ideas each document argues with, so the card can offer them.
 */

import type { Coordinates } from "@/lib/airports";
import type { SeasonFit } from "@/lib/catalog";
import type { FacetId } from "@/lib/facets";

/** One line of the ideal itinerary. Short by contract — this is a sketch. */
export interface DaySketch {
  /** "Day 1", "Thu 18 Feb", "06:15" — whatever unit the doc's table used. */
  day: string;
  title: string;
  body: string;
}

/** One rung of the cost ladder. `aud` and `eur` are per couple. */
export interface CostTier {
  aud: number;
  eur: number;
  /** The honest spread in EUR. Null where the research publishes none. */
  band: [number, number] | null;
  /** How many days this rung buys — the ladder is durations as well as prices. */
  days: number;
  /** The rung in two words: "Floor", "Camping", "Plan on", "As published". */
  label: string;
}

/**
 * Floor → plan-on → ceiling, which is what a cost ladder is for.
 *
 * Recalibrated on #64: the card used to read Minimum / Ideal / Maximum against
 * the research's own **mid-tier** arithmetic, and the ledger charged something
 * else entirely — Margaret River said €1,375 on the card and €888 in the Plan.
 * Two numbers for the same Adventure is worse than one wrong one.
 *
 * So `ideal` is now **the figure the engine actually charges** for this block
 * at its default placement: the recalibrated lodging and food floors, the
 * corrected Event ladder, that block's own peak multipliers. `max` is the
 * version the research originally published, kept as the ceiling it always
 * was. `min` and `cheap` are the two rungs below — a shorter stay, and a tent
 * or a hostel twin where the research offers one.
 *
 * Inter-city Legs sit outside every rung: they are their own line in the Plan,
 * and folding a A$610 flight into "what Tasmania costs" would double-count it.
 */
export interface CostLadder {
  /** The shortest version still worth doing, at the floor. */
  min?: CostTier;
  /** A tent, or a hostel twin. Only where the research offers one. */
  cheap?: CostTier;
  /** Plan-on. What the Plan charges, and what every surface shows. */
  ideal: CostTier;
  /** As published — the mid-tier version. A ceiling, never a target. */
  max: CostTier;
}

/** The rungs this Adventure has, cheapest first. */
export function costLadder(cost: CostLadder): CostTier[] {
  return [cost.min, cost.cheap, cost.ideal, cost.max].filter(
    (rung): rung is CostTier => rung !== undefined,
  );
}

export interface Caveat {
  label: string;
  body: string;
  /** `warn` gets the amber treatment; `good` is a caveat in your favour. */
  tone: "warn" | "info" | "good";
}

export interface Operator {
  name: string;
  where: string;
  /** Published fare, as the research quotes it. Per adult unless it says. */
  price: string;
  note: string;
  /** The doc's own ⭐ — the one it tells you to book. */
  pick?: boolean;
}

/** A dated thing that stops being possible if it is missed. */
export interface Deadline {
  when: string;
  what: string;
}

export interface SourceLink {
  label: string;
  url: string;
}

export interface DeepCapsule {
  id: string;
  name: string;
  /** "STATE — subregion / place", the same shape the Catalog uses. */
  region: string;
  /** One line: what this Capsule is. */
  tagline: string;
  /** Facets, for the sift chips and for the generated art. */
  facets: FacetId[];
  /** Tags, in the Catalog's vocabulary, for the art's scene choice. */
  tags: string[];
  seasonFit: SeasonFit;
  /** IATA of the airport the Capsule is reached through. */
  airport: string;
  /**
   * Where the Capsule actually happens, [longitude, latitude] — its base, not
   * its gateway. Port Douglas is 60km north of the Cairns airport it flies
   * into and Margaret River is a three-hour drive from Perth; a marker on the
   * airport would put the Capsule in the wrong place on a map whose whole job
   * is saying where things are. Content, like every other figure here: these
   * are the towns the research documents run their itineraries out of.
   */
  base: Coordinates;
  /** The days the research says the Capsule wants. */
  days: { min: number; ideal: number; max: number; unit: string };
  cost: CostLadder;
  /** "18–31 January", "Thu 18 – Mon 22 February 2027". */
  window: string;
  /** The doc's one-line verdict on the trip's own dates. */
  verdict: string;
  /** Why the Capsule is worth its days and its money. Two or three sentences. */
  why: string;
  /** What the ideal duration buys, and why not one night fewer. */
  durationNote: string;
  /** Share of the €12,000–20,000 Budget, as the doc computes it. */
  budgetShare: string;
  itinerary: DaySketch[];
  caveats: Caveat[];
  operators: Operator[];
  deadlines: Deadline[];
  /** The research document, plus the sources that carry the load. */
  sources: SourceLink[];
  /** Catalog ideas this document argues with — alternatives and neighbours. */
  related: string[];
  /**
   * Real photography, once there is any. Present means the card renders an
   * image strip instead of the generated scene; absent is the normal case.
   */
  images?: string[];
}

const RESEARCH = "https://github.com/kilbot/holidays/blob/main/docs/research/";

/* ------------------------------------------------------------------ *
 * QLD — Great Barrier Reef, out of Port Douglas
 * ------------------------------------------------------------------ */

const GREAT_BARRIER_REEF: DeepCapsule = {
  id: "gbr-port-douglas",
  name: "Great Barrier Reef — Port Douglas",
  region: "QLD — Far North / Port Douglas",
  tagline: "Outer-reef day trips from a walkable resort town, snorkel-first.",
  facets: ["beach", "wildlife", "outdoors"],
  tags: ["reef", "snorkel", "diving", "boat", "coast", "bucket-list"],
  seasonFit: "ok",
  airport: "CNS",
  base: [145.4650, -16.4840], // Port Douglas — Macrossan St, the reef town itself
  days: { min: 3, ideal: 5, max: 7, unit: "nights" },
  // Recalibrated on #64. The published ideal — €2,560 — assumed mid-tier
  // lodging and restaurant food; the Plan charges €1,648 for the same five
  // nights at the Port Douglas floor, both reef days included.
  cost: {
    min: { aud: 1405, eur: 857, band: null, days: 3, label: "Floor" },
    cheap: { aud: 2480, eur: 1513, band: null, days: 5, label: "Camping" },
    ideal: { aud: 2702, eur: 1648, band: null, days: 5, label: "Plan on" },
    max: { aud: 4166, eur: 2560, band: [2075, 3295], days: 5, label: "As published" },
  },
  window: "From ~18 January — the day operator off-peak pricing starts",
  verdict: "Yes — but buy buffer days, not extra reef days.",
  why: "Port Douglas sits closest to the Agincourt and Opal ribbon reefs on the edge of the continental shelf — about 90 minutes out, against a longer run from Cairns. Less transit, more water time, and the best snorkel operators in the region all leave from here. Northern GBR hard coral cover is 35.1%, up from 30% (AIMS 2025/26), and the 2025–26 summer accumulated less heat stress than the two before it.",
  durationNote:
    "The binding constraint is not how much reef there is — it is weather variance. Expect 3–5 blown-out days a month. Five nights buys four independent shots at a good reef day; three buys two. Night five costs about A$240 of lodging and food and buys a whole extra chance at the thing you flew 15,000 km for.",
  budgetShare: "The ideal at €2,560 is 13–21% of the €12,000–20,000 Budget.",
  itinerary: [
    {
      day: "Day 1",
      title: "Arrive",
      body: "Fly into Cairns, collect the hire car, drive the Captain Cook Highway north (60–70 min). Sunset drinks on Macrossan St. Nothing booked — flights slip and the humidity is a shock.",
    },
    {
      day: "Day 2",
      title: "Reef I — Wavelength",
      body: "08:15 departure, ~90 min out, three outer-reef sites (Opal, St Crispin, Tongue). Marine-biologist-guided snorkels, max 48 guests, free in-water photos. Back ~16:30.",
    },
    {
      day: "Day 3",
      title: "Rainforest",
      body: "Mossman Gorge, the Daintree ferry, Cape Tribulation. The weatherproof day — the rainforest is better wet — and the reserve slot if Day 2 was cancelled.",
    },
    {
      day: "Day 4",
      title: "Reef II — Poseidon, plus an intro dive each",
      body: "08:30 departure, three Agincourt ribbon sites. Add one introductory dive each (A$92 pp, no certification). Different boat, different reef, and the day snorkelling becomes diving.",
    },
    {
      day: "Day 5",
      title: "Slack",
      body: "Four Mile Beach inside the netted stinger enclosure only, pool, the Sunday market if the day lands right. Optional half-day Low Isles sail. Second weather buffer.",
    },
    {
      day: "Day 6",
      title: "Depart",
      body: "Drive to Cairns, fly out. Never a boat on a departure day — and a Day-4 intro dive clears the 12–18 h no-fly rule with two nights to spare.",
    },
  ],
  caveats: [
    {
      label: "Weather writes off 3–5 days a month",
      tone: "warn",
      body: "Wind, swell or a low can take a reef day, and a multi-day blow is a real possibility. This is why the Adventure buys buffer days rather than a third reef day.",
    },
    {
      label: "Visibility drops to 15–20 m",
      tone: "warn",
      body: "Wet-season runoff cuts the 20–30 m winter norm. Still good by world standards, and the outer reef holds up far better than inner or fringing reef.",
    },
    {
      label: "Rain: the wettest month",
      tone: "info",
      body: "Cairns averages 320–345 mm across 15–19 rain days in January — but as heavy overnight and afternoon downpours of 10–30 minutes, not all-day drizzle. Reef boats leave in the morning.",
    },
    {
      label: "Stingers close the beach, not the reef",
      tone: "warn",
      body: "Box jellyfish and Irukandji are an inshore problem and extremely rare on the outer reef; every operator issues a free lycra suit Nov–May. But Four Mile Beach is scenery, not swimming, except inside the net.",
    },
    {
      label: "Cyclones: low probability, high impact",
      tone: "warn",
      body: "Season runs 1 Nov – 30 Apr, most active Feb–Mar, roughly double the impact rate in La Niña years. Buy refundable lodging and check the BOM ENSO outlook from November 2026.",
    },
    {
      label: "Water is ~29 °C",
      tone: "good",
      body: "No wetsuit needed for warmth. You can stay in the water all day, which is most of what makes the guided snorkel days worth their fare.",
    },
    {
      label: "February is worse, not cheaper",
      tone: "info",
      body: "More cyclone-active, thermal stress peaked there in 2026, and Port Douglas is quiet enough that restaurants close or open a few days a week. Keep the Adventure in 18–31 January.",
    },
  ],
  operators: [
    {
      name: "Wavelength",
      where: "Port Douglas",
      price: "A$318 (€194)",
      pick: true,
      note: "Snorkel only, max 48 guests, three outer sites, marine-biologist-guided snorkels and reef talks. Gear, lycra suit, all meals and free photos included. Snorkel-specialised since 1986 — the one to book.",
    },
    {
      name: "Poseidon",
      where: "Port Douglas",
      price: "A$338 incl. fuel (€206) · intro dive A$92",
      pick: true,
      note: "Snorkel and dive on the same boat, three Agincourt ribbon sites, biologist briefing at each. Best-value intro diving in the region and it handles a mixed snorkel/dive couple well.",
    },
    {
      name: "Calypso",
      where: "Port Douglas",
      price: "A$319 off-peak / A$329 peak",
      note: "Solid, slightly cheaper. Its published calendar is the clearest confirmation that off-peak starts 18 Jan 2027.",
    },
    {
      name: "Sailaway — Mackay Coral Cay",
      where: "Port Douglas",
      price: "A$370 (€226)",
      note: "Sailing catamaran to an outer-reef sand cay. Reef quality slightly behind Wavelength; the day is arguably nicer.",
    },
    {
      name: "Sailaway — Low Isles",
      where: "Port Douglas",
      price: "A$365 (€223)",
      note: "Inner reef, not outer. The best third water day and the best rough-weather fallback — sheltered, closer in, and fine for a weaker swimmer.",
    },
    {
      name: "Quicksilver",
      where: "Port Douglas",
      price: "A$348 incl. fuel · guided snorkel +A$89 · intro dive A$205",
      note: "Skip. The moored pontoon is built for volume and for non-swimmers, and the add-on pricing makes a guided-snorkel-plus-dive day far dearer than Poseidon's.",
    },
    {
      name: "Passions of Paradise",
      where: "Cairns",
      price: "A$275 (€168) · intro dive A$90",
      note: "The best Cairns-based option and the cheapest credible day on the list. The fallback if the Adventure moves to a Cairns base.",
    },
    {
      name: "Pro Dive Cairns — 5-day PADI Open Water",
      where: "Cairns",
      price: "A$1,440 pp (A$1,360 e-learning)",
      note: "The 'go deep instead of wide' toggle: 2 days pool and theory, then a 3-day liveaboard with 9 dives. Cheaper per hour in the water than any day-trip stack — but it is a course, and two January nights on a small boat is a stomach gamble.",
    },
  ],
  deadlines: [
    {
      when: "As soon as dates are fixed",
      what: "Book both reef days. Wavelength caps at 48 and sells out days ahead even in shoulder periods.",
    },
    {
      when: "Before booking",
      what: "Pre-book the Cairns airport transfer — there has been no walk-up shuttle desk since Exemplar Coaches' liquidation on 31 Mar 2026.",
    },
    {
      when: "October 2026",
      what: "Re-snapshot lodging for 18–31 Jan 2027. January rates are not broadly published as of Aug 2026.",
    },
    {
      when: "November 2026",
      what: "Check the BOM ENSO outlook — La Niña roughly doubles cyclone impact rates near Cairns.",
    },
    {
      when: "Before Day 4",
      what: "Confirm intro-dive medical eligibility for both travellers before building the day around it.",
    },
  ],
  sources: [
    {
      label: "Research: capsule-great-barrier-reef.md",
      url: `${RESEARCH}capsule-great-barrier-reef.md`,
    },
    { label: "Wavelength — prices", url: "https://www.wavelength.com.au/prices" },
    { label: "Poseidon Outer Reef Cruises", url: "https://poseidon-cruises.com.au/" },
    {
      label: "Calypso — peak/off-peak calendar",
      url: "https://calypsoreefcruises.com/our-cruises/snorkel-tour/",
    },
    {
      label: "AIMS — reef condition 2025/26",
      url: "https://www.aims.gov.au/monitoring-great-barrier-reef/gbr-condition-summary-2025-26",
    },
    {
      label: "BOM — Cairns climate statistics",
      url: "https://www.bom.gov.au/climate/averages/tables/cw_031011.shtml",
    },
  ],
  related: [
    "lady-elliot-island-day-trip-scenic-flight",
    "lady-musgrave-island-day-cruise-southern-great-barrier-reef",
    "learn-to-scuba-dive-padi-open-water-liveaboard-cairns",
    "kuranda-and-port-douglas-market-days",
    "fitzroy-island",
  ],
};

/* ------------------------------------------------------------------ *
 * QLD — Far North Queensland wildlife, as an extension
 * ------------------------------------------------------------------ */

const FNQ_WILDLIFE: DeepCapsule = {
  id: "fnq-wildlife",
  name: "Far North Queensland wildlife — crocs, rainforest, cassowaries",
  region: "QLD — Daintree / Cape Tribulation",
  tagline: "An extension of the reef Adventure, bought with one night north of the ferry.",
  facets: ["wildlife", "outdoors"],
  tags: ["wildlife", "rainforest", "national-park", "birds", "conservation"],
  seasonFit: "ok",
  airport: "CNS",
  base: [145.4530, -16.0850], // Cape Tribulation, north of the Daintree ferry
  days: { min: 0, ideal: 1, max: 2, unit: "extra days" },
  // Recalibrated on #64. There is no shorter rung: the extension *is* one day.
  cost: {
    cheap: { aud: 292, eur: 178, band: null, days: 1, label: "Camping" },
    ideal: { aud: 334, eur: 204, band: null, days: 1, label: "Plan on" },
    max: { aud: 739, eur: 450, band: [335, 580], days: 1, label: "As published" },
  },
  window: "Inside the reef Adventure's 18–31 January window",
  verdict:
    "Cassowaries: January is a good month. Crocodiles: January is the worst month for sighting quality.",
  why: "The brief's three targets do not live in the same place. Rainforest and wild crocodile are already bought and paid for by the reef Adventure's Daintree buffer day; only the cassowary argues for a separate base, and it argues for one on the wrong side of Cairns. So this is an extension, not an Adventure — and the one night north of the Daintree ferry is what converts it from 'we did a croc cruise' into a dusk and a dawn in cassowary country.",
  durationNote:
    "The binding constraint is dawn and dusk. Every target here is a crepuscular animal, and every one is unavailable to a couple sleeping in Port Douglas — the ferry is 45 minutes away and Cape Tribulation is 1h45 beyond it. The reef is a mid-morning product; they do not compete for hours, they compete for where you sleep.",
  budgetShare:
    "The ideal at €450 is 2–4% of the Budget — the cheapest marquee block researched, because it rides on the reef Adventure's base, car and rainforest day.",
  itinerary: [
    {
      day: "Day 1",
      title: "Arrive, plus Hartley's",
      body: "Hartley's Crocodile Adventures sits on the Captain Cook Highway between Cairns airport and Port Douglas. Lagoon croc-feed cruise, croc attack show, cassowary feeding at 16:00. Zero extra days, zero detour.",
    },
    {
      day: "Day 2",
      title: "Reef I — unchanged",
      body: "Wavelength, early in the stay, so a weather cancellation still has somewhere to go.",
    },
    {
      day: "Day 3",
      title: "Rainforest, croc cruise, sleep north of the ferry",
      body: "Mossman Gorge before the buses. Daintree croc cruise timed to a low tide. Cross on the ferry, walk the Marrdja and Dubuji boardwalks, check into Cow Bay or Cape Trib. At dusk, drive Cape Tribulation Road slowly.",
    },
    {
      day: "Day 4",
      title: "Dawn, then back",
      body: "Jindalba boardwalk at first light — 06:00–08:00 is the cassowary window. Cape Trib beach, ferry south mid-morning, Port Douglas by lunch. You cannot buy this morning from Port Douglas.",
    },
    {
      day: "Day 5",
      title: "Reef II — unchanged",
      body: "Poseidon plus the intro dives, still separated from Reef I by a weatherproof block.",
    },
    {
      day: "Day 6",
      title: "Slack",
      body: "Second weather buffer. Rain-day fallback: Wildlife Habitat in Port Douglas (A$50 pp, ticket valid five days) if Hartley's did not happen.",
    },
    {
      day: "Day 7",
      title: "Depart",
      body: "Drive to Cairns, taking Hartley's 09:00 cassowary feed here if Day 1 ran late.",
    },
  ],
  caveats: [
    {
      label: "January halves the croc odds",
      tone: "warn",
      body: "Operators publish ~98% sighting rates Jun–Sep against roughly 50/50 Dec–Feb. Warm water means crocs have no reason to bask. The failure mode is not seeing nothing — it is a 1.5 m juvenile instead of a 4 m adult.",
    },
    {
      label: "Book to a low tide, not a convenient time",
      tone: "info",
      body: "Both long-running operators say the same thing: summer plus a high tide is the worst combination, and low tide is the mitigation. This is free and it is the biggest lever in the whole extension.",
    },
    {
      label: "Cape Tribulation Road closes",
      tone: "warn",
      body: "Sealed and 2WD from the ferry, but narrow and it shuts in heavy rain. Cyclone Jasper cut Cape Trib off into January 2024; a March 2026 flash flood took the ferry itself out for a fortnight. Keep the night cancellable.",
    },
    {
      label: "Cassowaries are on your side in summer",
      tone: "good",
      body: "Fruiting season runs Oct–Apr, and summer is when chicks are on foot with their fathers near forest edges. This is the one part of the brief the wet season improves.",
    },
    {
      label: "Crocodile danger is genuinely higher in the wet",
      tone: "warn",
      body: "High turbid water puts crocodiles where they are not in the dry. Do not swim or stand at the edge of any waterway from the Daintree mouth to the lower Mossman. Mossman Gorge is above the croc line but carries a flash-flood risk instead.",
    },
    {
      label: "No mobile coverage beyond Thornton Beach",
      tone: "info",
      body: "Patchy from Wonga Beach and nothing at Cape Tribulation. Download offline maps and tell the accommodation your arrival window.",
    },
    {
      label: "Do not drive the Bloomfield Track",
      tone: "warn",
      body: "Unsealed, 4WD only, steep grades and creek crossings, impassable in the wet — and most hire agreements exclude it anyway.",
    },
  ],
  operators: [
    {
      name: "Solar Whisper",
      where: "Daintree River, south bank",
      price: "A$35 (1 h) · A$80 (2 h dawn/dusk)",
      pick: true,
      note: "Solar-electric and silent, which is worth most in exactly the conditions January creates. Free return cruise if no crocodile. The 2 h dawn cruise is what the extra night unlocks.",
    },
    {
      name: "Bruce Belcher's Daintree River Cruises",
      where: "Daintree Village",
      price: "A$39 · family A$104",
      note: "Thirty years on the river, free return if no crocodile, and the 12:00 lunch cruise is the best-value slot. Closed the whole of February.",
    },
    {
      name: "Cape Tribulation Wilderness Cruise",
      where: "North of the ferry",
      price: "~A$30",
      note: "Cheapest, upper river, and the only boat permitted in that section of the national park. The natural pairing with the Cape Trib overnight.",
    },
    {
      name: "Hartley's Crocodile Adventures",
      where: "Wangetti — 25 min south of Port Douglas",
      price: "A$50 · family A$125",
      pick: true,
      note: "The single best-value line in the whole document. On the road you are already driving, so it costs no Day: A$100 for the couple guarantees the crocodile and the cassowary, and makes every wild sighting afterwards a bonus. Cassowary feeds 09:00 and 16:00.",
    },
    {
      name: "Wildlife Habitat Port Douglas",
      where: "In town",
      price: "A$50 · ticket valid 5 days",
      note: "The walk-there fallback and the ideal blown-out-reef-day filler. Skip the paid add-ons.",
    },
    {
      name: "Skyrail / Kuranda Scenic Railway",
      where: "Cairns",
      price: "A$145.50 combo · A$111 Skyrail return",
      note: "A tourist trap for this couple — except that Barron Falls only runs hard in the wet. If a reef day is cancelled under grey sky, buy the Skyrail return, not the combo.",
    },
  ],
  deadlines: [
    {
      when: "Before booking the cruise",
      what: "Check the Daintree tide table for the chosen date. Highest-leverage decision in the extension.",
    },
    {
      when: "October 2026",
      what: "Re-snapshot Cow Bay / Cape Trib lodging — modelled from Aug 2026 listings.",
    },
    {
      when: "November 2026",
      what: "Re-check croc-cruise fares and January departure times.",
    },
    {
      when: "The week before travel",
      what: "Douglas Shire road conditions and QLDTraffic — being stranded on the wrong side of the river is a live January scenario.",
    },
  ],
  sources: [
    {
      label: "Research: capsule-fnq-wildlife.md",
      url: `${RESEARCH}capsule-fnq-wildlife.md`,
    },
    { label: "Solar Whisper — eco tours & FAQ", url: "https://www.solarwhisper.com/faq" },
    {
      label: "Bruce Belcher's — times, rates & FAQ",
      url: "https://www.daintreerivercruises.com.au/faq.html",
    },
    { label: "Hartley's Crocodile Adventures", url: "https://www.crocodileadventures.com/" },
    {
      label: "Douglas Shire — road conditions",
      url: "https://douglas.qld.gov.au/road-conditions/",
    },
  ],
  related: [
    "mission-beach-skydive-and-dunk-island",
    "paronella-park-mena-creek",
    "tully-river-white-water-rafting",
    "crocosaurus-cove-and-the-cage-of-death",
  ],
};

/* ------------------------------------------------------------------ *
 * TAS — the south-to-north arc
 * ------------------------------------------------------------------ */

const TASMANIA: DeepCapsule = {
  id: "tasmania-arc",
  name: "Tasmania — the south-to-north arc",
  region: "TAS — Hobart to Launceston",
  tagline: "A one-way arc: fly into Hobart, out of Launceston, never drive the same road twice.",
  facets: ["outdoors", "road-trip", "city", "food", "market", "beach"],
  tags: [
    "road-trip",
    "national-park",
    "coastal-walk",
    "beach",
    "city",
    "art",
    "market",
    "wilderness",
  ],
  seasonFit: "good",
  airport: "HBA",
  base: [147.3272, -42.8821], // Hobart — where the south-to-north arc starts
  days: { min: 6, ideal: 9, max: 12, unit: "nights" },
  // Recalibrated on #64, and still the most expensive block per day — the hire
  // car is A$85/day before the January multiplier. Both Pennicott cruises are
  // in the plan-on figure: dropping them is the couple's call, and the savings
  // menu prices it (−€183 and −€164).
  cost: {
    min: { aud: 3223, eur: 1966, band: null, days: 6, label: "Floor" },
    cheap: { aud: 3597, eur: 2194, band: null, days: 9, label: "Camping" },
    ideal: { aud: 4407, eur: 2688, band: null, days: 9, label: "Plan on" },
    max: { aud: 7261, eur: 4430, band: [3415, 6100], days: 9, label: "As published" },
  },
  window: "From about 13 January — after the New Year fare peak",
  verdict:
    "Yes — but February is quietly better, and Tasmania is the most expensive block in the Plan per day.",
  why: "Tasmania's highlights sit on a diagonal: Hobart and the Tasman Peninsula in the far south-east, Freycinet halfway up the east coast, the Bay of Fires in the north-east, Launceston at the top. That is a single monotonic line, so the arc never backtracks and no driving day runs over three hours. Sydney flies nonstop to both airports and there is no fare penalty for the open jaw.",
  durationNote:
    "The binding constraint is transit cost per hub. Every hub costs half a day of driving plus a minimum of one night, and a hub with one night is a hub you drove to and left. Nine nights buys five hubs; seven forces you to drop either Freycinet's second night or the Tasman Peninsula. Nights eight and nine are the cheapest in the Adventure at ~A$490 each and each buys back a whole hub.",
  budgetShare:
    "The ideal at €4,430 is 22–37% of the Budget. With the reef Adventure, the two take 35–58% of the whole trip for 14 of its nights — the trimmed ideal at €3,460 is the version to take if the Budget is doing real work.",
  itinerary: [
    {
      day: "Fri 15 Jan",
      title: "Arrive Hobart — no car",
      body: "SYD→HBA, 1h50. Do not collect a car: days 1–3 are entirely car-free and Tasmanian January hire is the binding constraint. Salamanca Place, Kelly's Steps, Battery Point.",
    },
    {
      day: "Sat 16 Jan",
      title: "Salamanca Market and kunanyi",
      body: "Salamanca Market 08:30–15:00, free, 300+ stalls, Saturdays only — the pin the whole week hangs on. Afternoon: kunanyi / Mt Wellington, 1,270 m, 30 min from town or the Explorer Bus.",
    },
    {
      day: "Sun 17 Jan",
      title: "MONA",
      body: "Mona Roma ferry from Brooke Street Pier (~A$30 pp return, book two days ahead in summer), museum A$39 pp. Allow the whole day; the ferry is half the experience. MONA is closed Tue and Wed.",
    },
    {
      day: "Mon 18 Jan",
      title: "Bruny Island",
      body: "Collect the car. Kettering, SeaLink ferry (A$50.60 per car return, passengers free). The Neck, Cape Bruny lighthouse, oysters and cheese at Adventure Bay. Go early — the queue runs two sailings deep.",
    },
    {
      day: "Tue 19 Jan",
      title: "Port Arthur and the Tasman Peninsula",
      body: "Drive 1h30 via Eaglehawk Neck. Port Arthur A$55 pp, valid two consecutive days. Tasman Island Cruise A$180 pp — the tallest sea cliffs in the Southern Hemisphere. Sleep on the peninsula for the 18:00 ghost tour.",
    },
    {
      day: "Wed 20 Jan",
      title: "Peninsula → Freycinet",
      body: "About 3 h via Sorell, Orford and Swansea, broken by Devil's Corner cellar door and Kate's Berry Farm. Cape Tourville boardwalk on arrival, swim at Honeymoon Bay. The afternoon deliberately holds nothing.",
    },
    {
      day: "Thu 21 Jan",
      title: "Wineglass Bay",
      body: "Early start — the car park fills mid-morning in January. Lookout is 3 km return; the beach 6 km; the Hazards Beach circuit 11 km. Afternoon at Friendly Beaches, or nothing.",
    },
    {
      day: "Fri 22 Jan",
      title: "Freycinet → Bay of Fires",
      body: "Coles Bay → Bicheno → Binalong Bay, ~2 h. Orange-lichen granite at The Gardens and Cosy Corner. The best beach in the Adventure, and it is directly on the way to the departure airport.",
    },
    {
      day: "Sat 23 Jan",
      title: "Bay of Fires → Launceston",
      body: "2h15–2h45 via the Weldborough Pass and Pyengana. Afternoon at Cataract Gorge, free, a 20-minute walk from town. Tamar Valley cellar doors if there is time.",
    },
    {
      day: "Sun 24 Jan",
      title: "Depart",
      body: "Drop the car at LST, fly LST→SYD. Nothing booked, no drive — the last hub is the airport's own town by design.",
    },
  ],
  caveats: [
    {
      label: "Hire car is the binding constraint",
      tone: "warn",
      body: "Tasmania averages A$98/day in January, +58% on its annual average, with Hobart quoted at A$171/day. The island's fleet is small and it sells out. The failure mode is 'there are no cars', not 'the cars are expensive'. Book by early October 2026.",
    },
    {
      label: "Cradle Mountain is the honest cut",
      tone: "info",
      body: "2h20 from Launceston, 4h30–5h from Hobart, needs two nights, and January means ~16 °C, cloud on most days and a coin flip on seeing anything. It goes back in at 12 nights, not squeezed into 9.",
    },
    {
      label: "Peak crowds, and no week avoids them",
      tone: "warn",
      body: "Tasmanian school holidays run right through January; Term 1 starts 4 February. The Wineglass Bay car park fills mid-morning, the Bruny ferry queues, the MONA ferry needs booking two days out. Manageable by starting early, not by choosing a different week.",
    },
    {
      label: "Hobart is Australia's second-driest capital",
      tone: "good",
      body: "January mean rainfall about 47 mm, mean max 21.7 °C, sunset 20:50 on 1 January. The highlands are a different country — Cradle runs 90–100 mm in January — and that asymmetry is the best argument for the coastal arc.",
    },
    {
      label: "Drive in daylight",
      tone: "warn",
      body: "Tasmania's roadkill rate is a national outlier. Devils, quolls, wombats and wedge-tailed eagles are on the road dusk to dawn; Parks & Wildlife advise slowing down or not driving in that window. January's late sunsets make this easy — just don't book the 19:30 dinner two hours away.",
    },
    {
      label: "UV 11+ despite the mild air",
      tone: "warn",
      body: "Tasmania sits under the southern edge of the ozone hole. The mild air makes people under-dress for the sun. Sea temperature runs 17–18 °C — you can swim at Wineglass Bay, but it is not a tropical swim.",
    },
    {
      label: "February is better here",
      tone: "info",
      body: "Tasmania's driest, most settled month; school holidays end 4 February; lodging softens; and the Australian Wooden Boat Festival runs 5–8 Feb 2027. If the Plan can put Tasmania in early February and the reef in January, do exactly that.",
    },
    {
      label: "MONA FOMA and Falls Marion Bay no longer exist",
      tone: "info",
      body: "MONA FOMA was cancelled in April 2024; Falls left Tasmania in 2021. The January event calendar is thinner than the sibling flights research assumes — the demand peak is school holidays and the Sydney–Hobart, not festivals.",
    },
  ],
  operators: [
    {
      name: "MONA",
      where: "Berriedale, Hobart",
      price: "A$39 (€24) · ferry ~A$30 return",
      pick: true,
      note: "Thu–Mon 10:00–17:00, closed Tue and Wed. A subterranean, deliberately antagonistic private museum reached by a camo-painted catamaran. Allow a full day, not an afternoon.",
    },
    {
      name: "Salamanca Market",
      where: "Salamanca Place, Hobart",
      price: "Free",
      pick: true,
      note: "Saturdays only, 08:30–15:00, 300+ stalls in 1830s sandstone warehouses. The itinerary's fixed point and the best-value item in the Adventure.",
    },
    {
      name: "Port Arthur Historic Site",
      where: "Tasman Peninsula",
      price: "A$55 (€34) · ghost tour A$35",
      pick: true,
      note: "Ticket valid two consecutive days, includes a harbour cruise and guided talks. Also the site of the 1996 massacre — handled soberly on site, and worth knowing before you go.",
    },
    {
      name: "Tasman Island Cruise (Pennicott)",
      where: "ex-Port Arthur",
      price: "A$180 (€110)",
      note: "Three hours along the tallest sea cliffs in the Southern Hemisphere. The best boat in the Adventure — and the first A$360 to cut if the Budget bites.",
    },
    {
      name: "Bruny Island — self-drive",
      where: "Kettering ferry",
      price: "~A$50.60 per car return",
      pick: true,
      note: "The value play: a whole day for the ferry fare plus what you eat. Pennicott's guided circumnavigation is A$245 pp and about A$320 more for the couple.",
    },
    {
      name: "Holiday Vehicle Pass (parks)",
      where: "All parks except Cradle Mountain",
      price: "A$98.35 per vehicle, up to 2 months",
      note: "The right buy for the 9-night arc — nothing in the ideal itinerary needs more. At 12 nights the Annual Pass (A$104.75) covers Cradle and wins by about A$24.",
    },
    {
      name: "Wineglass Bay Cruise (Pennicott)",
      where: "Coles Bay",
      price: "A$210 with lunch",
      note: "The alternative to the walk, not an addition — it occupies the same morning. Take it if 3–11 km isn't on.",
    },
    {
      name: "kunanyi / Mt Wellington",
      where: "Hobart",
      price: "Free self-drive · ~A$35 Explorer Bus return",
      note: "Best free thing in the Adventure. Bus it if you skipped the car on days 1–3.",
    },
  ],
  deadlines: [
    {
      when: "Early October 2026",
      what: "Hire car. Non-negotiable — this is a supply problem, not a price problem.",
    },
    {
      when: "Early October 2026",
      what: "Coles Bay / Freycinet lodging. Second-tightest supply on the arc.",
    },
    {
      when: "3–8 weeks out",
      what: "Flights. On SYD–HBA, booking ~5 weeks ahead saves roughly a third against last-minute.",
    },
    {
      when: "Two days ahead, in-trip",
      what: "Mona Roma ferry. It needs booking in summer.",
    },
    {
      when: "A few weeks ahead",
      what: "Tasman Island, Wineglass Bay and Bruny cruises — small boats, January dates.",
    },
  ],
  sources: [
    { label: "Research: capsule-tasmania.md", url: `${RESEARCH}capsule-tasmania.md` },
    { label: "MONA — visit & ferry", url: "https://mona.net.au/visit" },
    {
      label: "Parks & Wildlife Tasmania — park passes",
      url: "https://parks.tas.gov.au/explore-our-parks/know-before-you-go/park-passes-and-entry-fees",
    },
    { label: "Port Arthur Historic Site — tours", url: "https://portarthur.org.au/all-tours/" },
    { label: "Salamanca Market — dates", url: "https://www.salamancamarket.com.au/About-us/Market-dates" },
    {
      label: "BOM — Hobart climate statistics",
      url: "https://www.bom.gov.au/climate/averages/tables/cw_094029.shtml",
    },
  ],
  related: [
    "kunanyi-mt-wellington-summit-and-descent",
    "maria-island-day-trip-the-wombat-island",
    "farm-gate-market-hobart-sunday",
    "strahan-gordon-river-cruise-and-west-coast-wilderness-railway",
    "australian-wooden-boat-festival-hobart",
    "mona-foma-is-permanently-dead-do-not-plan-a",
    "tamar-valley-wine-route-and-cataract-to-pipers-river",
  ],
};

/* ------------------------------------------------------------------ *
 * NSW — Sydney New Year's Eve
 * ------------------------------------------------------------------ */

const SYDNEY_NYE: DeepCapsule = {
  id: "sydney-nye",
  name: "Sydney New Year's Eve",
  region: "NSW — Sydney / the harbour",
  tagline: "A free ticketed vantage point, a suburb bed on a train line, and every extra night after 1 January.",
  facets: ["city", "festival", "beach"],
  tags: ["city", "nye", "festival", "event", "date-locked", "beach", "coastal-walk"],
  seasonFit: "good",
  airport: "SYD",
  base: [151.2108, -33.8568], // Sydney Harbour, the Opera House side
  days: { min: 4, ideal: 6, max: 9, unit: "nights" },
  // Recalibrated on #64. A suburb-on-a-train-line night is A$140, not A$180 —
  // and at that rate the four NYE nights stop breaching the A$500 Daily cap,
  // which was the Plan's only cap breach.
  cost: {
    min: { aud: 1916, eur: 1169, band: null, days: 4, label: "Floor" },
    cheap: { aud: 2380, eur: 1452, band: null, days: 6, label: "Hostel twin" },
    ideal: { aud: 2757, eur: 1682, band: null, days: 6, label: "Plan on" },
    max: { aud: 3406, eur: 2075, band: [1585, 2560], days: 6, label: "As published" },
  },
  window: "29 Dec 2026 – 4 Jan 2027 · the anchor is Thu 31 Dec",
  verdict: "Buy the minimum number of nights before NYE and all the extra days after it.",
  why: "The thing you are paying for — being at the harbour at midnight — happens outside, on foot, at a free vantage point you queued for. A A$1,000 harbourside room you are not in at midnight is a A$1,000 place to leave your bag. Sydney's market-wide rate hit A$1,009 at 95.4% occupancy on 31 Dec 2025, ×3.0 on its annual average; a suburb on a train line costs a third of that and Sydney Trains runs a 46-hour continuous timetable across the night.",
  durationNote:
    "The binding constraint is price asymmetry across 1 January. Nights before 31 Dec run ×1.4–1.8, the 31st itself ×2.5–3.0 with a three-night prepaid minimum; from 2 January prices fall back to ×1.0–1.1. And NYE consumes a whole day — you are in place by late morning and you do not leave until after midnight. Two nights added on 3–4 Jan cost about what one night on 30 Dec costs, and they are better days.",
  budgetShare:
    "The ideal at the suburb tier (€2,075) is 10–17% of the Budget; harbourside (€3,230) is 16–27%. Two harbour-view nights are worth roughly one extra reef day.",
  itinerary: [
    {
      day: "Tue 29 Dec",
      title: "Arrive and recce",
      body: "PER→SYD is ~4h15 plus a 3 h clock change. Circular Quay to the Botanic Garden at golden hour — and walk the actual gate of the vantage point you have chosen. On 31 Dec you want to walk to a gate you have already found.",
    },
    {
      day: "Wed 30 Dec",
      title: "Harbour icons",
      body: "Opera House, then the Manly ferry from Circular Quay — ~A$8 pp inside the daily Opal cap, and the best-value hour in Sydney. Do the harbour properly before it becomes a security operation.",
    },
    {
      day: "Thu 31 Dec",
      title: "NYE — the whole day",
      body: "Provision a picnic in the morning: no glass, sealed water only, no BYO at most sites. In the queue by 09:00–10:00 for a free site, or through the strict 12:00–15:00 window for the Opera House Forecourt. 9pm 'Calling Country' show, midnight display ~12 minutes over ~7 km of harbour. Leave after 1am.",
    },
    {
      day: "Fri 1 Jan",
      title: "Recovery",
      body: "Nothing before noon. Late lunch, a harbour or ocean pool swim. Expect a 10–15% public-holiday surcharge on every bill and book anything you actually want to eat at. Buy 1 January's breakfast on 31 December morning.",
    },
    {
      day: "Sat 2 Jan",
      title: "Coast",
      body: "Bondi to Coogee coastal walk, 6 km, free, 1.5–2 h, early because of the heat. Then a proper dinner — this is the night to spend on food, at normal prices.",
    },
    {
      day: "Sun 3 Jan",
      title: "Blue Mountains, or the inner west",
      body: "Train Central→Katoomba is inside the A$9.65 Sunday Opal cap: Echo Point, Scenic World (~A$58 pp), Katoomba Falls. Or Newtown, Marrickville, the Fish Market and Cockatoo Island — choose this if Tasmania is already on the Plan.",
    },
    {
      day: "Mon 4 Jan",
      title: "Depart, or the SCG",
      body: "Optional: day 1 of the SCG Pink Test, Australia v New Zealand, 4–8 Jan 2027, before an evening flight.",
    },
  ],
  caveats: [
    {
      label: "Never fly out on 1 January",
      tone: "warn",
      body: "Airport stations have no train service 00:30–04:30 on 1 Jan, taxi surge is extreme, and you will not have slept.",
    },
    {
      label: "No re-entry, no pass-outs",
      tone: "warn",
      body: "Once you leave a gated site you are out. Plan the whole day's food, water, sunscreen, layers and phone battery on the way in. No glass, sealed water bottles only, bag checks at every gate.",
    },
    {
      label: "Circular Quay station closes 15:00–24:00",
      tone: "info",
      body: "Use Wynyard, Martin Place or St James. Milsons Point skips city→north trains 18:00–24:00, Circular Quay ferries stop about 17:30, and station access is funnelled from ~23:00.",
    },
    {
      label: "The way you arrive is not the way you leave",
      tone: "info",
      body: "The crush is 00:15–00:45. Official advice, and correct: leave after 1am. An extra 45 minutes on a lawn is a much better hour than the same 45 minutes in a station queue.",
    },
    {
      label: "Harbourside lodging is a trap, not a splurge",
      tone: "warn",
      body: "Three-night minimums are standard and some properties want five to ten; 100% prepayment with a 100% cancellation penalty is the norm; Airbnb hosts cancel in the weeks before. And 'harbour view' is not 'fireworks view'.",
    },
    {
      label: "The trains run all night — and are not free",
      tone: "good",
      body: "A 46-hour continuous timetable from 4am 31 Dec to 2am 2 Jan, ~5,800 services, with under 30 minutes between the last train and the first New Year's Day service on most lines. Tap on: caps are A$19.30 on the Thursday, A$9.65 on the 1st.",
    },
    {
      label: "Australia Day: go to Melbourne, or stay put",
      tone: "info",
      body: "Sydney has the best 26 January program in the country and it is still the wrong call — same harbour, smaller show, four weeks after the definitive version, against the direction of travel. Melbourne on 25–27 Jan, or leave the reef block alone.",
    },
  ],
  operators: [
    {
      name: "Sydney Opera House Forecourt",
      where: "Free, but ticketed",
      price: "Free · booking opens 10am, 26 Dec 2026",
      pick: true,
      note: "The best seat on the harbour, with a defined 12:00–15:00 entry window instead of a dawn queue. 6,000 capacity, max 6 per booking, sold out in prior years. The catch is entirely the booking.",
    },
    {
      name: "NPWS — Bradleys Head, Strickland, North Head",
      where: "Free ticket via Moshtix, released ~November",
      price: "Free · islands add ~A$43.63 pp ferry",
      pick: true,
      note: "The connoisseur pick and the best fallback: elevated, far fewer people, a real lawn, and the ticket grants two hours' early entry. North-side sites are alcohol-free.",
    },
    {
      name: "Barangaroo Reserve",
      where: "Free, no ticket",
      price: "Free · opens 12:00",
      note: "Best effort-to-reward ratio on the harbour: a midday start instead of a dawn one, grass, and a Metro station at the door. You trade the Opera House out of the frame. Verify the BYO-alcohol rule on the 2026 site — sources conflict.",
    },
    {
      name: "Mrs Macquarie's Point / Fleet Steps",
      where: "Royal Botanic Garden, free, no ticket",
      price: "Free · gates 10:00",
      note: "The postcard view and the worst queue in the city — from ~04:00 for Mrs Macquarie's, ~07:00 for Fleet Steps. Fleet Steps is the better trade: same view, a third of the people.",
    },
    {
      name: "Blues Point Reserve",
      where: "McMahons Point",
      price: "~A$50 pp (prior year)",
      note: "The cheapest paid certainty on the harbour, and worth it purely to stop worrying. Buy as insurance the moment 2026 tickets appear.",
    },
    {
      name: "Harbour View Hotel",
      where: "The Rocks",
      price: "Venue entry A$50 · rooftop dinner A$395",
      note: "The value pick among the paid options: A$50 to be inside a venue with a direct Bridge sightline instead of on concrete.",
    },
    {
      name: "Blu Bar on 36, Shangri-La",
      where: "The Rocks",
      price: "A$1,349 pp — confirmed for 31 Dec 2026",
      note: "Genuinely the best indoor view in Sydney, genuinely a lot of money, and standing. A$2,698 for the couple is more than the entire suburb-tier Adventure.",
    },
    {
      name: "Harbour cruises",
      where: "King Street Wharf is the reliable boarding point",
      price: "A$800–1,400 BYO · A$2,200–3,100 all-inclusive",
      note: "Ask in writing whether the vessel has harbour exclusion-zone access, book direct with a year-round operator, never through a daily-deal site, and pay by credit card. A cruise is A$1,600–3,100 to see the same fireworks with a worse ability to move.",
    },
  ],
  deadlines: [
    {
      when: "3 Sep 2026, 9:00am AEST",
      what: "Cahill Expressway ballot opens — NSW residents only, so almost certainly out, but on the record.",
    },
    {
      when: "~October 2026",
      what: "sydneynewyearseve.com flips to the 2026 event. Re-verify every capacity, gate time and the Barangaroo BYO question.",
    },
    {
      when: "~November 2026",
      what: "NSW National Parks NYE tickets go on sale via Moshtix. Islands sell out in minutes — set an alarm.",
    },
    {
      when: "Late November 2026",
      what: "Last sensible date for cruise and venue tickets; early-bird pricing typically saves A$100+ pp.",
    },
    {
      when: "26 Dec 2026, 10:00am AEDT = 7:00am AWST",
      what: "Opera House Forecourt free tickets released — on the day of the PER→SYD flight. Whoever is not driving books it from a phone with the page already open. The highest-value 10 minutes in the Adventure.",
    },
  ],
  sources: [
    { label: "Research: capsule-sydney-nye.md", url: `${RESEARCH}capsule-sydney-nye.md` },
    {
      label: "Botanic Gardens of Sydney — NYE (confirmed 31 Dec 2026)",
      url: "https://www.botanicgardens.org.au/whats-on/new-years-eve",
    },
    {
      label: "Sydney Opera House — NYE on the Forecourt",
      url: "https://www.sydneyoperahouse.com/experiences/new-years-eve-forecourt",
    },
    {
      label: "Transport for NSW — the 46-hour timetable",
      url: "https://www.transport.nsw.gov.au/news-and-events/media-releases/sydney-trains-on-track-for-bumper-new-years-eve-operation",
    },
    {
      label: "NSW National Parks — NYE in Sydney Harbour",
      url: "https://www.nationalparks.nsw.gov.au/new-years-eve-sydney-harbour",
    },
  ],
  related: [
    "sydney-to-hobart-start-boxing-day",
    "scg-cricket-big-bash-and-the-new-years-test",
    "cockatoo-island-wareamah-camping-on-sydney-harbour",
    "field-day-new-years-day-the-domain",
    "manly-by-ferry-north-head-shelly-beach-snorkel-q",
  ],
};

/* ------------------------------------------------------------------ *
 * WA — Mundaring Hills, the arrival block
 * ------------------------------------------------------------------ */

/**
 * The one Adventure here that came from a **user directive rather than a
 * research document**, and it says so rather than borrowing a citation it does
 * not have.
 *
 * docs/CONTEXT.md names it under Anchor — *"the first days after landing are
 * spent with Paul's dad in Mundaring Hills ('it'd be rude not to') — doubling
 * as jet-lag recovery and Perth acclimatisation"* — and under Home base, where
 * Mundaring is the third of the three. That glossary entry is the source, and
 * the sources list points at it instead of a `capsule-*.md` that was never
 * written.
 *
 * Its figures are correspondingly derived, not published: three days on the
 * `home-base-city` rate card, which is the same arithmetic the ledger runs on
 * every other Home-base Day. There is no operator table because there is
 * nothing to book, and there are no deadlines because the only booking is a
 * phone call. Saying that out loud is more useful than padding it.
 */
const MUNDARING_ARRIVAL: DeepCapsule = {
  id: "mundaring-arrival",
  name: "Mundaring Hills — the arrival block",
  region: "WA — Perth Hills / Mundaring",
  tagline: "Land, sleep, eat, come back to earth. Dad's place, the borrowed car.",
  facets: ["outdoors", "food"],
  tags: ["home-base", "family", "hills", "cheap", "free", "walking", "forest"],
  seasonFit: "good",
  airport: "PER",
  base: [116.1667, -31.9000], // Mundaring township, ~35 km east of the CBD
  days: { min: 2, ideal: 3, max: 5, unit: "days" },
  /**
   * No ladder above the floor, because there is nothing above the floor to
   * buy. Free lodging, a borrowed car, and food and fuel that are emphatically
   * not free — A$45/day and A$10/day on the Perth Home-base card, plus the
   * A$20 day-to-day activities line every Day carries. Three days is A$225.
   *
   * `max` is the same trip taken as a paying visitor: three nights in a cheap
   * Perth room at A$120 plus a hire car at A$45/day, which is what the block
   * would cost if the family house were not there. It is the only honest
   * ceiling for a block whose whole value is that it is free.
   */
  cost: {
    min: { aud: 150, eur: 92, band: null, days: 2, label: "Two days" },
    ideal: { aud: 225, eur: 137, band: [137, 190], days: 3, label: "Plan on" },
    max: { aud: 720, eur: 439, band: [400, 480], days: 3, label: "If you paid for it" },
  },
  window: "The first days of the trip, whichever days those are.",
  verdict: "Non-negotiable, and the cheapest three days on the calendar.",
  why: "Twenty-two hours of flying lands the couple in a timezone seven hours out of step, and the first Perth days are the ones nobody remembers anyway. Spending them at the Hills house costs nothing but groceries and fuel, settles the family visit that would otherwise have to be squeezed in around Christmas, and lets the body clock reset before anything with a ticket on it starts.",
  durationNote:
    "Three days is two full nights of real sleep plus the day either side, which is roughly what a westbound seven-hour shift takes. Two is survivable and the ladder prices it. Five starts to eat the pre-Christmas WA run, which is Margaret River's only clear window all trip.",
  budgetShare: "€137 — under 1% of the Budget, and the lowest per-day figure in the Plan.",
  itinerary: [
    {
      day: "Day 1",
      title: "Land, drive up the hill, stop",
      body: "Perth Airport to Mundaring is ~30 km and 30 minutes on the Roe Highway — Dad collects, so there is no hire desk and no fare. The rest of the day is a shower, a meal and daylight; the one thing that actually shifts a body clock is staying awake until a local bedtime.",
    },
    {
      day: "Day 2",
      title: "Hills day",
      body: "Mundaring Weir and the Golden View lookout, the Kep and Bibbulmun tracks off the same car park, Fred Jacoby Park for shade. All free, all within fifteen minutes of the house. A supermarket run in Midland is the day's only spend.",
    },
    {
      day: "Day 3",
      title: "Down to the coast, and back",
      body: "The acclimatisation day: the borrowed car goes down to Perth or Fremantle for a beach and a wander, and comes back up the hill to sleep. It is also the natural slot for the Fremantle ideas on the bench, and — if it falls on a Friday or a Saturday — for the Perth music night.",
    },
  ],
  caveats: [
    {
      label: "It is a semi-fixed Anchor, not a hard one",
      tone: "info",
      body: "docs/CONTEXT.md rates it below Christmas and NYE: the block wants the first days after landing, and dragging the leaving date drags it along. Moving it off the arrival is allowed and warns rather than refuses, which is the whole bargain the site runs on.",
    },
    {
      label: "Thirty-five kilometres of hill between here and a band",
      tone: "warn",
      body: "There is no train from Mundaring; the nearest station is Midland, ~20 minutes' drive, and the last service back leaves well before a gig finishes. Every Perth night out is a designated driver, a A$120–170 rideshare round trip, or a room in town. docs/research/perth-live-music.md prices all three.",
    },
    {
      label: "Free lodging is not free living",
      tone: "info",
      body: "The block still charges A$45/day of groceries and A$10/day of fuel for two, because the ledger charges them everywhere and a Home base that priced at zero would flatter the total. The lever is the A$185/day it saves against a Sydney Day, and that lever is real.",
    },
    {
      label: "Summer in the Hills means fire season",
      tone: "warn",
      body: "December through February is the WA bushfire window and the Perth Hills are its front line. Nothing here needs booking, but Emergency WA warnings and total fire bans are worth a look on any day the plan involves a walk or a barbecue.",
    },
  ],
  operators: [],
  deadlines: [
    {
      when: "Whenever the flights are booked",
      what: "Tell Dad the arrival date and time. The whole block depends on one phone call and no other booking.",
    },
  ],
  sources: [
    {
      label: "docs/CONTEXT.md — Anchor, and Home base",
      url: "https://github.com/kilbot/holidays/blob/main/docs/CONTEXT.md",
    },
    {
      label: "Research: perth-live-music.md — the Mundaring transport problem",
      url: `${RESEARCH}perth-live-music.md`,
    },
    {
      label: "Research: cost-baselines.md §2 — the Home-base rate card",
      url: `${RESEARCH}cost-baselines.md`,
    },
  ],
  related: [
    "perth-live-music-night",
    "fremantle-fish-and-chips",
    "fremantle-markets-and-the-freo-alternative-scene",
    "perth-city-kings-park-cottesloe-and-boola-bardip",
  ],
};

/* ------------------------------------------------------------------ *
 * WA — Margaret River
 * ------------------------------------------------------------------ */

const MARGARET_RIVER: DeepCapsule = {
  id: "margaret-river",
  name: "Margaret River",
  region: "WA — South West / Margaret River",
  tagline: "Wine, caves and a world-class coastline within thirty minutes of each other.",
  facets: ["food", "outdoors", "beach", "road-trip", "market"],
  tags: ["wine", "food", "cave", "beach", "coast", "road-trip", "forest", "surf"],
  seasonFit: "good",
  airport: "PER",
  base: [115.0750, -33.9550], // Margaret River township
  days: { min: 2, ideal: 3, max: 5, unit: "nights" },
  // Recalibrated on #64 — the Adventure the ticket named. The published €1,375
  // was four cellar doors, a hatted lunch, two caves and A$241 nights. The
  // floor is a cheap motel at A$120, three tastings and a shared platter, and
  // Jewel Cave alone: A$982 of Days and Events, €599. Add the borrowed car's
  // Perth ⇄ Margaret River run (A$93) and it is the A$1,075 the research
  // arrives at; the Plan charges that drive as a Leg, on the day it happens.
  cost: {
    min: { aud: 670, eur: 409, band: null, days: 2, label: "Floor" },
    cheap: { aud: 772, eur: 471, band: null, days: 3, label: "Camping" },
    ideal: { aud: 982, eur: 599, band: null, days: 3, label: "Plan on" },
    max: { aud: 2259, eur: 1375, band: [1035, 2195], days: 3, label: "As published" },
  },
  window: "Mid-week, after ~5 January. Avoid 26 Dec – 3 Jan entirely.",
  verdict: "Yes — but three days is the floor, not the ideal. Four days is the honest number.",
  why: "A Home-base excursion: the Perth family house and the borrowed car mean this Adventure carries no flights and no car hire, only the nights. Its real differentiator over every other Australian wine region is that the wine, the caves and the coast are all inside a 30-minute radius — and January is the region's best weather, the exact opposite of the reef's January problem.",
  durationNote:
    "The binding constraint is the drive plus the driver: six hours of highway at the ends, and WA's 0.05 limit means one of you is spitting on the wine day. Two nights gets one clean theme done properly and a hurried version of the other. Night three costs about A$460 of lodging and food and buys back an entire theme.",
  budgetShare:
    "Both WA Adventures together at ~€1,590 are 8–13% of the Budget — the cheapest marquee content in the Plan.",
  itinerary: [
    {
      day: "Day 1",
      title: "Drive in via the north end",
      body: "Leave Perth ~08:00. Busselton at ~2h15: jetty train and Underwater Observatory (A$38 pp, book ahead). Lunch at Dunsborough or Eagle Bay Brewing. Afternoon: Ngilgi Cave and Canal Rocks. Check in ~18:00. The north end is on the way — doing it here costs zero extra kilometres.",
    },
    {
      day: "Day 2",
      title: "Wine — the Wilyabrup loop",
      body: "Vasse Felix (the 1967 original) → Cullen (biodynamic, small) → long lunch at Rustico at Hay Shed Hill → Wills Domain or Voyager for the view → Beerfarm or the Margaret River Brewhouse. Four cellar doors is the ceiling before palate fatigue; three plus a long lunch is better.",
    },
    {
      day: "Day 3",
      title: "Caves and the southern coast",
      body: "Mammoth Cave mid-morning → Boranup karri forest drive → Hamelin Bay, where the stingrays come into the shallows → Augusta, Cape Leeuwin lighthouse and Jewel Cave → sunset at Surfers Point. One clean loop instead of ping-ponging.",
    },
    {
      day: "Day 4",
      title: "Beach, market, drive out",
      body: "Margaret River Farmers Market (Sat 08:00–12:00) if the day lands, otherwise a swim at Gracetown — the most swimmable of the three surf towns. Lunch at Xanadu or Leeuwin Estate. Leave by 15:00; Bussell Highway northbound on a Sunday afternoon is the region's worst traffic.",
    },
  ],
  caveats: [
    {
      label: "The whole window is WA school holidays",
      tone: "warn",
      body: "18 Dec 2026 – 31 Jan 2027. There is no shoulder to retreat to and no 'wait a week and it's cheaper' move. Margaret River is where Perth goes for summer; mid-week beats weekend by a wide margin.",
    },
    {
      label: "26 Dec – 3 Jan is the worst window of all",
      tone: "warn",
      body: "Peak-of-peak pricing, minimum stays of 3–7 nights, and public-holiday surcharges. Target 5–15 January, mid-week.",
    },
    {
      label: "A Perth day trip is the clearest 'don't'",
      tone: "warn",
      body: "277 km, ~3 hours each way: six hours of driving for about five hours in the region, arriving in the hottest part of the day with no wine allowance for the driver.",
    },
    {
      label: "The designated-driver tax is real",
      tone: "info",
      body: "There is no clever way around WA's 0.05 limit that doesn't cost money. A small-group wine tour is ~A$320 for the couple and surrenders the day to a minibus; a private driver only makes sense at four-plus people.",
    },
    {
      label: "Ocean beaches carry real rips",
      tone: "warn",
      body: "Bay beaches (Meelup, Bunker Bay, Eagle Bay, Gracetown) are calm and swimmable. Prevelly, Yallingup's outer break and Gracetown's North Point have strong rips and are not all patrolled. Prevelly is for watching.",
    },
    {
      label: "January is the region's best weather",
      tone: "good",
      body: "Average high 25 °C, ~13 mm of rain across ~6 days, sea about 21 °C. UV is extreme on unshaded vineyard and clifftop days, so structure the caves into the middle of a hot day.",
    },
    {
      label: "Summer is the small surf season",
      tone: "info",
      body: "The famous Main Break at Prevelly is a winter and spring wave. January gives gentle beach breaks and a swimmable Yallingup lagoon — good for beginners, no spectacle.",
    },
  ],
  operators: [
    {
      name: "Vasse Felix",
      where: "Wilyabrup",
      price: "Tasting A$15–50, often waived on a purchase",
      pick: true,
      note: "The region's first winery, 1967. Cellar door, art gallery and one of Australia's most awarded restaurants (lunch 12:00–15:00). The single best 'one winery only' pick.",
    },
    {
      name: "Cullen Wines",
      where: "Wilyabrup",
      price: "Tasting A$15–25",
      pick: true,
      note: "Biodynamic, family-run, small, serious. The counterweight to Vasse Felix's polish.",
    },
    {
      name: "Rustico at Hay Shed Hill",
      where: "Wilyabrup",
      price: "Tapas and a five-course degustation",
      pick: true,
      note: "Widely called the region's best-value tasting menu, and #1 in Wilyabrup across 1,300+ TripAdvisor reviews. The wine-day lunch.",
    },
    {
      name: "Jewel Cave",
      where: "Augusta / Deepdene",
      price: "A$26",
      pick: true,
      note: "Fully guided, one hour. Most reviews call it the best of the four, and it pairs with Cape Leeuwin.",
    },
    {
      name: "Mammoth Cave",
      where: "Caves Road",
      price: "A$26",
      note: "Self-guided with audio, ~1 h, wheelchair access to the first chamber. The easy, self-paced one. Skip Lake Cave if you only want two — 355 steps and it duplicates Jewel's register.",
    },
    {
      name: "Ngilgi Cave",
      where: "Yallingup",
      price: "A$32 full · A$16 above-ground only",
      note: "The most interpretive of the four, and the one that fits the north-end drive-in day. All caves are timed-entry with bookings marked essential.",
    },
    {
      name: "Busselton Jetty — Underwater Observatory",
      where: "Busselton",
      price: "A$38 · 10% public-holiday surcharge",
      note: "1.841 km, the longest timber-piled jetty in the southern hemisphere. Capacity 44 per tour, on the hour, ~1h45 including the train. Directly on the drive-in and genuinely unusual.",
    },
    {
      name: "Cape Lodge Restaurant",
      where: "Yallingup",
      price: "Three chef hats, top 1% nationally",
      note: "The splurge dinner. Book far ahead — the top restaurants are booked out weeks in advance in January.",
    },
  ],
  deadlines: [
    {
      when: "October 2026",
      what: "Book lodging and re-snapshot rates. January 2027 averages ~A$241/night and peak periods book out months ahead with minimum stays.",
    },
    {
      when: "Before Christmas",
      what: "Restaurant bookings — Cape Lodge, Vasse Felix, Leeuwin, Rustico — for a January table.",
    },
    {
      when: "Before leaving Perth",
      what: "Book the caves. Timed entry, bookings marked essential, and closed Christmas Day.",
    },
    {
      when: "The morning of the southern loop",
      what: "Check Emergency WA. Caves Road and the karri forest routes can close for bushfire.",
    },
  ],
  sources: [
    { label: "Research: capsule-wa-southwest.md", url: `${RESEARCH}capsule-wa-southwest.md` },
    {
      label: "Capes Foundation — cave prices",
      url: "https://www.capesfoundation.org.au/visit-experiences/jewel-cave/",
    },
    { label: "Busselton Jetty — admission", url: "https://busseltonjetty.com.au/admission/" },
    { label: "Vasse Felix — visit", url: "https://www.vassefelix.com.au/visit-us" },
    {
      label: "Weather Atlas — Margaret River, January",
      url: "https://www.weather-atlas.com/en/australia/margaret-river-weather-january",
    },
  ],
  related: [
    "busselton-jetty-and-underwater-observatory",
    "cape-to-cape-track-leeuwin-naturaliste-multi-day-walk",
    "denmark-greens-pool-elephant-rocks-and-william-bay",
    "swan-valley-food-and-wine-loop",
  ],
};

/* ------------------------------------------------------------------ *
 * WA — Rottnest Island
 * ------------------------------------------------------------------ */

const ROTTNEST: DeepCapsule = {
  id: "rottnest-island",
  name: "Rottnest Island — Wadjemup",
  region: "WA — Perth / Fremantle",
  tagline: "First ferry out, bikes, two marked snorkel trails, quokkas at three.",
  facets: ["beach", "wildlife", "outdoors"],
  tags: ["island", "snorkel", "beach", "wildlife", "cycling", "day-trip", "swimming"],
  seasonFit: "good",
  airport: "PER",
  base: [115.5200, -32.0060], // Rottnest — Thomson Bay settlement
  days: { min: 1, ideal: 1, max: 2, unit: "days" },
  // Recalibrated on #64: the ferry, bikes and snorkel gear itemised at A$243
  // rather than a A$352 blend. There is no cheaper rung — the couple sleeps at
  // the Perth Home base either side, so the day carries no lodging at all.
  cost: {
    ideal: { aud: 318, eur: 194, band: null, days: 1, label: "Plan on" },
    max: { aud: 352, eur: 215, band: [140, 340], days: 1, label: "As published" },
  },
  window: "Mid-week. Weekends and the first ferry sell out.",
  verdict: "Yes, and it's the best-value day in the whole Plan.",
  why: "A car-free island 25 minutes from Fremantle with two marked snorkel trails, a marine sanctuary zone, and the one wildlife sighting in Australia you can actually plan around. At A$350 it is a A$190 premium over a free Perth beach day, and it earns it — but the answer to 'should we go twice?' is no.",
  durationNote:
    "The binding constraint is the ferry timetable, and it is generous: a ~07:00 first sailing and a late-afternoon return gives 8–9 hours ashore, which covers the whole standard day. An overnight is a genuine upgrade — the island empties after the last ferry — but summer accommodation is allocated by ballot, and one January release had 15,000 people queueing for 1,500 bookings.",
  budgetShare: "€215 — roughly 1–2% of the Budget for the best-value day in the Plan.",
  itinerary: [
    {
      day: "06:15",
      title: "Perth → Fremantle",
      body: "~20 km, or the Fremantle line train. B Shed is under renovation and the Traffic Bridge is closed, so parking is limited — on a January school-holiday morning, assume the car park is full and take the train.",
    },
    {
      day: "07:00",
      title: "First ferry",
      body: "~25 minutes, bikes and snorkel gear pre-booked with the ticket. The first ferry is the whole strategy: calm morning water, active quokkas, and you beat the day-tripper wave.",
    },
    {
      day: "08:30",
      title: "Ride west while the air is still",
      body: "Optional first stop at The Basin, 10 minutes from the settlement — sheltered reef, 400+ fish species, and the only beach with BBQs, toilets and showers. It is the busiest beach by lunchtime, so take it first or skip it.",
    },
    {
      day: "09:30",
      title: "Little Salmon Bay",
      body: "The 700 m marked snorkel trail, ten seabed plaques, sheltered and shallow. The best beginner-friendly snorkel on the island, and the water is glassiest before the breeze.",
    },
    {
      day: "11:00",
      title: "Parker Point",
      body: "The 800 m trail, twelve plaques, inside a Marine Sanctuary Zone protecting the pink coral. Best visibility on the island, and sanctuary status means more and bigger fish.",
    },
    {
      day: "12:30",
      title: "Lunch",
      body: "Geordie Bay or back at Thomson Bay. Food on the island is limited and pricey — a packed lunch is the single biggest cost lever in the day.",
    },
    {
      day: "14:00",
      title: "Wadjemup Lighthouse",
      body: "The island-wide view, and the one non-water stop worth the ride. Or Pinky Beach and Bathurst Lighthouse for an easy swim.",
    },
    {
      day: "15:00",
      title: "Quokkas",
      body: "Thomson Bay settlement, the main jetty, and the Geordie / Longreach housing. They concentrate near the settlement, not the West End, and come out of the shade late afternoon.",
    },
    {
      day: "16:00",
      title: "Bikes back, ferry home",
      body: "Never plan to the last minute — check-in cut-offs are strict and the January queue is long.",
    },
  ],
  caveats: [
    {
      label: "January is the windiest month",
      tone: "warn",
      body: "Average 20 km/h gusting to ~34. Light mornings, then the SW sea breeze — the Fremantle Doctor — builds through the afternoon. Snorkel and ride before 13:00 and the plan works; ignore it and 15:00 water is chop.",
    },
    {
      label: "UV index ~14.4, and almost no shade",
      tone: "warn",
      body: "Unprotected skin burns in under ten minutes. Rash vest for snorkelling, SPF 50+ reapplied, hat, and take the lighthouse stop in the shade of the afternoon. This is the real hazard of the day.",
    },
    {
      label: "Do not touch or feed the quokkas",
      tone: "warn",
      body: "Touching spreads disease and can cause mothers to abandon joeys. On-the-spot fines apply under the Rottnest Island Regulations and prosecution under the Biodiversity Conservation Act runs to A$10,000. Selfies are encouraged — crouch, hold the phone low, let the quokka approach.",
    },
    {
      label: "Accommodation is a ballot, not a booking",
      tone: "info",
      body: "Summer island beds are allocated by randomised online queue; roughly 10% of Christmas-holiday applicants succeed. Private options run to ~A$577/night. Plan the day trip; treat an overnight as a lottery ticket.",
    },
    {
      label: "Book the ferry weeks ahead",
      tone: "warn",
      body: "Operators state plainly that summer, weekends and school holidays sell out — and the early sailings go first.",
    },
    {
      label: "No stingers, no crocs",
      tone: "good",
      body: "Water ~21–22 °C, calm in the sheltered bays. This is not Queensland: a rash vest is for the sun, not for warmth or safety.",
    },
  ],
  operators: [
    {
      name: "SeaLink Rottnest",
      where: "Fremantle — B Shed / Victoria Quay",
      price: "≈A$56–57 same-day return incl. admission",
      pick: true,
      note: "Cheapest fare, shortest crossing (~25 min), and Fremantle is ~20 km from most of Perth. A Weekday Saver at A$65 is advertised on the 07:00 Mon–Fri sailing — confirm whether it blacks out over school holidays.",
    },
    {
      name: "Rottnest Express",
      where: "Fremantle (B Shed / Northport)",
      price: "A$85.50 incl. A$21.50 admission",
      note: "More sailings and the deepest bike/snorkel package integration, at A$29 pp more than SeaLink. Its ex-Perth service (A$129.50, ~90 min) is ruled out: A$44 pp more and two hours of island time.",
    },
    {
      name: "Rottnest Fast Ferries",
      where: "Hillarys Boat Harbour",
      price: "A$95.00 incl. admission",
      note: "Rates published 1 Jul 2026 – 31 Mar 2027, ~45 min crossing. Worth it only if the family home is in Perth's northern suburbs.",
    },
    {
      name: "Bike hire",
      where: "Rottnest Express or on-island Pedal & Flipper",
      price: "≈A$86 for two, incl. the A$5 Dec–Jan surcharge",
      pick: true,
      note: "Pre-book with the ferry. The island is car-free and mostly flat, and the good bays are 4–7 km from the settlement. Walk-up hire in January is not guaranteed.",
    },
    {
      name: "Snorkel and fins hire",
      where: "With the ferry ticket",
      price: "≈A$44 for two, from A$22 pp",
      pick: true,
      note: "Cheap, and it turns two nice beaches into two genuinely good snorkels.",
    },
    {
      name: "Island Explorer hop-on hop-off",
      where: "Around the island",
      price: "A$72 for two (A$35 pp + A$1 fuel)",
      note: "The fallback if either of them doesn't cycle or it is blowing hard. Cheaper than bikes, but it puts you on a timetable and drops you at stops rather than at the water.",
    },
  ],
  deadlines: [
    {
      when: "Weeks ahead, not days",
      what: "Ferry, mid-week, earliest sailing. Pre-book bikes and snorkel gear with the ticket.",
    },
    {
      when: "December 2026",
      what: "Re-check Fremantle terminal and parking status — the B Shed renovation and Traffic Bridge closure are live 2026 disruptions. Default to the train.",
    },
    {
      when: "Before booking",
      what: "Confirm the ferry timetable's last-return time for the exact date rather than assuming ~16:30.",
    },
  ],
  sources: [
    { label: "Research: capsule-wa-southwest.md", url: `${RESEARCH}capsule-wa-southwest.md` },
    {
      label: "Rottnest Island — snorkelling & trails",
      url: "https://www.rottnestisland.com/see-do/beaches-water-activities/snorkelling-diving",
    },
    {
      label: "Rottnest Island — quokkas and the rules",
      url: "https://www.rottnestisland.com/learn/nature-wildlife/protect-our-wildlife",
    },
    {
      label: "Rottnest Express — fares, bikes, parking",
      url: "https://rottnestexpress.com.au/ferry-information/fares/",
    },
    {
      label: "Weather & Climate — Rottnest in January",
      url: "https://weather-and-climate.com/rottnest-island-western-australia-au-January-averages",
    },
  ],
  related: [
    "penguin-island-and-shoalwater-islands-marine-park",
    "fremantle-markets-and-the-freo-alternative-scene",
    "swim-with-wild-dolphins-rockingham",
    "perth-city-kings-park-cottesloe-and-boola-bardip",
  ],
};

/* ------------------------------------------------------------------ *
 * NSW — Byron Bay + Nimbin
 * ------------------------------------------------------------------ */

const BYRON_NIMBIN: DeepCapsule = {
  id: "byron-nimbin",
  name: "Byron Bay + Nimbin",
  region: "NSW — Northern Rivers / Byron Bay",
  tagline: "One Adventure: a Byron base on foot, Nimbin as a shuttle day.",
  facets: ["beach", "hippie", "market", "outdoors"],
  tags: ["beach", "hippie", "market", "surf", "coastal-walk", "rainforest", "cheap"],
  seasonFit: "good",
  airport: "OOL",
  base: [153.6120, -28.6434], // Byron Bay — the Cape Byron end
  days: { min: 3, ideal: 5, max: 7, unit: "nights" },
  // Recalibrated on #64. The block sits after the 28 January price cliff by
  // design, so it pays the shoulder multiplier — the cheapest paid-city window
  // of the whole trip.
  cost: {
    min: { aud: 1054, eur: 643, band: null, days: 3, label: "Floor" },
    cheap: { aud: 1225, eur: 747, band: null, days: 5, label: "Camping" },
    ideal: { aud: 1574, eur: 960, band: null, days: 5, label: "Plan on" },
    max: { aud: 1754, eur: 1070, band: [825, 1650], days: 5, label: "As published" },
  },
  window: "From Thursday 28 January 2027 — the day NSW school holidays end",
  verdict: "Place it 27/28 Jan – 2 Feb, heading south. The price cliff is real and dated.",
  why: "The headline attraction is free: the Walgun Cape Byron walking track, 3.7 km of rainforest and clifftop past Wategos and The Pass to the lighthouse and the most easterly point of mainland Australia. The only paid Events are a bus and a surf lesson, which makes this a net contributor to the Event-spend pot rather than a drain on it. Nimbin is two hours of town — the day's real value is the hinterland drive, the waterfall and the country pub the tour wraps around it.",
  durationNote:
    "Byron is a small town with a short list of genuinely good things, most of them free, and it gets expensive per unit of novelty after about day four. Four nights gives three full days and Nimbin eats one, leaving two Byron days — one of which is the arrival hangover. Night five is what turns this from a stopover into a rest, and at A$150 it is the cheapest thing in the Adventure.",
  budgetShare: "The ideal at €1,070 is 5–9% of the Budget — cheap for a five-night east-coast block.",
  itinerary: [
    {
      day: "Day 1",
      title: "Arrive",
      body: "CNS→OOL in the morning, then Byron Easy Bus or Byron Bay Express (~1h05). Main Beach, sunset beer at the Beach Hotel or the Rails. A flight plus a shuttle is a whole day.",
    },
    {
      day: "Day 2",
      title: "Cape Byron, on foot",
      body: "Sunrise on the Walgun Cape Byron track — 3.7 km loop, Grade 3, past Wategos, Little Wategos and The Pass to the lighthouse. Swim at Wategos. If it's a Thursday: Byron Farmers Market, 7–11am. Afternoon surf lesson on Main Beach.",
    },
    {
      day: "Day 3",
      title: "Nimbin",
      body: "Happy Coach 09:00–16:30 (A$99 pp return) or Grasshoppers 10:00–18:00 (~A$79 pp, BBQ lunch). Waterfall swim, country pub, Cullen Street, the HEMP Embassy and the museum. Put it midweek — Grasshoppers doesn't run Sundays.",
    },
    {
      day: "Day 4",
      title: "Brunswick Heads",
      body: "Bus 640/645 north: river swim, the breakwall, the Hotel Brunswick beer garden, fish and chips. The best cheap half-day in the shire on a A$6 bus — and it is what people are describing when they say Byron used to be nice.",
    },
    {
      day: "Day 5",
      title: "Slack, or water",
      body: "Optional splurge: Go Sea Kayak Cape Byron, 2.5 h, A$99 pp with a dolphin guarantee. Otherwise a second surf, the Tallow Beach walk, or Broken Head. Also the reserve slot if weather wrote off Day 2.",
    },
    {
      day: "Day 6",
      title: "Depart",
      body: "Shuttle back to OOL for the Hobart flight. OOL→HBA runs only about three times a week — build the whole Byron block backwards from it.",
    },
  ],
  caveats: [
    {
      label: "28 January is the price cliff",
      tone: "info",
      body: "NSW summer school holidays end Wed 27 Jan 2027; Term 1 starts Thu 28 Jan. Lodging drops roughly a third the week after — about A$450 / €275 on an identical five nights.",
    },
    {
      label: "Hostel peak terms are unusually hard",
      tone: "warn",
      body: "Aquarius charges +25% for 20 Dec – 10 Jan, demands full payment a month ahead and gives no refunds inside 30 days. Some properties refuse check-in or check-out on 25 Dec and 1 Jan entirely. Read the fine print before prepaying.",
    },
    {
      label: "Beach patrols wind down at the end of January",
      tone: "warn",
      body: "Wategos and The Pass are patrolled mid-December to end of January. Main Beach is the reliable patrolled swim. Tallow Beach is unpatrolled with strong unpredictable rips year-round — walk it, do not swim it.",
    },
    {
      label: "There is no festival to plan around",
      tone: "info",
      body: "Falls Festival has been paused indefinitely since May 2023; Bluesfest was cancelled in 2026 and went into liquidation. Byron in 2027 is a beach town, not a festival town — do not let a stale search result reintroduce one.",
    },
    {
      label: "Nimbin's street dealing is persistent",
      tone: "warn",
      body: "Cullen Street's laneway is one of the most surveilled streets in Australia and dealers replace each other as fast as they are removed. Tourists get approached. Low-threat and mostly tiresome — but if either traveller would find that grim rather than funny, skip the day.",
    },
    {
      label: "Go for the hinterland, not a living counterculture",
      tone: "info",
      body: "MardiGrass is the first weekend of May; Nimbin Roots is September. A January visit gets the town on an ordinary summer weekday. A forum regular's line — 'an artificial, touristed version of what it apparently used to be' — is fair, and so is the counter that the people are warm if you slow down.",
    },
    {
      label: "No car needed",
      tone: "good",
      body: "Byron is walkable, Nimbin is a shuttle, and parking punishes cars — the lighthouse lawn is A$12/hour with a two-hour cap and fills by 08:00. Hire one day only if Minyon Falls and the hinterland are on.",
    },
    {
      label: "Crowds are the bigger complaint, not price",
      tone: "warn",
      body: "Peak school holidays mean gridlocked parking and booked restaurants. Reviewers reliably describe the town as overrun and traffic-choked — you are here for the headland and the water.",
    },
  ],
  operators: [
    {
      name: "Happy Coach — Nimbin day",
      where: "Byron Interchange, 09:00–16:30",
      price: "A$99 return (€60) · A$50 one way",
      pick: true,
      note: "Clean published pricing, a live website, bookable through the Byron Visitor Centre, and the shorter day suits a couple who don't want a ten-hour bus. Waterfall, country pub, Northern Rivers commentary.",
    },
    {
      name: "Grasshoppers — Nimbin day",
      where: "Jonson St, 10:00–18:00, not Sundays",
      price: "≈A$79 (€48), verify at booking",
      note: "Better value if it is still running as advertised — national park, waterfall, rainforest walk, BBQ lunch included. Their own domain is parked and for sale; confirm the operator is trading before paying.",
    },
    {
      name: "Walgun Cape Byron walking track",
      where: "On foot from town",
      price: "Free",
      pick: true,
      note: "The best free thing on this coast. Turtles, dolphins and stingrays offshore. Driving up is the tourist-trap version of the same view.",
    },
    {
      name: "Black Dog Surfing",
      where: "Byron Bay",
      price: "A$65 one day → A$230 for five",
      pick: true,
      note: "The cheapest credible per-lesson rate, small groups, 'standing up on your first lesson or come back free'. Their site was unreachable during research — book via a Byron agency or call.",
    },
    {
      name: "Let's Go Surfing",
      where: "Byron Bay",
      price: "≈A$58 pp, 2 h",
      note: "Max six students per instructor — the best group-size-per-dollar on the list. Rash vest, sunscreen, board and wetsuit included.",
    },
    {
      name: "Go Sea Kayak Cape Byron",
      where: "Byron Bay",
      price: "A$99 pp, 2.5 h",
      note: "The optional splurge: Cape Byron Marine Park with a dolphin, whale or turtle guarantee — free re-ride if you see nothing. Guides are qualified lifeguards.",
    },
    {
      name: "Byron Easy Bus / Byron Bay Express",
      where: "Gold Coast airport ↔ Byron",
      price: "A$30–37 in · A$45–53 out",
      note: "~1h05, about five services daily. OOL is the airport, not Ballina: it is the only one that flies direct to both Cairns and Hobart, which makes Byron a pass-through rather than a detour.",
    },
    {
      name: "Crystal Castle & Shambhala Gardens",
      where: "30 min inland",
      price: "A$49 pp — A$98 for the couple",
      note: "Skip. A paid-admission attraction in a town whose best assets are free, and it needs a car or a tour. The single easiest A$98 to not spend.",
    },
  ],
  deadlines: [
    {
      when: "Mid-November 2026",
      what: "Book lodging. Peak-season hostels and cheap privates want 6–12 weeks; holiday-park cabins want 6–12 months.",
    },
    {
      when: "October 2026",
      what: "Re-snapshot Byron rates for 28 Jan – 2 Feb 2027 — not published as of Aug 2026.",
    },
    {
      when: "Before fixing the dates",
      what: "Confirm OOL→HBA flight days for the exact week. Only ~3 weekly, and the whole block's dates hang off it.",
    },
    {
      when: "Before paying",
      what: "Confirm Grasshoppers is still trading and Black Dog Surfing is contactable — both were unverifiable at time of research.",
    },
  ],
  sources: [
    { label: "Research: capsule-byron-nimbin.md", url: `${RESEARCH}capsule-byron-nimbin.md` },
    {
      label: "NSW National Parks — Cape Byron walking track",
      url: "https://www.nationalparks.nsw.gov.au/things-to-do/walking-tracks/cape-byron-walking-track",
    },
    { label: "Happy Coach", url: "https://happycoachbyron.com/" },
    {
      label: "NSW school holidays 2026/2027",
      url: "https://australianpublicholidays.com/nsw-school-holidays-2026-2027-term-dates/",
    },
    { label: "Go Sea Kayak Byron Bay", url: "https://goseakayakbyronbay.com.au/the-byron-bay-sea-kayak-tour/" },
  ],
  related: [
    "sea-kayaking-with-dolphins-and-turtles-byron-bay",
    "arts-factory-lodge-byron-bay-the-hostel-as-the",
    "byron-hinterland-loop-federal-newrybar-bangalow-clunes",
    "nightcap-np-minyon-falls-protesters-falls-and-terania-creek",
    "the-channon-craft-market",
    "crystal-castle-and-shambhala-gardens",
    "the-northern-rivers-festival-gap-bluesfest-splendour-falls",
  ],
};

/* ------------------------------------------------------------------ *
 * VIC — Melbourne, the party weekend
 * ------------------------------------------------------------------ */

const MELBOURNE: DeepCapsule = {
  id: "melbourne-party",
  name: "Melbourne — the party weekend",
  region: "VIC — Melbourne / Fitzroy & Collingwood",
  tagline: "Cheap bed, free days, two big nights, and a buffer before the long-haul.",
  facets: ["city", "music", "festival", "market", "food", "hippie"],
  tags: ["city", "music", "techno", "psytrance", "nightlife", "market", "festival", "food"],
  seasonFit: "good",
  airport: "MEL",
  base: [144.9800, -37.7980], // Fitzroy / Collingwood, not the CBD
  days: { min: 3, ideal: 4, max: 5, unit: "nights" },
  // Recalibrated on #64. Laneway (A$400) is inside the plan-on figure: the
  // free St Kilda Festival and the NGV Triennial survive without it, so
  // dropping it is a €244 lever in the savings menu rather than a floor.
  // No camping rung — recalibrated §3.4 declines the metro holiday parks.
  cost: {
    min: { aud: 1300, eur: 793, band: null, days: 3, label: "Floor" },
    ideal: { aud: 1561, eur: 952, band: null, days: 4, label: "Plan on" },
    max: { aud: 1705, eur: 1040, band: [795, 1525], days: 4, label: "As published" },
  },
  window: "Thu 18 – Mon 22 February 2027",
  verdict: "The best party weekend on Melbourne's summer calendar inside this trip's window.",
  why: "The Smith St – Gertrude St – Johnston St spine holds The Tote, the Gasometer, New Guernica, the Collingwood Basement, the Night Cat, Glamorama and Stomping Ground within fifteen minutes on foot of each other — and the Rose St Artists' Market is five minutes from the middle of it. Two festivals land on the recommended weekend: Laneway on the Friday and the free two-day St Kilda Festival on the Saturday and Sunday.",
  durationNote:
    "The binding constraint is recovery, and it has a hard edge: this is the last block before a 24-hour flight to Europe. Four nights buys a soft arrival night so both big nights are attacked fresh, plus a genuine Buffer day and a slack departure day. Melbourne's going-out is Thursday-to-Sunday shaped — Sub Club opens Friday and Saturday only — so nights five and six would be paying inner-Melbourne lodging to drink in bars.",
  budgetShare:
    "The ideal at €1,040 is 5–9% of the Budget, and about 40% of what the reef Adventure costs. Living costs run A$290/day — 58% of the A$500 Daily cap, by design.",
  itinerary: [
    {
      day: "Thu 18 Feb",
      title: "Arrive, soft night",
      body: "Land midday, SkyBus to Southern Cross, tram 86 to Collingwood. Walk Smith and Gertrude Streets. Beer at Stomping Ground (pots A$6–8), then a pub gig at The Tote — free most nights, Carlton Draught A$8. Home by one. This banks sleep for Friday.",
    },
    {
      day: "Fri 19 Feb",
      title: "Laneways by day, big night 1",
      body: "Coffee crawl through the CBD laneways, then the NGV Triennial — free, ~100 artists from 35 countries. Lunch at Queen Victoria Market. Nap. Night: Laneway Festival at Flemington Park, or the club route — Sub Club (techno till 7am) or the Collingwood Basement. Late food at China Bar, open till 3am.",
    },
    {
      day: "Sat 20 Feb",
      title: "St Kilda Festival, big night 2",
      body: "Australia's largest free all-ages music festival, 100+ artists on the St Kilda foreshore. Swim, eat off the stalls. Back north to shower. Night: My Aeon in Brunswick if the Lunar psytrance crew are programmed, otherwise Miscellania, New Guernica or Revolver. Pho Hung Vuong is open 24 hours.",
    },
    {
      day: "Sun 21 Feb",
      title: "Buffer day",
      body: "No alarm. St Kilda Festival day 2 if there is anything left in the tank, otherwise the Rose St Artists' Market (Sun 10am–4pm, up to 120 makers) and brunch on Gertrude St. A first-class Buffer day, not leftover slack — it exists so the long-haul is boarded rested.",
    },
    {
      day: "Mon 22 Feb",
      title: "Slack, then fly",
      body: "Late checkout, coffee, a last laneway hour, SkyBus out. Never put a big night before a long-haul: two clear nights' sleep between the last club and the airport is the whole reason this Adventure is four nights and not two.",
    },
  ],
  caveats: [
    {
      label: "The venue list is the highest-churn table in the research",
      tone: "warn",
      body: "Melbourne loses and gains clubs every few months. Re-verify My Aeon, Sub Club, the Collingwood Basement, New Guernica, Miscellania and Glamorama in November 2026 before booking anything around them.",
    },
    {
      label: "There is no Victorian doof inside the window",
      tone: "warn",
      body: "Rainbow Spirit, Esoteric and Pitch all run in March, after they fly home. Aggregator sites listing 'Rainbow, 22–26 Jan 2027, Lexton' are recycling stale data. That is the honest reason this Adventure is club-shaped rather than festival-shaped.",
    },
    {
      label: "Australia Day week is the wrong window",
      tone: "info",
      body: "26 Jan 2027 is a Tuesday — a stranded midweek public holiday — the Australian Open runs 11–31 Jan and fills the city's beds at A$314–439/night, and the reef and Byron Adventures already own those dates.",
    },
    {
      label: "The tourist peak does not improve the clubbing",
      tone: "info",
      body: "The Australian Open and Australia Day week bring more people, not better line-ups. The rooms this couple wants are small, ticketed and programmed by local collectives on the ordinary weekly cycle. Ordinary weekends are better value and no worse a night out.",
    },
    {
      label: "Half-price public transport ends 1 January 2027",
      tone: "warn",
      body: "Model full fares for February — a daily cap of about A$11.40 pp, not the A$5.70 that applies through 2026. The CBD Free Tram Zone stays free.",
    },
    {
      label: "Night Network runs all Friday and Saturday",
      tone: "good",
      body: "Every metropolitan train line except two, six tram routes and 21 night buses. A Collingwood or CBD base is covered. Rideshare to Prahran and back is A$25–35 each way, more on surge.",
    },
    {
      label: "The A$180 switching rule",
      tone: "info",
      body: "Fitzroy/Collingwood and the CBD are 10–12 tram minutes apart and their venues overlap heavily. This is a price decision, not a scene decision: book whichever gives a private double under A$180/night, and break the tie toward Fitzroy.",
    },
    {
      label: "'Colour' and '276' are not bookable",
      tone: "warn",
      body: "Colour's physical venue closed and it runs as pop-ups; no Melbourne venue called 276 could be verified as trading in 2026. Do not plan around either.",
    },
  ],
  operators: [
    {
      name: "My Aeon",
      where: "791 Sydney Rd, Brunswick",
      price: "Event pricing",
      pick: true,
      note: "The only Melbourne room that regularly puts psytrance on a proper system rather than treating it as a novelty. Home of Lunar, ten years running, and it programmes 'Techno vs Psytrance' bills. Check the calendar the week the dates are fixed.",
    },
    {
      name: "Sub Club",
      where: "Flinders Court, CBD",
      price: "Cover A$10–25 pp typical",
      pick: true,
      note: "A former ANZ bank vault, ~400 capacity, Funktion-One, Fridays and Saturdays only, running to 7am. The best straight-techno night in the city and the one that goes latest.",
    },
    {
      name: "The Collingwood Basement",
      where: "0 Langridge St, under New Guernica",
      price: "Ticketed — strictly 100 per event",
      pick: true,
      note: "Funktion-One, 4am licence, 21+, queer-centred techno and label takeovers. The best small room on the northside and a two-minute walk from a Collingwood base. Sells out — buy ahead.",
    },
    {
      name: "The Tote",
      where: "71 Johnston St, Collingwood",
      price: "Free most nights · A$15–25 back room · pints A$8",
      pick: true,
      note: "Melbourne's rock-and-roll institution, shows from ~8:30pm. The correct soft-night venue.",
    },
    {
      name: "Revolver Upstairs",
      where: "229 Chapel St, Prahran",
      price: "Varies",
      note: "One of the city's rare 24-hour licences — reopens 5pm Saturday and runs to 9am Monday. The Sunday day session, not the Friday one, and southside so budget the rideshare.",
    },
    {
      name: "St Kilda Festival",
      where: "St Kilda foreshore",
      price: "Free",
      pick: true,
      note: "Sat 20 and Sun 21 Feb 2027. Australia's largest free all-ages music festival, 100+ artists — two full days of programming at zero admission, which is what lets the nights carry the spend.",
    },
    {
      name: "Laneway Festival",
      where: "Flemington Park",
      price: "A$230–260 pp (2026 GA)",
      note: "Fri 19 Feb 2027, the only Melbourne date on the 2027 tour. Melbourne sold out within an hour in 2026 — buy on the day of general sale or not at all. It replaces the Friday club night rather than adding to it.",
    },
    {
      name: "NGV Triennial",
      where: "180 St Kilda Rd",
      price: "Free · 13 Dec 2026 – 11 Apr 2027",
      note: "~100 artists from 35 countries, 80+ projects. The best free daytime hit in the city, and it covers the whole window.",
    },
    {
      name: "Rose St Artists' Market",
      where: "60 Rose St, Fitzroy",
      price: "Free entry · Sat & Sun 10am–4pm",
      pick: true,
      note: "Up to 120 makers, five minutes from a Collingwood base. Note the St Kilda Esplanade Market does not run on St Kilda Festival Sunday, so Rose St is the market to plan on.",
    },
  ],
  deadlines: [
    {
      when: "Late September 2026 onward",
      what: "Laneway Melbourne on-sale. First artist announcement was expected late Sept 2026; Melbourne sold out in an hour in 2026.",
    },
    {
      when: "November 2026",
      what: "Re-verify the whole venue shortlist, and check My Aeon / Lunar's calendar for the exact dates.",
    },
    {
      when: "November 2026",
      what: "Re-snapshot lodging for 18–22 Feb 2027 and apply the A$180/night switching rule.",
    },
    {
      when: "Before committing",
      what: "The Europe departure must be on or after 22 Feb 2027. If it cannot move, fall back to Fri 12 – Sun 14 Feb, drop both festivals, and take A$150–250 back.",
    },
  ],
  sources: [
    { label: "Research: capsule-melbourne.md", url: `${RESEARCH}capsule-melbourne.md` },
    { label: "Resident Advisor — best clubs in Melbourne 2026", url: "https://ra.co/guides/clubs-in-melbourne" },
    { label: "St Kilda Festival", url: "https://www.stkildafestival.com.au/" },
    { label: "Laneway Festival", url: "https://www.lanewayfestival.com/" },
    { label: "Rose St Artists' Market", url: "https://www.rosestmarket.com.au/" },
    {
      label: "Transport Victoria — myki fares",
      url: "https://transport.vic.gov.au/news-and-resources/campaigns/your-guide-to-myki-fares",
    },
  ],
  related: [
    "st-kilda-festival-free-beachfront-music-day",
    "midsumma-festival-and-victorias-pride-melbourne",
    "laneway-festival-2027-sydney-and-brisbane-legs",
    "melbourne-migrant-food-crawl-footscray-springvale-box-hill",
    "esoteric-festival-moyston-bush-doof",
    "pitch-music-and-arts-moyston-techno",
  ],
};

/* ------------------------------------------------------------------ */

/**
 * Trip order, not alphabetical: the arrival block, then Perth, then east and
 * south, finishing in Melbourne. The strip reads as the shape of the journey.
 */
export const DEEP_CAPSULES: readonly DeepCapsule[] = [
  MUNDARING_ARRIVAL,
  MARGARET_RIVER,
  ROTTNEST,
  SYDNEY_NYE,
  GREAT_BARRIER_REEF,
  FNQ_WILDLIFE,
  BYRON_NIMBIN,
  TASMANIA,
  MELBOURNE,
];

const BY_ID = new Map(DEEP_CAPSULES.map((capsule) => [capsule.id, capsule]));

export function deepCapsuleById(id: string): DeepCapsule | undefined {
  return BY_ID.get(id);
}

/**
 * The researched Capsules that name a given Catalog idea in their `related`
 * list — the reverse of that link.
 *
 * Worth having because it is the honest answer to a question the shallow card
 * would otherwise leave hanging: "has anyone actually looked into this?" Being
 * named in a deep Capsule's argument is not the same as being researched, and
 * the card says so — but it does mean there is somewhere to go and read.
 */
export function deepCapsulesMentioning(catalogId: string): DeepCapsule[] {
  return DEEP_CAPSULES.filter((capsule) => capsule.related.includes(catalogId));
}

/** "TAS", "QLD", "Cross-state" — the bit before the em dash, as in the Catalog. */
export function capsuleState(capsule: DeepCapsule): string {
  const dash = capsule.region.indexOf(" — ");
  return dash === -1 ? capsule.region : capsule.region.slice(0, dash);
}

/** "Hobart to Launceston" — the bit after it. */
export function capsuleWhere(capsule: DeepCapsule): string {
  const dash = capsule.region.indexOf(" — ");
  return dash === -1 ? "" : capsule.region.slice(dash + 3);
}

/** "€2,075", tabular-safe. Bands are shown separately; this is the plan-on. */
export function formatEur(value: number): string {
  return `€${value.toLocaleString("en-GB")}`;
}

/**
 * "5 nights", "1 day", "0 extra days".
 *
 * The unit is stored plural because that is how it reads in every other
 * context; one night is the case that has to be de-pluralised, and Rottnest is
 * the reason — a Capsule that is exactly one day long should not say "1 days".
 */
export function formatDayCount(count: number, unit: string): string {
  return `${count} ${count === 1 ? unit.replace(/s$/, "") : unit}`;
}

/** "3–5 nights", "1 day". The min–ideal span, for a chip or a row. */
export function formatCapsuleDays(capsule: DeepCapsule): string {
  const { min, ideal, unit } = capsule.days;
  if (min === ideal) return formatDayCount(ideal, unit);
  return `${min}–${ideal} ${unit}`;
}

/**
 * Which deep Capsule a route marker on the globe opens.
 *
 * The demo route's stops are the Capsules' own gateways, so the mapping is a
 * lookup rather than a distance search — Perth is the Home base for two WA
 * Capsules and Margaret River is the one that needs the days, so it wins.
 * Codes with no researched Capsule behind them are simply absent.
 */
export const DEEP_CAPSULE_BY_ROUTE_CODE: Readonly<Record<string, string>> = {
  PER: "margaret-river",
  SYD: "sydney-nye",
  CNS: "gbr-port-douglas",
  OOL: "byron-nimbin",
  HBA: "tasmania-arc",
  MEL: "melbourne-party",
};
