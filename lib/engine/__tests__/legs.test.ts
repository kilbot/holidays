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
 * The two ocean crossings, found by their `origin` end rather than by id — the
 * dates move whenever the Scheduler does, and this file is not about dates.
 */
function crossings(plan: Plan): { out: Leg; home: Leg } {
  const out = plan.legs.find((leg) => leg.fromLocationId === "origin");
  const home = plan.legs.find((leg) => leg.toLocationId === "origin");
  assert.ok(out, "the Plan flies out");
  assert.ok(home, "and home again");
  return { out, home };
}

const flightsEur = (plan: Plan) =>
  plan.rollUp.splits.find((split) => split.id === "flights")?.amountEur ?? 0;

/* ------------------------------------------------------------------ */
/* The research band is a return, and it is split                      */
/* ------------------------------------------------------------------ */

test("both crossings carry a share of the return figure, and say that they do", () => {
  const { out, home } = crossings(priced());

  assert.equal(out.fareBasis, "return-share");
  assert.equal(home.fareBasis, "return-share");
  assert.ok(home.eur > 0, "the journey home is not free");

  // Five-eighths of the €1,900-per-person return snapshot for VLC–PER, for
  // two. The other three-eighths is not on this Leg — it belongs to a crossing
  // that happens ten weeks later.
  assert.equal(out.eur, cents(1_900 * 0.625 * TRAVELLERS));
  assert.ok(
    out.eur > home.eur,
    "December out is the peak; February home is the cheapest month",
  );
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

test("the homeward crossing is on the fares grid, so it can be hydrated at all", () => {
  const { out, home } = crossings(priced());
  assert.equal(out.onGrid, true);

  // Two separate things used to hide this Leg from the live fare it is
  // entitled to. It has no snapshot of its own, so it was labelled `band` —
  // and `use-plan.ts` only hydrated Legs labelled `grid`. And `legIsOnGrid`
  // compared the date against the set the cron *warms*, three days wide, which
  // the homecoming has now fallen outside of twice, once per re-plan.
  assert.equal(home.pricing, "band", "no MEL–VLC snapshot exists to stand in");
  assert.equal(home.onGrid, true, "and yet /api/fares can price it");
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
