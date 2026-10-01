import assert from "node:assert/strict";
import test from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { buildPlan } from "@/lib/engine/plan";
import { INITIAL_STATE } from "@/lib/engine/scenario-doc";

for (const scenario of INITIAL_STATE.scenarios) {
  const input = { ...scenario.input, startDate: "2026-12-12" };
  const plan = buildPlan(input, capsuleCatalogue(input.toggled));

  test(`${scenario.id}: the booked crossing lands on 15 December`, () => {
    for (const date of ["2026-12-12", "2026-12-13", "2026-12-14"]) {
      assert.equal(plan.days.find((day) => day.date === date)?.locationId, "transit");
    }
    assert.equal(
      plan.days.find((day) => day.locationId !== "transit")?.date,
      "2026-12-15",
    );
    assert.deepEqual(
      plan.legs.slice(0, 3).map((leg) => [`${leg.from}>${leg.to}`, leg.date]),
      [
        ["VLC>MAD", "2026-12-12"],
        ["MAD>HKG", "2026-12-13"],
        ["HKG>PER", "2026-12-15"],
      ],
    );
    const pinnedFare = plan.legs.find((leg) => leg.note.includes("Pinned fare"));
    assert.ok(pinnedFare);
    assert.match(pinnedFare.note, /quoted for 13 Dec 2026/);
    assert.doesNotMatch(pinnedFare.note, /quoted for 14 Dec/);
  });

  test(`${scenario.id}: seeded departure and arrival placements match the booking`, () => {
    assert.equal(scenario.input.startDate, "2026-12-12");
    if (input.toggled.includes("mundaring-arrival")) {
      assert.equal(
        plan.placements.find((placement) => placement.capsuleId === "mundaring-arrival")?.startDate,
        "2026-12-15",
      );
    }
    if (scenario.id === "adeline-west-to-east") {
      const landing = plan.days.find((day) => day.date === "2026-12-15");
      assert.ok(landing);
      assert.equal(landing.locationId, "perth");
      assert.equal(landing.capsuleId, null);
      assert.equal(
        plan.placements.find((placement) => placement.capsuleId === "margaret-river")?.startDate,
        "2026-12-16",
      );
    }
  });
}
