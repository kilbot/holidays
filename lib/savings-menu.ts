/**
 * The savings menu — every lever that takes money off the Plan, priced.
 *
 * The distillation of `docs/research/savings-menu-draft.md` (#65), which asked
 * one question — *can this trip lose A$10,000 without losing the trip?* — and
 * answered it by pricing seventeen levers against the live engine and ranking
 * them by **euro saved per unit of pain**.
 *
 * This module is the research, not a second opinion about it. Every figure here
 * appears in that document, and the document shows its arithmetic. Nothing is
 * recomputed at render time and nothing is rounded into a nicer number.
 *
 * ## Three things the audit found that reshape the whole ranking
 *
 * 1. **Only 28 of the 39 Buffer days are paid-rate.** Eleven are Perth
 *    home-base days at €48. Any arithmetic that prices all 39 at a city rate is
 *    overstating the prize.
 * 2. **"Every day moved to a Home base saves €305" was a mid-tier figure.** At
 *    the recalibrated floor a Sydney Buffer day costs €188 and a Perth day €48,
 *    so the lever is **€140/day** at the rates those days actually pay — €113
 *    comparing the bare rate cards, before January's multiplier. Still the
 *    biggest single per-day lever in the model, and the site should quote the
 *    true number rather than the flattering one.
 * 3. **Trimming an Adventure inside a fixed trip range barely saves anything.**
 *    A Day that stops belonging to a block becomes a Buffer day *in the same
 *    market* — same bed, same food, same bus. Cutting the reef from five nights
 *    to four saves the hire car and nothing else: €27. The savings in a
 *    duration trim live in the **Event lines** it drops and in the **trip
 *    length** it enables.
 *
 * So the order is: rates, then days of trip, then Event lines, then re-homing.
 * The tiers below are that order, cut by how much it hurts.
 *
 * ## Why the figures do not add up to the waterfalls
 *
 * Every row is measured **standalone**, against the base it names. They
 * interact — camping the Byron Buffer is worth less once the trip ends earlier
 * — so adding the column up overstates the total. The two seeded Scenarios are
 * the honest cumulative answer, and `savings.test.ts` reconciles them.
 */

/** How much it hurts. The only ranking that matters once the euros are equal. */
export type SavingsPain = "none" | "low" | "medium" | "high";

/** How a lever reaches the Plan. */
export type SavingsApply =
  /** Already in the model — a mis-set constant, now set right. Not a choice. */
  | "banked"
  /** A saved Scenario expresses it: dates, tiers, Event knobs. */
  | "scenario"
  /** A decision only the couple can make, and then a Scenario records it. */
  | "choice"
  /** Free to try, never to plan on. */
  | "upside";

export interface SavingsLever {
  /** The menu's own number, so a row can be found in the research document. */
  n: number;
  id: string;
  label: string;
  /** EUR off the Plan total, standalone. Null where it is not bankable. */
  savesEur: number | null;
  pain: SavingsPain;
  apply: SavingsApply;
  /** What is actually given up. The half of a saving nobody writes down. */
  givenUp: string;
  /** Which seeded Scenarios already take it. */
  inScenario: readonly ("comfortable" | "aggressive")[];
}

export interface SavingsTier {
  id: string;
  title: string;
  /** One line: what the whole tier is. */
  blurb: string;
  levers: readonly SavingsLever[];
}

const PAIN_ORDER: Record<SavingsPain, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export const PAIN_LABEL: Record<SavingsPain, string> = {
  none: "no pain",
  low: "low",
  medium: "medium",
  high: "high",
};

export const APPLY_LABEL: Record<SavingsApply, string> = {
  banked: "already banked",
  scenario: "in a Scenario",
  choice: "your call",
  upside: "upside only",
};

export const SAVINGS_TIERS: readonly SavingsTier[] = [
  {
    id: "rates",
    title: "Rate corrections",
    blurb:
      "Not downgrades — numbers that were set wrong. The August 2026 listing floors came in under what the model had been charging, so these are already in every figure on this page, including the reference trip's.",
    levers: [
      {
        n: 1,
        id: "lodging-floors",
        label: "Budget-lodging floors",
        savesEur: 1546,
        pain: "none",
        apply: "banked",
        givenUp:
          "Nothing. A cheap Airbnb, a motel or a caravan-park cabin in a suburb on a train line — which is what the tier always meant. Sydney A$180 → 140, Melbourne, Tasmania and regional A$150 → 120, Cairns A$120 → 100.",
        inScenario: [],
      },
      {
        n: 2,
        id: "food-floor",
        label: "Self-catered food floor",
        savesEur: 1248,
        pain: "none",
        apply: "banked",
        givenUp:
          "Eating out twice a day becomes once every second day, in rooms that have a kitchen. A$110 was ten weeks of restaurants quoted as a floor. The band's top still carries a restaurant week.",
        inScenario: [],
      },
      {
        n: 3,
        id: "event-corrections",
        label: "Event-line corrections",
        savesEur: 480,
        pain: "none",
        apply: "banked",
        givenUp:
          "Operator swaps the research documents themselves recommend — Passions of Paradise for the reef, Grasshoppers for Nimbin, Jewel Cave without Mammoth, the Manly ferry without the Opera House tour. Plus one correction upward: the Tasmania parks pass is A$98.35, not A$90.",
        inScenario: [],
      },
    ],
  },
  {
    id: "calendar",
    title: "Calendar shape",
    blurb:
      "Nothing is given up at all — the same days, bought on cheaper dates or spent in a cheaper place.",
    levers: [
      {
        n: 4,
        id: "nye-reshape",
        label: "Reshape the Sydney block: 30 Dec – 4 Jan",
        savesEur: 424,
        pain: "none",
        apply: "scenario",
        givenUp:
          "Two nights in Sydney before New Year's Eve, bought back as two nights after 1 January when the rate collapses from ×2.5 to ×1.2. The research's own rule, finally obeyed. Nothing is lost.",
        inScenario: ["comfortable", "aggressive"],
      },
      {
        n: 5,
        id: "rehome-january",
        label: "Re-home the post-NYE gap to Perth",
        savesEur: 558,
        pain: "low",
        apply: "scenario",
        givenUp:
          "Two extra flights and a re-cut January. Gains eight more days with family: the idle Sydney days cost €188 each and a Perth day costs €48. Buffers move — they do not vanish.",
        inScenario: ["comfortable"],
      },
    ],
  },
  {
    id: "events",
    title: "Event triage",
    blurb:
      "Marquee spend the day-to-day thrift is supposed to pay for. Every line here is defensible; the question is which four days matter most.",
    levers: [
      {
        n: 6,
        id: "drop-reef-two",
        label: "Drop the second reef day",
        savesEur: 506,
        pain: "low",
        apply: "choice",
        givenUp:
          "The second boat and the two introductory dives. The research's own duration note says the fifth night buys another chance at a reef day, not a second guaranteed one — one boat day plus two weather-buffer days is the honest floor.",
        inScenario: ["comfortable", "aggressive"],
      },
      {
        n: 7,
        id: "drop-tasman",
        label: "Drop the Tasman Island cruise",
        savesEur: 201,
        pain: "low",
        apply: "choice",
        givenUp:
          "Three hours along the tallest sea cliffs in the Southern Hemisphere. The Tasmania research names it “the first A$360 to cut if the Budget bites”.",
        inScenario: ["comfortable", "aggressive"],
      },
      {
        n: 8,
        id: "wineglass-to-bruny",
        label: "Wineglass Bay cruise → the Bruny Island ferry",
        savesEur: 181,
        pain: "low",
        apply: "choice",
        givenUp:
          "A boat around the bay. Wineglass Bay is a free 3–11 km walk, and the document calls the cruise the alternative to the walk rather than an addition. The A$51 ferry buys a different day instead.",
        inScenario: ["comfortable", "aggressive"],
      },
      {
        n: 14,
        id: "drop-laneway",
        label: "Drop Laneway Festival",
        savesEur: 268,
        pain: "medium",
        apply: "choice",
        givenUp:
          "The Friday headline of the Melbourne weekend. The free two-day St Kilda Festival, the NGV Triennial and the club nights all survive it.",
        inScenario: ["aggressive"],
      },
    ],
  },
  {
    id: "tent",
    title: "A tent",
    blurb:
      "A powered caravan-park site for two, on the road-trip blocks the research offers one for. It buys money, not calm — nothing in a caravan park is quiet in January.",
    levers: [
      {
        n: 9,
        id: "camp-roadtrips",
        label: "Camp on Margaret River and Tasmania",
        savesEur: 731,
        pain: "medium",
        apply: "choice",
        givenUp:
          "Twelve nights under canvas on the trip's two road-trip blocks. Western Australia is easy — family gear, borrowed car. Tasmania needs gear flown down.",
        inScenario: ["comfortable", "aggressive"],
      },
      {
        n: 12,
        id: "camp-byron-buffer",
        label: "Camp the sixteen-night Byron Buffer",
        savesEur: 752,
        pain: "medium",
        apply: "choice",
        givenUp:
          "Sixteen February nights in a Northern Rivers holiday park instead of a room. Arguably the nicest version of those days — but it needs gear on the east coast.",
        inScenario: ["comfortable", "aggressive"],
      },
      {
        n: 13,
        id: "camp-everywhere",
        label: "Camp everywhere the tier is offered",
        savesEur: 1895,
        pain: "high",
        apply: "choice",
        givenUp:
          "About forty nights under canvas, including a Tasmanian January and the wet-season tropics: 320–345 mm of rain across 15–19 rain days, plus the stinger and crocodile caveats.",
        inScenario: ["aggressive"],
      },
      {
        n: 15,
        id: "sydney-hostel",
        label: "Sydney at the hostel-twin tier",
        savesEur: 417,
        pain: "medium",
        apply: "choice",
        givenUp:
          "A private twin with shared facilities instead of a suburban studio, across the trip's most expensive fortnight. There is no camping rung on the harbour.",
        inScenario: ["aggressive"],
      },
    ],
  },
  {
    id: "length",
    title: "Trip length",
    blurb:
      "The only lever big enough to move the total on its own, and the only one that takes days off the trip. Days are the thing the money was for.",
    levers: [
      {
        n: 10,
        id: "end-14-feb",
        label: "End 14 February instead of 22 February",
        savesEur: 1395,
        pain: "medium",
        apply: "choice",
        givenUp:
          "Eight days, and both Melbourne festivals — Laneway on the Friday and the free St Kilda Festival on the weekend are fixed dates. Melbourne falls back to 11–14 February, which the research already prices as the fallback.",
        inScenario: [],
      },
      {
        n: 11,
        id: "end-8-feb",
        label: "End 8 February instead of 22 February",
        savesEur: 2442,
        pain: "high",
        apply: "choice",
        givenUp:
          "Fourteen days, both festivals, and most of the February slack the Byron block was built to enjoy.",
        inScenario: ["aggressive"],
      },
    ],
  },
  {
    id: "free",
    title: "Free, but not bankable",
    blurb:
      "Worth doing and not worth counting. A plan built on either of these is a plan built on luck.",
    levers: [
      {
        n: 16,
        id: "house-sitting",
        label: "House-sitting applications",
        savesEur: null,
        pain: "none",
        apply: "upside",
        givenUp:
          "Nothing — applying costs nothing. A hit on the Byron or Melbourne block would remove five to sixteen paid lodging nights, worth €500–2,000. Upside, never plan: it stays out of every Scenario on purpose.",
        inScenario: [],
      },
      {
        n: 17,
        id: "event-day-double-count",
        label: "Fix the Event-day double count",
        savesEur: null,
        pain: "none",
        apply: "upside",
        givenUp:
          "Nothing, and nobody would feel it. A day carrying a A$550 reef boat also carries A$40 of day-to-day activities — about €214 across the Plan. A modelling correction worth making; not a saving to count toward a target.",
        inScenario: [],
      },
    ],
  },
];

/** Levers that look bigger than they are, and why they disappoint. */
export interface SavingsMirage {
  label: string;
  savesEur: number;
  why: string;
}

export const SAVINGS_MIRAGES: readonly SavingsMirage[] = [
  {
    label: "Reef, five nights → four",
    savesEur: 27,
    why: "The freed day becomes a Port Douglas Buffer day at the same rates. Only the hire-car line goes.",
  },
  {
    label: "Tasmania, nine nights → seven",
    savesEur: 135,
    why: "Two days of hire car at A$85. Everything else is still paid, in Tasmania, as a Buffer.",
  },
  {
    label: "Start 19 December instead of 12 December",
    savesEur: 330,
    why: "Those seven days are Perth home-base days at €48 — the cheapest in the Plan. It costs family time and saves the least.",
  },
];

/* ------------------------------------------------------------------ */
/* Reading the menu                                                    */
/* ------------------------------------------------------------------ */

export const ALL_LEVERS: readonly SavingsLever[] = SAVINGS_TIERS.flatMap(
  (tier) => tier.levers,
);

/** Already in the model — the corrections nobody has to agree to. */
export function bankedEur(): number {
  return ALL_LEVERS.filter((lever) => lever.apply === "banked").reduce(
    (total, lever) => total + (lever.savesEur ?? 0),
    0,
  );
}

/**
 * What is still on the table, ranked by euro saved per unit of pain.
 *
 * A no-pain lever outranks a high-pain one that saves twice as much, because
 * the whole point of a menu is to spend the cheap decisions first. Ties inside
 * a pain grade go to the bigger number, and the banked rows are gone: they are
 * not decisions.
 */
export function ranked(): SavingsLever[] {
  return ALL_LEVERS.filter(
    (lever) => lever.apply !== "banked" && lever.savesEur !== null,
  ).sort(
    (a, b) =>
      PAIN_ORDER[a.pain] - PAIN_ORDER[b.pain] ||
      (b.savesEur ?? 0) - (a.savesEur ?? 0),
  );
}
