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
      // The couple's own booking, not a research default: train Valencia →
      // Madrid, then Cathay Pacific MAD → HKG → PER on one ticket. The Madrid
      // departure is the 22:30 (`flight-hubs.md`: "the only long-haul in the
      // grid a same-day 1h56 train can safely feed"), Hong Kong is a
      // same-ticket connection rather than a stopover, and about 25 hours later
      // they land in Perth at dawn **two** days after leaving. No hotel night
      // at either end of it — the two Days in between price at the transit
      // market, which is the honest cost of being in the air.
      landsAfter: 2,
      why: "docs/CONTEXT.md's semi-fixed Anchor: the first days after landing are spent with Paul's dad in Mundaring Hills — jet-lag recovery and Perth acclimatisation, before anything with a ticket on it starts.",
    },
    // Home base #3. The car is Dad's, so the block hires nothing.
    needsCar: false,
    // No Event lines at all, and that is the point of the block: three days
    // whose entire cost is the groceries and the fuel the ledger already
    // charges. A jet-lag block with a splurge on it is not a jet-lag block.
    events: [],
  },

  "morawa-christmas": {
    locationId: "morawa",
    lock: {
      kind: "date",
      from: "2026-12-25",
      to: "2026-12-25",
      why: "Christmas Day is at the sister's farm in Morawa and the date does not move. The block covers the day plus the drives either side — 370 km up the Midlands road and 370 km back. docs/CONTEXT.md",
    },
    // Home base #2. The car is the family's, and the fuel is a Leg.
    needsCar: false,
    events: [
      {
        id: "morawa-christmas-table",
        label: "Christmas contribution — ham, prawns, drinks, presents",
        aud: aud(150, 80, 350),
        // Nailed to the day rather than the block, so dragging the block does
        // not move Christmas lunch off Christmas.
        dayOffset: 2,
        date: "2026-12-25",
        source: "docs/CONTEXT.md — the Christmas Anchor. Nobody drives four hours to a family Christmas empty-handed; A$150 is a couple's share of a farm table, and the band's top is bringing the seafood.",
      },
    ],
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
      // …and inside the WA leg. A ferry from Fremantle is not something the
      // couple can take from Port Douglas, and without the corridor the
      // Scheduler proposed exactly that once January filled up (#54).
      from: "2026-12-15",
      to: "2026-12-29",
      why: "mid-week — weekends and the first ferry sell out, and the first ferry is the whole strategy — and inside the WA leg, which ends when the couple flies east for New Year's Eve. capsule-wa-southwest.md",
    },
    needsCar: false,
    events: [
      {
        // The ferry itself is no longer here. It is a Leg — you cannot drive to
        // Rottnest, and the two hops either side of the island are the boat
        // (kilbot/holidays#101). What is left on the Day is the gear, which is
        // what the couple actually buys once they are ashore.
        id: "rotto-ferry",
        label: "Bikes and snorkel gear",
        aud: aud(130, 116, 200),
        dayOffset: 0,
        source: `${RESEARCH}capsule-wa-southwest.md, itemised at the cost-floors-recalibrated.md §6 floor — bikes A$86 for two (A$38/day plus the A$5 Dec–Jan holiday surcharge each) and snorkel and fins A$44. The band's low is Pedal & Flipper's on-island A$36/day; its top is the Rottnest Express bundle at ~A$60 pp of gear. The A$114 SeaLink crossing is its own Leg, priced on the transit rows either side of the island.`,
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
      to: "2027-01-23",
      why: "it rides along on the end of the reef Adventure, not merely inside its window — the Cape Tribulation overnight is bought from the reef base, and a croc cruise ten days after leaving Port Douglas is a different trip. capsule-fnq-wildlife.md",
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
      to: "2027-02-03",
      why: "from Thursday 28 January 2027, the day NSW school holidays end — the price cliff is real and dated. The top of the window used to run to 18 February and now closes on the 3rd, which is the southbound order written down: Byron is the last stop on the way down from the reef, not a February destination. capsule-byron-nimbin.md",
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
      from: "2027-01-31",
      to: "2027-02-12",
      why: "February, which capsule-tasmania.md calls quietly better again — and Party In The Paddock, 4–7 February, sits inside it. The window used to open on 13 January, and that is what put Hobart between Sydney and the reef: the Scheduler places the longest window-locked block first and takes the earliest good week its window allows. capsule-tasmania.md",
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
  /*
   * The Far North Queensland stretch, #54's "way more time in North Queensland
   * than New South Wales".
   *
   * These four windows are the whole mechanism. The couple leaves Sydney on
   * about 7 January instead of idling there until the reef window opens on the
   * 18th, and the eleven days that buys are spent on the Tablelands and the
   * Cassowary Coast rather than on Sydney lodging at A$140 a night.
   *
   * **What it costs, said out loud:** `domestic-flights.md` puts SYD→CNS at
   * A$280–400 for the couple in the 1–10 January peak against A$150–220 from
   * about the third week, and calls a reef block placed 12–24 January
   * "significantly cheaper" than one placed 2–10 January. Flying north on the
   * 7th knowingly pays that. Roughly half of it comes back as living cost — a
   * Sydney floor day is A$240 and a Port Douglas one is A$240×0.8 in the
   * January low season — and the rest is what the directive costs. Moving these
   * two windows to 2027-01-11 is the one-line change that takes the cheap fare
   * and gives the days back to Sydney.
   */
  "atherton-tablelands-waterfall-circuit-millaa-millaa-zillie-ellinjaa": {
    kind: "window",
    from: "2027-01-07",
    to: "2027-01-17",
    why: "the Tablelands stretch sits between the Sydney block and the reef window, which is the gap the #54 directive moved north. capsule-fnq-wildlife.md puts the Tablelands at 1.5 h from Cairns and calls them a different base from the reef.",
  },
  "crater-lakes-lake-eacham-and-lake-barrine": {
    kind: "window",
    from: "2027-01-07",
    to: "2027-01-17",
    why: "a free Tablelands day inside the same pre-reef stretch. capsule-fnq-wildlife.md",
  },
  "yungaburra-curtain-fig-platypus-and-the-monthly-market": {
    kind: "window",
    from: "2027-01-07",
    to: "2027-01-17",
    why: "the platypus and tree-kangaroo half of the Tablelands, which capsule-fnq-wildlife.md says is a different capsule with a different base — and this is that base.",
  },
  "mission-beach-skydive-and-dunk-island": {
    kind: "window",
    from: "2027-01-24",
    to: "2027-01-27",
    why: "southbound, after the reef and the Cape Trib night and before Byron — which is the only configuration capsule-fnq-wildlife.md endorses: \"if the Plan drives or buses south down the Bruce Highway, Mission Beach is directly on the route\". Etty Bay, 40 minutes north of it, is the best wild-cassowary site in Australia. The Catalog rates the entry's own season fit poor: this is wet season and the skydive is the part that gets weathered out, not the birds.",
  },

  /*
   * The two WA evenings, at the **front** of the leg rather than the back
   * (#95).
   *
   * The user's own sequence is *Mundaring base — Perth and Fremantle days from
   * it — then Margaret River, Rottnest, Morawa for Christmas, and back to
   * Perth*: the city nights are day trips out of Paul's dad's place while the
   * couple is still finding its feet, not a second stay tacked on after the
   * farm. Left where they were (26–29 Dec) they were the last two days of the
   * leg, which is the reading the map showed and the couple did not recognise.
   *
   * They are **date** Locks rather than the weekday and window Locks they were,
   * and that is load-bearing rather than tidy: `LOCK_RANK` places date-locked
   * blocks before window-locked ones, and Margaret River is window-locked. A
   * weekday Lock here would be offered the calendar after Margaret River had
   * taken the whole of the arrival stretch, and the two evenings would land
   * back at the end of the leg — which is exactly where they were. Friday the
   * 18th is inside what `perth-live-music.md` asks for ("Friday or Saturday"),
   * so pinning the date says the same thing about the world and also says
   * which weekend.
   */
  "fremantle-fish-and-chips": {
    kind: "date",
    // Thursday 17 December 2026: the harbour, then home to the Hills.
    from: "2026-12-17",
    to: "2026-12-17",
    why: "the Fremantle half of the arrival stretch, out of the Mundaring base and before the block moves south — a Fishing Boat Harbour evening is a Fremantle evening, and a floating one-day idea will otherwise score a Tuesday in January when the couple is in Queensland.",
  },
  "perth-live-music-night": {
    kind: "date",
    // Friday 18 December 2026, the first Friday after the couple lands.
    from: "2026-12-18",
    to: "2026-12-18",
    why: "Friday and Saturday are the only nights everything is on — the rest of the week is one room each, and the cheap Wed/Sun options finish early on purpose — and this is the Friday of the arrival stretch, driven in from the Mundaring base. perth-live-music.md",
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
