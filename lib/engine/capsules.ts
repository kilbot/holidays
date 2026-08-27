/**
 * The adapter: research content in, `CapsuleSpec` out.
 *
 * The engine core is pure and knows nothing about `deep-capsules.ts` or the 415
 * rows of `catalog.json`. This is the one module that does, and it exists so
 * that boundary holds — the scheduler and the ledger can be tested with three
 * lines of fixture rather than the whole research corpus.
 *
 * ## Locks
 *
 * Each researched Capsule publishes its window as prose ("From ~18 January —
 * the day operator off-peak pricing starts"). #8 noted that the research
 * already carries lock information — market weekdays, festival dates, flight
 * frequencies — and that the schemas should expose it as a field. Until they
 * do, `SCHEDULING` is that field, hand-derived from each document's own
 * `window` and `verdict` lines, with the reason carried across verbatim enough
 * to be checkable.
 *
 * ## Event lines
 *
 * A Capsule's published cost is **not** used as a cost input, and this is the
 * most important thing in the file. #10 is explicit: the published figures used
 * mid-tier lodging and restaurant food, and the model runs at the floor. So the
 * ledger prices the living lines from `constants.ts` and each Capsule
 * contributes only its **Event spend** — the reef boat days, the festival
 * tickets, the cruises — as separate visible line items, which is what
 * docs/CONTEXT.md says Event spend is. `cost.max`, the version the research
 * originally published, rides along on `publishedEur` purely so a drill-in can
 * show the two side by side.
 *
 * Every Event figure below appears in `docs/research/` — the operators tables
 * in the capsule documents, or `cost-baselines.md` §3.4.
 *
 * ## The #64 floor ladder
 *
 * Recalibrated 27 August 2026 against `cost-floors-recalibrated.md` §6. Half of
 * that table is an **operator swap the research documents already recommend** —
 * Passions of Paradise instead of Wavelength, Grasshoppers instead of Happy
 * Coach, Jewel Cave without Mammoth, the Manly ferry without the Opera House
 * tour — plus one correction *upward*, the Tasmania parks pass at its published
 * A$98.35. Those are mechanical and they live here, at the plan-on figure, with
 * the version they replaced as the band's top.
 *
 * The other half — the two Pennicott cruises, the second reef boat, Laneway —
 * is **the couple's call, not the model's**. Those lines stay here at full
 * price and a Scenario switches them off through `eventOverrides`, which is
 * what the savings menu is for. Plan-on is a floor, not a decision made on
 * somebody's behalf.
 */

import {
  AUD_TO_EUR,
  DEFAULT_LODGING_TIER,
  MARKETS,
  lodgingRate,
  type Rate,
} from "@/lib/engine/constants";
import { locationById, locationIdForAirport } from "@/lib/engine/locations";
import type { CapsuleEvent, CapsuleSpec, Lock } from "@/lib/engine/types";
import { CATALOG, type CatalogIdea } from "@/lib/catalog";
import { DEEP_CAPSULES, type DeepCapsule } from "@/lib/deep-capsules";

const RESEARCH = "docs/research/";

const aud = (plan: number, low = plan, high = plan): Rate => ({
  plan,
  band: [low, high],
});

interface Scheduling {
  locationId: string;
  lock: Lock;
  needsCar: boolean;
  events: readonly CapsuleEvent[];
}

/**
 * What each researched Capsule needs from the calendar, and what it spends.
 *
 * `dayOffset` is 0-based into the block, so an Event follows its Capsule when
 * the Capsule is dragged — the reef day is the second day of the reef Capsule
 * wherever the reef Capsule lands.
 */
const SCHEDULING: Readonly<Record<string, Scheduling>> = {
  "mundaring-arrival": {
    locationId: "mundaring",
    lock: {
      kind: "arrival",
      why: "docs/CONTEXT.md's semi-fixed Anchor: the first days after landing are spent with Paul's dad in Mundaring Hills — jet-lag recovery and Perth acclimatisation, before anything with a ticket on it starts.",
    },
    // Home base #3. The car is Dad's, so the block hires nothing.
    needsCar: false,
    // No Event lines at all, and that is the point of the block: three days
    // whose entire cost is the groceries and the fuel the ledger already
    // charges. A jet-lag block with a splurge on it is not a jet-lag block.
    events: [],
  },

  "margaret-river": {
    locationId: "margaret-river",
    // The one hard exclusion the research states is 26 Dec – 3 Jan. The WA leg
    // runs before Christmas, so that is the clear run this Capsule has.
    lock: {
      kind: "window",
      from: "2026-12-01",
      to: "2026-12-23",
      why: "mid-week, and clear of 26 Dec – 3 Jan entirely — the WA leg's only free run is before Christmas. capsule-wa-southwest.md",
    },
    // A Home-base excursion: the family car makes the drive, so no hire.
    needsCar: false,
    // Busselton Jetty (A$76) was benched by the #64 recalibration: it is a
    // drive-in extra on the way down, not part of the Adventure. It is still
    // on the card's own itinerary, where a thing you might do belongs.
    events: [
      {
        id: "mr-wine",
        label: "Wilyabrup cellar doors & a shared platter",
        aud: aud(150, 120, 300),
        dayOffset: 1,
        source: `${RESEARCH}capsule-wa-southwest.md, at the cost-floors-recalibrated.md §6 floor — three tastings (often waived on a purchase) and a shared platter, not a hatted degustation. The band's top is the long lunch.`,
      },
      {
        id: "mr-caves",
        label: "Jewel Cave",
        aud: aud(52, 52, 120),
        dayOffset: 2,
        source: `${RESEARCH}capsule-wa-southwest.md — A$26 pp, the document's own pick. Mammoth duplicates its register; the band's top is doing both.`,
      },
    ],
  },

  "rottnest-island": {
    locationId: "rottnest",
    lock: {
      kind: "weekday",
      // Monday–Friday. `weekdayOf` is 0 = Sunday.
      weekdays: [1, 2, 3, 4, 5],
      why: "mid-week — weekends and the first ferry sell out, and the first ferry is the whole strategy. capsule-wa-southwest.md",
    },
    needsCar: false,
    events: [
      {
        id: "rotto-ferry",
        label: "Rottnest ferry, bikes and snorkel gear",
        aud: aud(243, 243, 400),
        dayOffset: 0,
        source: `${RESEARCH}capsule-wa-southwest.md, itemised at the cost-floors-recalibrated.md §6 floor — SeaLink A$113, bikes A$86, snorkel gear A$44. Ferry pricing is dynamic; the band's top is a late booking.`,
      },
    ],
  },

  "sydney-nye": {
    locationId: "sydney",
    lock: {
      kind: "date",
      from: "2026-12-30",
      to: "2027-01-02",
      why: "New Year's Eve is in Sydney and the date does not move. Sydney charges most for the nights before it, so the block buys the fewest it can before 31 Dec and takes its extra days after. docs/CONTEXT.md",
    },
    // cost-baselines §3.2: do not rent in the Sydney CBD at all. Good transit,
    // and parking is A$50–80/day on top.
    needsCar: false,
    events: [
      {
        id: "nye-harbour",
        label: "Harbour icons — the Manly ferry",
        aud: aud(16, 16, 112),
        dayOffset: 1,
        source: `${RESEARCH}capsule-sydney-nye.md at the cost-floors-recalibrated.md §6 floor — the Manly ferry at ~A$8 pp inside the daily Opal cap is the best-value hour in Sydney. The A$96 Opera House tour is the band's top, and a splurge.`,
      },
      {
        id: "nye-night",
        label: "New Year's Eve — vantage point and provisions",
        aud: aud(60, 0, 600),
        // Date-locked. The offset used to put this on 30 December, because the
        // Scheduler proposes the block on the 28th — #64 §7.2.
        dayOffset: 2,
        date: "2026-12-31",
        source: `${RESEARCH}capsule-sydney-nye.md — the free ticketed vantage points cost nothing but a queue; the band's top is a ticketed NPWS site at A$100–300 pp, prices not published as of Aug 2026.`,
      },
    ],
  },

  "gbr-port-douglas": {
    locationId: "port-douglas",
    lock: {
      kind: "window",
      from: "2027-01-18",
      to: "2027-01-31",
      why: "from about 18 January the day boats drop to off-peak prices, and January is Cairns' low season anyway. capsule-great-barrier-reef.md",
    },
    needsCar: true,
    events: [
      {
        id: "gbr-wavelength",
        label: "Reef day I — outer ribbon reefs",
        aud: aud(550, 550, 636),
        dayOffset: 1,
        source: `${RESEARCH}capsule-great-barrier-reef.md at the cost-floors-recalibrated.md §6 floor — Passions of Paradise ex-Cairns is the cheapest credible boat at A$275 pp; Wavelength at A$636 is the band's top and the upgrade rung.`,
      },
      {
        id: "gbr-rainforest",
        label: "Mossman Gorge and the Daintree ferry",
        aud: aud(60, 40, 120),
        dayOffset: 2,
        source: `${RESEARCH}capsule-great-barrier-reef.md — the weatherproof day, and the reserve slot if a reef day is blown out.`,
      },
      {
        id: "gbr-poseidon",
        label: "Reef day II — Poseidon, plus an intro dive each",
        aud: aud(754, 734, 814),
        dayOffset: 3,
        source: `${RESEARCH}capsule-great-barrier-reef.md — Agincourt ribbon sites, plus an introductory dive at A$92 pp, no certification.`,
      },
    ],
  },

  "fnq-wildlife": {
    locationId: "port-douglas",
    lock: {
      kind: "window",
      from: "2027-01-18",
      to: "2027-01-31",
      why: "it rides along inside the reef Adventure's own 18–31 January window. capsule-fnq-wildlife.md",
    },
    needsCar: true,
    events: [
      {
        id: "fnq-croc",
        label: "Daintree croc cruise",
        aud: aud(70, 70, 260),
        dayOffset: 0,
        source: `${RESEARCH}capsule-fnq-wildlife.md at the cost-floors-recalibrated.md §6 floor — Solar Whisper, one hour, timed to a low tide, which is the document's own free lever. The band's top adds Wildlife Habitat Port Douglas.`,
      },
    ],
  },

  "byron-nimbin": {
    locationId: "byron",
    lock: {
      kind: "window",
      from: "2027-01-28",
      to: "2027-02-18",
      why: "from Thursday 28 January 2027, the day NSW school holidays end — the price cliff is real and dated. capsule-byron-nimbin.md",
    },
    needsCar: false,
    events: [
      {
        id: "byron-surf",
        label: "Surf lesson, Main Beach",
        aud: aud(116, 116, 200),
        dayOffset: 1,
        source: `${RESEARCH}capsule-byron-nimbin.md at the cost-floors-recalibrated.md §6 floor — Let's Go Surfing at A$58 pp.`,
      },
      {
        id: "byron-nimbin-day",
        label: "Nimbin day — shuttle, waterfall, country pub",
        aud: aud(158, 158, 240),
        dayOffset: 2,
        source: `${RESEARCH}capsule-byron-nimbin.md at the cost-floors-recalibrated.md §6 floor — Grasshoppers at ~A$79 pp with lunch, if it is trading; Happy Coach at A$99 pp return is the band's top.`,
      },
    ],
  },

  "tasmania-arc": {
    locationId: "tasmania",
    lock: {
      kind: "window",
      from: "2027-01-13",
      to: "2027-02-20",
      why: "from about 13 January, once the New Year fare peak is over. February is quietly better again. capsule-tasmania.md",
    },
    needsCar: true,
    events: [
      {
        id: "tas-parks",
        label: "Parks Holiday Vehicle Pass",
        // The one figure the recalibration moved **upward**: the published
        // Holiday Vehicle Pass is A$98.35, not the A$90 this file carried.
        aud: aud(98.35),
        dayOffset: 0,
        source: `${RESEARCH}capsule-tasmania.md, corrected in cost-floors-recalibrated.md §3.2 — the published Holiday Vehicle Pass is A$98.35: eight weeks, all parks, per vehicle.`,
      },
      {
        id: "tas-mona",
        label: "MONA and the ferry",
        aud: aud(138),
        dayOffset: 1,
        source: `${RESEARCH}capsule-tasmania.md and cost-baselines §3.4 — entry A$39 pp, ferry A$30 pp return.`,
      },
      {
        id: "tas-tasman",
        label: "Tasman Island cruise",
        aud: aud(300, 280, 360),
        dayOffset: 2,
        source: `${RESEARCH}capsule-tasmania.md — Pennicott, per couple.`,
      },
      {
        id: "tas-wineglass",
        label: "Wineglass Bay cruise",
        aud: aud(320, 300, 380),
        dayOffset: 4,
        source: `${RESEARCH}capsule-tasmania.md — Pennicott, per couple.`,
      },
    ],
  },

  "melbourne-party": {
    locationId: "melbourne",
    lock: {
      kind: "date",
      from: "2027-02-19",
      to: "2027-02-21",
      why: "Laneway lands on the Friday and the free two-day St Kilda Festival on the Saturday and Sunday. Both are fixed dates. capsule-melbourne.md",
    },
    needsCar: false,
    events: [
      {
        id: "mel-laneway",
        label: "Laneway Festival, two tickets",
        aud: aud(400, 340, 480),
        // Date-locked: a festival is a date. A Melbourne block moved off the
        // weekend is a Melbourne block without a ticket to buy.
        dayOffset: 1,
        date: "2027-02-19",
        source: `${RESEARCH}capsule-melbourne.md — Flemington Park, the Friday.`,
      },
      {
        id: "mel-club",
        label: "Club night — Brunswick or Collingwood",
        aud: aud(120, 80, 200),
        dayOffset: 2,
        source: `${RESEARCH}capsule-melbourne.md — entry and drinks for two; St Kilda Festival itself is free.`,
      },
    ],
  },
};

/** A researched Capsule, as the engine wants it. */
function fromDeep(capsule: DeepCapsule): CapsuleSpec | null {
  const scheduling = SCHEDULING[capsule.id];
  if (!scheduling) return null;

  return {
    id: capsule.id,
    name: capsule.name,
    locationId: scheduling.locationId,
    days: capsule.days.ideal,
    minDays: Math.max(1, capsule.days.min),
    lock: scheduling.lock,
    needsCar: scheduling.needsCar,
    events: scheduling.events,
    // The **published** figure is the ladder's ceiling now that `ideal` is the
    // recalibrated plan-on: the drill-in's cross-check is "what the research
    // first wrote up vs what the Plan charges", and comparing plan-on to
    // plan-on would compare a number to itself.
    publishedEur: capsule.cost.max.eur,
    tier: "deep",
  };
}

/**
 * Locks for Catalog ideas whose research actually pinned one.
 *
 * A Catalog entry has no lock field — the sweep recorded thirteen columns and a
 * weekday was not one of them — so an idea marked **Plan** floats. That is the
 * right default for almost all 415 of them, and wrong for the handful the
 * research went back and dated. `docs/research/perth-live-music.md` is explicit:
 * *"Lock the Perth music night to a Friday or Saturday"*, because those are the
 * only nights every room in the shortlist is on.
 *
 * This is the shallow tier's version of `SCHEDULING` above, and it is
 * deliberately tiny: an entry here means somebody read a research document and
 * wrote the constraint down, not that a heuristic guessed at one. Everything
 * absent stays flexible.
 */
const CATALOG_LOCKS: Readonly<Record<string, Lock>> = {
  "perth-live-music-night": {
    kind: "weekday",
    // Friday and Saturday. `weekdayOf` is 0 = Sunday.
    weekdays: [5, 6],
    why: "Friday and Saturday are the only nights everything is on — the rest of the week is one room each, and the cheap Wed/Sun options finish early on purpose. perth-live-music.md",
  },
};

/**
 * A Catalog idea marked **Plan**, as the engine wants it.
 *
 * The Catalog quotes one all-in AUD band per idea, which covers the visit's
 * nights as well as its activities. The ledger is already charging those nights
 * from `constants.ts`, so folding the whole figure in as Event spend would
 * count them twice. Instead the Event line is the **excess** over what a floor
 * day at that Location costs, and where the idea is cheaper than the floor it
 * contributes no Event line at all — it is a place to be, not a thing to buy.
 *
 * The subtraction uses the un-peaked floor rate rather than the Days' actual
 * prices, because the adapter runs before the Scheduler has decided any dates.
 * That is an approximation, and it is the only one in the cost model.
 */
function fromCatalog(idea: CatalogIdea): CapsuleSpec {
  const locationId = locationIdForAirport(idea.nearest_airport);
  const location = locationById(locationId);
  const market = MARKETS[location.market];
  const days = Math.max(1, idea.days_ideal || idea.days_min || 1);

  const floorPerDay =
    lodgingRate(location.market, DEFAULT_LODGING_TIER).rate.plan +
    market.food.plan +
    market.local.plan +
    market.activities.plan;
  const floor = floorPerDay * days;

  const excess = Math.max(0, idea.costAudMin - floor);
  const excessHigh = Math.max(0, idea.costAudMax - floor);

  return {
    id: idea.id,
    name: idea.name,
    locationId,
    days,
    minDays: Math.max(1, idea.days_min || 1),
    lock: CATALOG_LOCKS[idea.id] ?? { kind: "flexible" },
    needsCar: false,
    events:
      excessHigh > 0
        ? [
            {
              id: `catalog:${idea.id}`,
              label: idea.name,
              aud: aud(excess, excess, excessHigh),
              dayOffset: 0,
              source: `Catalog: A$${idea.rough_cost_couple_aud} all-in for the couple (${idea.cost_confidence} confidence), less the ${days}-day living floor the ledger already charges.`,
            },
          ]
        : [],
    publishedEur: idea.costEurMin || null,
    tier: "catalog",
  };
}

/** Every researched Capsule, in the order `deep-capsules.ts` lists them. */
export const DEEP_SPECS: readonly CapsuleSpec[] = DEEP_CAPSULES.map(fromDeep)
  .filter((spec): spec is CapsuleSpec => Boolean(spec));

const CATALOG_SPECS = new Map<string, CapsuleSpec>();

/**
 * The Capsules the engine can place: the nine researched ones, plus whichever
 * Catalog ideas the Travellers have marked **Plan**.
 *
 * Catalog specs are built lazily and cached — 415 of them would be 415 objects
 * built on every keystroke of the sift, and only the placed handful is ever
 * scheduled. docs/CONTEXT.md's shortlist state `placed` is exactly "on the
 * Plan — give it calendar days", which is what being here means.
 */
export function capsuleCatalogue(placedIds: readonly string[]): CapsuleSpec[] {
  const specs = [...DEEP_SPECS];
  const deepIds = new Set(specs.map((spec) => spec.id));

  for (const id of placedIds) {
    if (deepIds.has(id)) continue;
    let spec = CATALOG_SPECS.get(id);
    if (!spec) {
      const idea = CATALOG.find((entry) => entry.id === id);
      if (!idea) continue;
      spec = fromCatalog(idea);
      CATALOG_SPECS.set(id, spec);
    }
    specs.push(spec);
  }

  return specs;
}

/** The researched Capsules' own published totals, EUR, for the drill-in. */
export function publishedTotalEur(ids: readonly string[]): number {
  return DEEP_SPECS.filter((spec) => ids.includes(spec.id)).reduce(
    (total, spec) => total + (spec.publishedEur ?? 0),
    0,
  );
}

/** A$ → €, at the model rate. Exported so the UI never re-hardcodes 0.61. */
export function audToEur(amount: number): number {
  return amount * AUD_TO_EUR;
}
