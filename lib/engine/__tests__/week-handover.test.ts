/**
 * The week strip's second line has to agree with the calendar (#98).
 *
 * Each week block on the date strip is headlined by the place holding the most
 * of its Days, and carries a line underneath naming wherever else the week
 * goes. "Most Days" has nothing to do with "first", so the two are independent
 * — and the line used to say "then X" whatever the dates did. On three of the
 * reference trip's four mixed weeks that described the journey running
 * backwards: "11–17 Jan · Tasmania / then Sydney" when Sydney is 11–12 Jan and
 * Tasmania 13–17, and worst of all "8–14 Feb · Melbourne / then Byron Bay",
 * which says the trip finishes by leaving its finale.
 *
 * The assertion here is the property rather than the sentence, so it survives
 * a re-researched Tasmania: whatever word the line uses, the places it puts
 * after the headline must genuinely start after it, and the ones it puts
 * before must genuinely start before. It runs on the real default Scenario
 * (as `reconcile.test.ts` does) because the bug only showed up on weeks that
 * straddle two places, and fixtures with that shape would be inventing the
 * very chronology under test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { capsuleCatalogue } from "@/lib/engine/capsules";
import { buildPlan } from "@/lib/engine/plan";
import { DEFAULT_SCENARIO } from "@/lib/engine/scenarios";
import type { PlanWeek } from "@/lib/engine/types";

const plan = buildPlan(
  DEFAULT_SCENARIO.input,
  capsuleCatalogue(DEFAULT_SCENARIO.input.toggled),
);

/** First Day index inside the week that is spent in a given place. */
const firstDayIn = (week: PlanWeek, name: string): number =>
  week.days.findIndex((day) => day.locationName === name);

/**
 * The line split into the places it claims come before the headline and the
 * ones it claims come after: "after A · B, then C" → { before: [A, B], after:
 * [C] }.
 */
function readHandover(line: string): { before: string[]; after: string[] } {
  const names = (segment: string | undefined) =>
    segment ? segment.split(" · ").map((name) => name.trim()).filter(Boolean) : [];

  const [beforePart, afterPart] = line.split(", then ");
  if (afterPart !== undefined) {
    return {
      before: names(beforePart.replace(/^after /, "")),
      after: names(afterPart),
    };
  }
  if (line.startsWith("then ")) return { before: [], after: names(line.slice(5)) };
  if (line.startsWith("after ")) return { before: names(line.slice(6)), after: [] };
  assert.fail(`week handover "${line}" uses a word the strip does not define`);
}

describe("the week strip's handover line", () => {
  const mixed = plan.weeks.filter((week) => week.handover !== null);

  it("has something to check — the reference trip straddles places", () => {
    assert.ok(
      mixed.length >= 3,
      `expected the reference trip to have mixed weeks, found ${mixed.length}`,
    );
  });

  for (const week of mixed) {
    it(`describes ${week.label} in the order it is travelled`, () => {
      const { before, after } = readHandover(week.handover as string);
      const lead = firstDayIn(week, week.leadLocationName);

      assert.notEqual(lead, -1, "the headline place is one of the week's own Days");
      assert.ok(
        before.length + after.length > 0,
        "a handover line names at least one other place",
      );

      for (const name of after) {
        const at = firstDayIn(week, name);
        assert.notEqual(at, -1, `${name} is one of ${week.label}'s own Days`);
        assert.ok(
          at > lead,
          `${week.label} says "then ${name}", but ${name} starts on ${week.days[at].date} and ${week.leadLocationName} starts on ${week.days[lead].date} — "then" names the place that came first`,
        );
      }

      for (const name of before) {
        const at = firstDayIn(week, name);
        assert.notEqual(at, -1, `${name} is one of ${week.label}'s own Days`);
        assert.ok(
          at < lead,
          `${week.label} says "after ${name}", but ${name} starts on ${week.days[at].date}, not before ${week.leadLocationName} on ${week.days[lead].date}`,
        );
      }
    });
  }

  it("names every other place in the week exactly once", () => {
    for (const week of mixed) {
      const { before, after } = readHandover(week.handover as string);
      const named = [...before, ...after];
      const actual = [
        ...new Set(
          week.days
            .map((day) => day.locationName)
            .filter((name) => name !== week.leadLocationName),
        ),
      ];

      assert.deepEqual(
        [...named].sort(),
        [...actual].sort(),
        `${week.label} names ${named.join(", ")} but is spent in ${actual.join(", ")}`,
      );
    }
  });

  it("says nothing at all about a week spent in one place", () => {
    for (const week of plan.weeks.filter((candidate) => candidate.handover === null)) {
      const places = new Set(week.days.map((day) => day.locationName));
      assert.equal(
        places.size,
        1,
        `${week.label} has no handover line but is spent in ${[...places].join(", ")}`,
      );
    }
  });
});
