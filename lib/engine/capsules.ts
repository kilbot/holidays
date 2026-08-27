/**
 * The adapter: research content in, `CapsuleSpec` out.
 *
 * The engine core is pure and knows nothing about `deep-capsules.ts` or the 413
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
 * A Capsule's published `cost.ideal` is **not** used as a cost input, and this
 * is the most important thing in the file. #10 is explicit: the published
 * figures used mid-tier lodging and restaurant food, and the model runs at the
 * floor. So the ledger prices the living lines from `constants.ts` and each
 * Capsule contributes only its **Event spend** — the reef boat days, the
 * festival tickets, the cruises — as separate visible line items, which is what
 * docs/CONTEXT.md says Event spend is. The published figure rides along on
 * `publishedEur` purely so a drill-in can show the two side by side.
 *
 * Every Event figure below appears in `docs/research/` — the operators tables
 * in the capsule documents, or `cost-baselines.md` §3.4.
 */

import { AUD_TO_EUR, MARKETS, type Rate } from "@/lib/engine/constants";
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
  "margaret-river": {
    locationId: "margaret-river",
    // The one hard exclusion the research states is 26 Dec – 3 Jan. The WA leg
    // runs before Christmas, so that is the clear run this Capsule has.
    lock: {
      kind: "window",
      from: "2026-12-01",
      to: "2026-12-23",
      why: "capsule-wa-southwest.md: mid-week, and avoid 26 Dec – 3 Jan entirely. The WA leg's only clear run is before Christmas.",
    },
    // A Home-base excursion: the family car makes the drive, so no hire.
    needsCar: false,
    events: [
      {
        id: "mr-busselton",
        label: "Busselton Jetty & Underwater Observatory",
        aud: aud(76),
        dayOffset: 0,
        source: `${RESEARCH}capsule-wa-southwest.md — A$38 pp, book ahead.`,
      },
      {
        id: "mr-wine",
        label: "Wilyabrup cellar doors & long lunch",
        aud: aud(300, 220, 420),
        dayOffset: 1,
        source: `${RESEARCH}capsule-wa-southwest.md — Vasse Felix, Cullen, lunch at Rustico. Three cellar doors plus a long lunch.`,
      },
      {
        id: "mr-caves",
        label: "Mammoth and Jewel Caves",
        aud: aud(120, 96, 160),
        dayOffset: 2,
        source: `${RESEARCH}capsule-wa-southwest.md — the two caves worth the entry, per couple.`,
      },
    ],
  },

  "rottnest-island": {
    locationId: "rottnest",
    lock: {
      kind: "weekday",
      // Monday–Friday. `weekdayOf` is 0 = Sunday.
      weekdays: [1, 2, 3, 4, 5],
      why: "capsule-wa-southwest.md: mid-week. Weekends and the first ferry sell out, and the first ferry is the whole strategy.",
    },
    needsCar: false,
    events: [
      {
        id: "rotto-ferry",
        label: "Rottnest ferry, bikes and snorkel gear",
        aud: aud(352, 230, 500),
        dayOffset: 0,
        source: `${RESEARCH}capsule-wa-southwest.md and cost-baselines §2.3 — ferry A$48–70 pp return, bikes ~A$35 pp, dynamic pricing.`,
      },
    ],
  },

  "sydney-nye": {
    locationId: "sydney",
    lock: {
      kind: "date",
      from: "2026-12-30",
      to: "2027-01-02",
      why: "docs/CONTEXT.md hard Anchor: New Year's Eve in Sydney. The research's rule is to buy the minimum nights before 31 Dec and all the extra days after it, so the block has to cover 30 Dec – 2 Jan.",
    },
    // cost-baselines §3.2: do not rent in the Sydney CBD at all. Good transit,
    // and parking is A$50–80/day on top.
    needsCar: false,
    events: [
      {
        id: "nye-harbour",
        label: "Harbour icons — Opera House and the Manly ferry",
        aud: aud(112),
        dayOffset: 1,
        source: `${RESEARCH}capsule-sydney-nye.md — Opera House tour A$48 pp, Manly ferry ~A$8 pp inside the daily Opal cap.`,
      },
      {
        id: "nye-night",
        label: "New Year's Eve — vantage point and provisions",
        aud: aud(120, 0, 600),
        dayOffset: 2,
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
      why: "capsule-great-barrier-reef.md: from ~18 January, the day operator off-peak pricing starts. January is also Cairns' low season.",
    },
    needsCar: true,
    events: [
      {
        id: "gbr-wavelength",
        label: "Reef day I — Wavelength, outer ribbon reefs",
        aud: aud(570, 550, 630),
        dayOffset: 1,
        source: `${RESEARCH}capsule-great-barrier-reef.md and cost-baselines §3.4 — outer-reef day trip A$276–317 pp.`,
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
      why: "capsule-fnq-wildlife.md: inside the reef Adventure's 18–31 January window.",
    },
    needsCar: true,
    events: [
      {
        id: "fnq-croc",
        label: "Daintree croc cruise and Wildlife Habitat",
        aud: aud(160, 120, 260),
        dayOffset: 0,
        source: `${RESEARCH}capsule-fnq-wildlife.md — Solar Whisper and Wildlife Habitat Port Douglas, per couple.`,
      },
    ],
  },

  "byron-nimbin": {
    locationId: "byron",
    lock: {
      kind: "window",
      from: "2027-01-28",
      to: "2027-02-18",
      why: "capsule-byron-nimbin.md: from Thursday 28 January 2027, the day NSW school holidays end. The price cliff is real and dated.",
    },
    needsCar: false,
    events: [
      {
        id: "byron-surf",
        label: "Surf lesson, Main Beach",
        aud: aud(150, 120, 200),
        dayOffset: 1,
        source: `${RESEARCH}capsule-byron-nimbin.md — per couple.`,
      },
      {
        id: "byron-nimbin-day",
        label: "Nimbin day — shuttle, waterfall, country pub",
        aud: aud(198, 158, 240),
        dayOffset: 2,
        source: `${RESEARCH}capsule-byron-nimbin.md — Happy Coach A$99 pp return, or Grasshoppers ~A$79 pp with lunch.`,
      },
    ],
  },

  "tasmania-arc": {
    locationId: "tasmania",
    lock: {
      kind: "window",
      from: "2027-01-13",
      to: "2027-02-20",
      why: "capsule-tasmania.md: from about 13 January, after the New Year fare peak. February is quietly better.",
    },
    needsCar: true,
    events: [
      {
        id: "tas-parks",
        label: "Parks Holiday Vehicle Pass",
        aud: aud(90),
        dayOffset: 0,
        source: `${RESEARCH}capsule-tasmania.md — eight weeks, all parks, per vehicle.`,
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
      why: "capsule-melbourne.md: Laneway lands on the Friday and the free two-day St Kilda Festival on the Saturday and Sunday. Both are dated.",
    },
    needsCar: false,
    events: [
      {
        id: "mel-laneway",
        label: "Laneway Festival, two tickets",
        aud: aud(400, 340, 480),
        dayOffset: 1,
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
    publishedEur: capsule.cost.ideal.eur,
    tier: "deep",
  };
}

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
    market.lodging.airbnb.plan +
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
    lock: { kind: "flexible" },
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
 * The Capsules the engine can place: the eight researched ones, plus whichever
 * Catalog ideas the Travellers have marked **Plan**.
 *
 * Catalog specs are built lazily and cached — 413 of them would be 413 objects
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
