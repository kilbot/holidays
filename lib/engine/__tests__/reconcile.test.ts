/**
 * Reconciliation against the real research corpus.
 *
 * The other suites run on fixtures, deliberately: they test the scheduler and
 * the ledger, and a fixture is the only way to do that without the tests
 * failing every time someone re-researches Tasmania.
 *
 * This one is different. It runs the default Scenario — all nine researched
 * Capsules, the reference dates — through the whole pipeline and asserts the
 * invariant the entire cost model rests on: **the Plan's total is the sum of
 * its Days, to the cent**. If a Leg ever gets priced onto a Leg object instead
 * of onto a Day, or a roll-up ever estimates something a second way, this is
 * what catches it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { intoLedger } from "@/lib/engine/blocks";
import { capsuleCatalogue } from "@/lib/engine/capsules";
import { cents } from "@/lib/engine/ledger";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenarios";
import { ANCHORS, addDays, weekdayOf } from "@/lib/trip-dates";

const plan = buildPlan(
  DEFAULT_SCENARIO.input,
  // The default Scenario carries two Catalog ideas as well as the nine
  // researched Adventures, and `capsuleCatalogue` only builds a Catalog spec
  // for an id it is handed — so the reconciliation has to hand it the Scenario's
  // own list, not an empty one, or the two would be silently dropped.
  capsuleCatalogue(DEFAULT_SCENARIO.input.toggled),
);

test("the default Scenario places every Adventure it is given", () => {
  // Ten researched Adventures, two WA evenings, four Far North Queensland
  // Catalog ideas. The count is asserted so a silently-dropped toggle — an id
  // `capsuleCatalogue` was never handed, say — cannot pass as a smaller Plan.
  assert.equal(plan.placements.length, DEFAULT_SCENARIO.input.toggled.length);
  assert.equal(plan.placements.length, 16);
  assert.deepEqual(plan.unplaced, []);
  for (const placement of plan.placements) {
    assert.deepEqual(placement.overlaps, [], placement.capsuleId);
  }
});

/**
 * The one thing the reference trip knowingly gets wrong, and keeps.
 *
 * The couple moved the return in to 14 February (#54), which puts Melbourne's
 * 19–21 February festival weekend outside the trip. The block is not deleted —
 * it lands at the latest start the range holds, carries a `lock-violated`
 * Warning, and drops its date-pinned Laneway ticket on its own. That is the
 * site's whole bargain applied to the couple's own decision: nothing is
 * refused, and what it costs is on the page.
 */
test("the shortened return costs Melbourne its weekend, out loud", () => {
  const violated = plan.placements.filter((placement) => placement.lockViolated);
  assert.deepEqual(
    violated.map((placement) => placement.capsuleId),
    ["melbourne-party"],
    "one deliberate Lock breach, and only one",
  );
  assert.equal(plan.endDate, "2027-02-14");
  assert.ok(
    plan.warnings.some(
      (warning) =>
        warning.kind === "lock-violated" &&
        warning.capsuleId === "melbourne-party",
    ),
    "and the Plan says so",
  );
  assert.ok(
    !plan.days.some((day) =>
      day.lines.some((line) => line.id.endsWith(":mel-laneway")),
    ),
    "a festival the trip is home before is not a ticket you can buy",
  );
});

/**
 * The canonical route, and the reason this test exists.
 *
 * #54 reported it as "Tasmania placed twice, once before the reef". There was
 * never a duplicate placement — there was a **zigzag**. Tasmania's window used
 * to open on 13 January, earlier than the reef's 18th, and the Scheduler places
 * the longest window-locked block first and gives it the earliest good week its
 * window allows. So the itinerary ran Sydney → Hobart → Cairns → Byron →
 * Melbourne, crossed the continent twice, and put Tasmania either side of the
 * reef on the globe's own line.
 *
 * The fix is data, not code: Tasmania's window moved to the February its own
 * research calls "quietly better again", and Byron's now closes on 3 February
 * instead of the 18th. This asserts the order those two windows encode, because
 * a window that gets widened by a future edit would quietly bring the zigzag
 * back and nothing else here would notice.
 */
test("the east coast runs north to south, and only once", () => {
  const order = (id: string) =>
    plan.placements.findIndex((placement) => placement.capsuleId === id);

  const sydney = order("sydney-nye");
  const reef = order("gbr-port-douglas");
  const capeTrib = order("fnq-wildlife");
  const byron = order("byron-nimbin");
  const tasmania = order("tasmania-arc");
  const melbourne = order("melbourne-party");

  for (const [name, index] of Object.entries({
    sydney, reef, capeTrib, byron, tasmania, melbourne,
  })) {
    assert.ok(index >= 0, `${name} is on the Plan`);
  }

  assert.ok(sydney < reef, "New Year's Eve before the reef");
  assert.ok(reef < capeTrib, "the Cape Trib night is bought off the reef base");
  assert.ok(capeTrib < byron, "then south to the Northern Rivers");
  assert.ok(byron < tasmania, "then south again, to Tasmania");
  assert.ok(tasmania < melbourne, "and Melbourne is the last stop before home");

  // The zigzag, stated as the thing that must not come back: Hobart is 3,000 km
  // the wrong side of Cairns, and a Plan that flies Sydney → Hobart → Cairns is
  // paying twice for the same latitude.
  assert.ok(
    plan.placements[tasmania].startDate >
      plan.placements[reef].endDate,
    "Tasmania must not sit between Sydney and the reef",
  );
});

/**
 * The other half of the #54 directive: *"way more time in North Queensland than
 * New South Wales."*
 *
 * Expressed entirely as windows and one day-override, and asserted as the day
 * count it produces rather than as the mechanism, so a future edit that undoes
 * it by some other route still fails here.
 */
test("Far North Queensland outweighs New South Wales, and not narrowly", () => {
  const daysAt = (...ids: string[]) =>
    plan.days.filter((day) => ids.includes(day.locationId)).length;

  const fnq = daysAt("port-douglas");
  const nsw = daysAt("sydney", "byron");

  assert.ok(fnq > nsw, `FNQ ${fnq} days, NSW ${nsw} days`);
  assert.ok(fnq >= nsw * 1.4, `only ${fnq} against ${nsw} — that is not "way more"`);
});

test("the two hard Anchors are honoured out of the box", () => {
  const on = (date: string) => plan.days.find((day) => day.date === date);

  assert.equal(on("2026-12-25")?.locationId, "morawa", "Christmas at the farm");
  assert.equal(on("2026-12-31")?.locationId, "sydney", "NYE in Sydney");

  assert.equal(
    plan.warnings.filter((warning) => warning.kind === "anchor-missed").length,
    0,
  );
});

test("the arrival block leads the calendar, and nothing else can", () => {
  const first = plan.placements[0];
  assert.equal(first.capsuleId, "mundaring-arrival");
  // The day the couple *lands*, which is the day after they leave: Valencia to
  // Perth is twenty-odd hours with the Changi overnight.
  assert.equal(first.startDate, addDays(plan.startDate, 1));
  assert.equal(plan.days[0].locationId, "transit", "a night over the ocean");
  assert.equal(plan.days[1].locationId, "mundaring");
  assert.equal(plan.days[1].homeBase, true, "free lodging, borrowed car");
});

test("the outbound crossing is one Leg, dated the day they leave", () => {
  const crossings = plan.legs.filter(
    (leg) => leg.fromLocationId === "origin" || leg.toLocationId === "origin",
  );
  assert.equal(crossings.length, 2, "out and back, and no transit stub");
  assert.equal(crossings[0].date, plan.startDate);
  assert.equal(crossings[0].toLocationId, "mundaring", "not `transit`");
  assert.ok(
    !plan.legs.some(
      (leg) =>
        leg.fromLocationId === "transit" || leg.toLocationId === "transit",
    ),
    "`transit` is a state, not a destination",
  );
});

test("the Perth music night is on a Friday or a Saturday", () => {
  const placed = plan.placements.find(
    (placement) => placement.capsuleId === "perth-live-music-night",
  );
  assert.ok(placed, "the music night is on the default Scenario");
  assert.ok(
    [5, 6].includes(weekdayOf(placed.startDate)),
    `${placed.startDate} is a ${weekdayOf(placed.startDate)}`,
  );
});

test("Fremantle fish and chips buys nothing the ledger is not already charging", () => {
  const day = plan.days.find(
    (entry) => entry.capsuleId === "fremantle-fish-and-chips",
  );
  assert.ok(day, "it is on the calendar");
  assert.deepEqual(
    day.lines.filter((line) => line.kind === "event"),
    [],
    "A$30–70 on the harbour is under the living floor — a place to be, not a thing to buy",
  );
});

test("no proposal takes a hard Anchor's own day but the block that owns it", () => {
  for (const anchor of ANCHORS) {
    if (!anchor.hard) continue;
    const holders = plan.placements.filter(
      (placement) =>
        placement.startDate <= anchor.date && placement.endDate >= anchor.date,
    );
    for (const holder of holders) {
      const lock = capsuleCatalogue(DEFAULT_SCENARIO.input.toggled).find(
        (spec) => spec.id === holder.capsuleId,
      )?.lock;
      assert.ok(
        lock?.kind === "date" &&
          lock.from <= anchor.date &&
          lock.to >= anchor.date,
        `${holder.capsuleId} took ${anchor.label} (${anchor.date}) without a date-Lock that names it`,
      );
    }
  }

  // Christmas belongs to exactly one block, and it is the one whose whole
  // reason for existing is that date: the sister's farm at Morawa.
  const christmas = plan.days.find((day) => day.date === "2026-12-25");
  assert.equal(christmas?.capsuleId, "morawa-christmas");
  assert.equal(christmas?.locationId, "morawa");
  assert.equal(christmas?.homeBase, true, "free beds, borrowed car");
});

test("the roll-up reconciles with the ledger, to the cent", () => {
  const summed = cents(
    plan.days.reduce((total, day) => total + day.totalEur, 0),
  );
  assert.equal(plan.rollUp.planOnEur, summed);

  const splits = cents(
    plan.rollUp.splits.reduce((total, split) => total + split.amountEur, 0),
  );
  assert.equal(splits, plan.rollUp.planOnEur);

  const weeks = cents(
    plan.weeks.reduce((total, week) => total + week.costEur, 0),
  );
  assert.equal(weeks, plan.rollUp.planOnEur, "the strip agrees with the HUD");

  const lines = cents(
    plan.days.reduce(
      (total, day) =>
        total + day.lines.reduce((sum, line) => sum + line.eur, 0),
      0,
    ),
  );
  assert.equal(lines, plan.rollUp.planOnEur, "and both agree with the lines");
});

test("every Leg's fare is charged to a Day", () => {
  for (const leg of plan.legs) {
    const day = plan.days.find((entry) => entry.date === leg.date);
    assert.ok(day, `${leg.id} lands on a Day`);
    const line = day.lines.find((entry) => entry.id.endsWith(leg.id));
    assert.ok(line, `${leg.id} is a line on ${leg.date}`);
    assert.equal(line.eur, leg.eur);
  }
});

test("the Ledger reconciles: block subtotals + transit rows = plan-on", () => {
  const rows = intoLedger(plan.days, plan.warnings, plan.legs);

  const blocks = cents(
    rows.reduce(
      (total, row) => total + (row.kind === "block" ? row.block.costEur : 0),
      0,
    ),
  );
  const transits = cents(
    rows.reduce(
      (total, row) => total + (row.kind === "transit" ? row.transit.costEur : 0),
      0,
    ),
  );

  assert.equal(cents(blocks + transits), plan.rollUp.planOnEur);
  assert.equal(
    transits,
    plan.rollUp.splits.find((split) => split.id === "flights")?.amountEur,
    "the transit rows are the flights split, seen from the Ledger's side",
  );
});

test("no block is charged for the Leg that reached it (#53)", () => {
  const rows = intoLedger(plan.days, plan.warnings, plan.legs);
  const fares = new Set(plan.legs.map((leg) => `${leg.date}:${leg.id}`));

  for (const row of rows) {
    if (row.kind !== "block") continue;
    for (const entry of row.block.days) {
      assert.ok(
        entry.lines.every((line) => !fares.has(line.id)),
        `${row.block.locationName} holds a fare on ${entry.day.date}`,
      );
    }
  }

  // The reported symptom, as an assertion: the €3,800 crossing from Valencia
  // lands on the first Day of the Margaret River block, and the block's
  // subtotal must not carry it. docs/CONTEXT.md — a Leg is not a place.
  const first = rows[0];
  assert.equal(first.kind, "transit", "the outbound crossing leads the Ledger");
  if (first.kind !== "transit") return;

  const arrival = rows[1];
  assert.equal(arrival.kind, "block");
  if (arrival.kind !== "block") return;

  assert.ok(first.transit.costEur > 1_000, "the crossing is the big number");
  assert.ok(
    arrival.block.costEur < first.transit.costEur,
    `${arrival.block.locationName} should not out-cost the flight that reaches it`,
  );
});

test("both crossings are priced, and the ticket is not spent twice", () => {
  const crossings = plan.legs.filter(
    (leg) => leg.fromLocationId === "origin" || leg.toLocationId === "origin",
  );
  assert.equal(crossings.length, 2, "out and back");

  const [outbound, homeward] = crossings;
  assert.ok(outbound.eur > 0, "the outbound crossing is priced");
  // The #90 regression, as an assertion. This used to be zero, on the grounds
  // that the research band is a return — which stopped being true of the
  // figure on the outbound Leg the instant a live one-way fare replaced it.
  assert.ok(homeward.eur > 0, "and so is the journey home");
  assert.ok(
    outbound.eur > homeward.eur,
    "December out is the peak; February home is the cheapest month of the year",
  );

  // Neither is a quote of its own yet, and the Leg says so: both are this
  // crossing's share of a figure that covers the pair.
  for (const leg of crossings) {
    assert.equal(leg.fareBasis, "return-share", leg.id);
  }
});
