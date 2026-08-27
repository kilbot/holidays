/**
 * What a Leg's fare is a price **for** — kilbot/holidays#90, finding 1.
 *
 * The bug this file exists to keep dead: `/api/fares` asks SearchAPI for
 * `flight_type=one_way`, and `legs.ts` used to charge the outbound crossing as
 * though it were a return and zero the homeward one. Both statements were true
 * of the *research band* — `docs/research/longhaul-comfort.md` heads its price
 * table "Bands, per person, return, open-jaw into PER / out of SYD-MEL-BNE" —
 * and neither survived a live quote replacing the placeholder. The moment the
 * outbound hydrated, the couple's Plan was paying for one ticket west and
 * flying home for nothing: €1–2k missing from the largest line in the roll-up.
 *
 * So the tests below are about provenance and not about arithmetic. Each one
 * asks the same question in a different place: *does this figure know what it
 * is a price for, and is it charged accordingly?*
 */

import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { TRAVELLERS } from "@/lib/engine/constants";
import { cents } from "@/lib/engine/ledger";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenario-doc";
import type { Leg, Plan } from "@/lib/engine/types";

const catalogue = capsuleCatalogue(DEFAULT_SCENARIO.input.toggled);

const priced = (fareOverrides: Record<string, number> = {}): Plan =>
  buildPlan({ ...DEFAULT_SCENARIO.input, fareOverrides }, catalogue);

/**
 * The two ocean crossings, found by their route rather than by id — the dates
 * move whenever the Scheduler does, and this file is not about dates.
 *
 * Since #107 each crossing is a chain of sectors and the ocean is only on one
 * of them: the flight out of Europe and the flight back into it. Those are the
 * Legs the provenance rules are about, and they are found by asking which
 * sector leaves a European gateway for somewhere that is not one.
 */
function crossings(plan: Plan): { out: Leg; home: Leg } {
  const out = plan.legs.find((leg) => leg.from === "MAD" && leg.to === "HKG");
  const home = plan.legs.find((leg) => leg.from === "SIN" && leg.to === "BCN");
  assert.ok(out, "the Plan flies out");
  assert.ok(home, "and home again");
  return { out, home };
}

const flightsEur = (plan: Plan) =>
  plan.rollUp.splits.find((split) => split.id === "flights")?.amountEur ?? 0;

/* ------------------------------------------------------------------ */
/* The research band is a return, and it is split                      */
/* ------------------------------------------------------------------ */

test("the journey home carries a share of the return figure, and says that it does", () => {
  const { out, home } = crossings(priced());

  assert.equal(home.fareBasis, "return-share");
  assert.ok(home.eur > 0, "the journey home is not free");

  // The outbound is no longer a share of anything: the couple has pinned it,
  // and a quote you hold outranks a band somebody modelled (#107). €872 per
  // person one-way, for two, split across the two Cathay sectors by their
  // block hours — this one is the 13-hour leg out of Madrid.
  assert.equal(out.fareBasis, "one-way");
  assert.equal(out.pricing, "pinned");
  assert.equal(out.eur, cents(872 * TRAVELLERS * (13 / (13 + 7 + 40 / 60))));
  assert.ok(
    out.eur > home.eur,
    "December out is the peak; February home is the cheapest month",
  );
});

test("a crossing's sectors add back up to the fare it was quoted at", () => {
  // The property the block-hour split exists to preserve. One ticket buys the
  // whole journey, so however it is divided for display the pieces have to sum
  // to what the journey costs — otherwise the roll-up is inventing or losing
  // money every time somebody re-times a connection.
  const plan = priced();
  const sectorsOf = (...ids: string[]) =>
    cents(
      plan.legs
        .filter((leg) => ids.includes(`${leg.from}>${leg.to}`))
        .reduce((total, leg) => total + leg.eur, 0),
    );

  // The pinned Cathay ticket, €872 per person one-way.
  assert.equal(sectorsOf("MAD>HKG", "HKG>PER"), cents(872 * TRAVELLERS));

  // Three-eighths of the €1,500-per-person MEL–BCN return snapshot, for two —
  // the homeward half of one ticket, split across its own two sectors.
  assert.equal(
    sectorsOf("MEL>SIN", "SIN>BCN"),
    cents(1_500 * 0.375 * TRAVELLERS),
  );
});

test("the feeder trains are bought separately and say so", () => {
  // `flight-hubs.md` is emphatic that neither train is on the airline ticket:
  // Madrid is fed by an unprotected 1h56 Renfe run, and Barcelona has no flight
  // to Valencia on any carrier at all. They carry their own price and take no
  // share of the fare.
  const plan = priced();
  for (const pair of ["VLC>MAD", "BCN>VLC"]) {
    const leg = plan.legs.find((entry) => `${entry.from}>${entry.to}` === pair);
    assert.ok(leg, pair);
    assert.equal(leg.mode, "train");
    assert.equal(leg.fareBasis, "one-way");
    assert.equal(leg.modeOverridden, false, "a train by itinerary, not by knob");
    assert.ok(leg.eur > 0 && leg.eur < 100, `€${leg.eur} is a train fare`);
  }
});

test("a domestic band is a one-way and is charged whole", () => {
  // The counter-case, and the reason the split is driven by provenance rather
  // than by "is this a long flight": `domestic-flights.md` §2 quotes one-ways,
  // so Cairns–Gold Coast's €90 low is €90 and is not divided by anything.
  const leg = priced().legs.find(
    (entry) => entry.from === "CNS" && entry.to === "OOL",
  );
  assert.ok(leg, "the run south out of Queensland is on the Plan");
  assert.equal(leg.pricing, "band", "no snapshot for this pair");
  assert.equal(leg.fareBasis, "one-way");
  assert.equal(leg.eur, cents(90 * TRAVELLERS));
});

/* ------------------------------------------------------------------ */
/* A live quote is a one-way, and only replaces its own crossing       */
/* ------------------------------------------------------------------ */

test("hydrating the outbound crossing does not take the journey home with it", () => {
  const before = crossings(priced());
  const after = crossings(priced({ [before.out.id]: 2_400 }));

  assert.equal(after.out.eur, 2_400);
  assert.equal(after.out.fareBasis, "one-way", "a live quote buys one crossing");

  // The regression, stated as plainly as it can be: the homeward Leg is not a
  // function of the outbound one, and nothing that happens to the outbound may
  // silently zero it.
  assert.equal(after.home.eur, before.home.eur);
  assert.ok(after.home.eur > 0);
});

test("two live one-way fares are both charged, and both reach the roll-up", () => {
  const before = crossings(priced());
  const plan = priced({ [before.out.id]: 2_400, [before.home.id]: 1_600 });
  const { out, home } = crossings(plan);

  assert.equal(out.eur, 2_400);
  assert.equal(home.eur, 1_600);

  // Not just on the Legs — on the Days, and therefore in the flights split.
  // `legs.ts` charges a fare to the Day it is travelled, and a Leg whose money
  // never lands on a Day is money the Plan does not have.
  const moved =
    2_400 - before.out.eur + (1_600 - before.home.eur);
  assert.equal(
    cents(flightsEur(plan)),
    cents(flightsEur(priced()) + moved),
    "the whole of both fares is in the Flights split",
  );
});

/* ------------------------------------------------------------------ */
/* …which requires the homeward crossing to be able to ask             */
/* ------------------------------------------------------------------ */

test("a crossing sector is not pretended to be a route the grid can price", () => {
  const { out, home } = crossings(priced());

  // `onGrid` is a claim about `/api/fares`, and `/api/fares` prices routes on
  // the grid — a whitelist, because an open origin/destination on a metered API
  // is a proxy somebody else can spend. Neither MAD–HKG nor SIN–BCN is on it:
  // they are connections inside a through-fare, not routes anyone searches.
  //
  // Losing the live quote costs the outbound nothing, because it is priced from
  // a fare the couple actually holds. The homeward is a research figure and
  // would still take a live one; hydrating it means asking about the journey
  // (MEL–BCN, which *is* on the grid) rather than about a sector of it, and
  // that is follow-up work rather than something to fake here.
  assert.equal(out.onGrid, false);
  assert.equal(home.onGrid, false);
  assert.equal(
    home.pricing,
    "snapshot",
    "the MEL–BCN return snapshot is what the journey home is priced from",
  );
});

test("a route the grid has never heard of is not pretended to be priceable", () => {
  // The other half of `onGrid`: the pair is a whitelist and stays one, because
  // an open origin/destination on a metered API is a proxy somebody else can
  // spend. Cairns–Gold Coast is a real Leg on a route `/api/fares` cannot
  // answer for, and the Plan says so rather than asking and failing.
  const leg = priced().legs.find(
    (entry) => entry.from === "CNS" && entry.to === "OOL",
  );
  assert.ok(leg);
  assert.equal(leg.onGrid, false);
});
