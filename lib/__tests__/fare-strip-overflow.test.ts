/**
 * The Flights day strip has to scroll inside its own box (#96).
 *
 * The bug this guards was not a wrong number, it was a missing container. Nine
 * 38px day cells and their eight 4px gaps are 374px of content, and the ‹ ›
 * steppers and the "All 90 days" button share the row with them — about 450px
 * of intrinsic width in a column that is 375px wide on the phone the Flights
 * page is designed for. With no `overflow-x` box around the day list that
 * excess fell through to the page's own scroller, and `/flights` measured
 * `scrollWidth 462` against `clientWidth 375`: the watchlist, the ranked rows
 * and every heading slid sideways together.
 *
 * The repo tests with `node --test` and no DOM, by deliberate constraint (see
 * `lib/engine/__tests__/alias-hook.mjs`), so this cannot re-measure a rendered
 * page — the measurement is in the issue and was re-run in a browser at 375px.
 * What it can do is hold the structural decision that made the measurement come
 * out right, which is the part a later edit would quietly undo: the day list
 * stays inside a box that scrolls, and the cells inside it keep their width
 * instead of being squeezed into slivers.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCE = readFileSync(
  new URL("../../components/fare-dates.tsx", import.meta.url),
  "utf8",
);

/** The day list and the element wrapping it, as written. */
const listWrapper = (): { wrapper: string; list: string } => {
  const list = /<ul className="([^"]*)"/.exec(SOURCE);
  assert.ok(list, "the day strip still renders a <ul> of day cells");

  const before = SOURCE.slice(0, list.index);
  const openTags = [...before.matchAll(/<div className="([^"]*)"/g)];
  const wrapper = openTags[openTags.length - 1];
  assert.ok(wrapper, "the day strip's <ul> still has a <div> ancestor to scroll in");

  return { wrapper: wrapper[1], list: list[1] };
};

describe("the Flights day strip", () => {
  it("keeps its own horizontal scroller, so the page never inherits the overflow", () => {
    const { wrapper } = listWrapper();

    assert.match(
      wrapper,
      /\boverflow-x-auto\b/,
      "the box immediately around the day list must scroll horizontally — without it the 450px row spills into the page scroller and drags /flights sideways (#96)",
    );
    assert.match(
      wrapper,
      /\bmin-w-0\b/,
      "the scroller must be allowed to shrink below its content width, or it pushes the column wider instead of scrolling",
    );
  });

  it("does not let the day cells shrink to fit instead of scrolling", () => {
    assert.match(
      SOURCE,
      /<li key=\{date\} className="[^"]*\bshrink-0\b/,
      "day cells keep their 38px width inside the scroller — a strip that shrinks its cells to fit reads as slivers, not as days",
    );
  });

  it("keeps the steppers and the calendar button out of the scrolling region", () => {
    const { list } = listWrapper();
    assert.doesNotMatch(
      list,
      /\boverflow-x-auto\b/,
      "the scroller is the wrapper, not the list itself",
    );

    for (const control of ["All 90 days", "A day earlier"]) {
      assert.ok(
        SOURCE.includes(control),
        `the ${control} control is still on the row`,
      );
    }
    assert.equal(
      (SOURCE.match(/\bshrink-0\b/g) ?? []).length >= 3,
      true,
      "the day cells, the steppers and the calendar button all hold their width when the row is squeezed",
    );
  });
});
