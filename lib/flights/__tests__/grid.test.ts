import assert from "node:assert/strict";
import test from "node:test";

import {
  FARE_WINDOW_END,
  FARE_WINDOW_START,
  OUTBOUND_DEFAULT_DATE,
  OUTBOUND_SEARCH_DATES,
  RETURN_SEARCH_DATES,
  inFareWindow,
  isPreWarmed,
  resolveRoute,
  routeFor,
} from "@/lib/flights/grid";

test("the window is the trip's own ninety days", () => {
  assert.equal(FARE_WINDOW_START, "2026-12-01");
  assert.equal(FARE_WINDOW_END, "2027-02-28");
});

test("any real day inside the window is askable", () => {
  for (const date of ["2026-12-01", "2026-12-31", "2027-01-17", "2027-02-28"]) {
    assert.equal(inFareWindow(date), true, date);
  }
});

test("days outside the window are refused", () => {
  for (const date of ["2026-11-30", "2027-03-01", "2025-12-14", "2028-01-01"]) {
    assert.equal(inFareWindow(date), false, date);
  }
});

test("a string that sorts inside the window but is not a date is refused", () => {
  // The bug a plain string comparison would have: "2026-13-45" is between the
  // two bounds as text, and is not a day.
  for (const value of ["2026-13-45", "2027-02-31", "2026-12-1", "20261214", "", null]) {
    assert.equal(inFareWindow(value), false, String(value));
  }
});

test("a known route resolves on a date the cron never warms", () => {
  const route = resolveRoute("BCN", "PER", "2027-01-09");
  assert.equal(route?.from, "BCN");
  assert.equal(route?.to, "PER");
  assert.equal(isPreWarmed(route!, "2027-01-09"), false);
  // The per-route sanity bounds are untouched by the relaxation.
  assert.equal(route?.minEur, 400);
  assert.equal(route?.maxEur, 3_500);
});

test("the warmed dates are still the cheap defaults", () => {
  const route = resolveRoute("BCN", "PER", OUTBOUND_DEFAULT_DATE);
  assert.ok(route);
  assert.equal(isPreWarmed(route, OUTBOUND_DEFAULT_DATE), true);
  for (const date of OUTBOUND_SEARCH_DATES) {
    assert.equal(isPreWarmed(route, date), true, date);
  }
});

test("both search directions are open across the whole window", () => {
  assert.ok(resolveRoute("SYD", "BCN", "2026-12-05"));
  assert.ok(resolveRoute("BCN", "PER", RETURN_SEARCH_DATES[0]));
});

test("an unknown pair is still refused, on any date", () => {
  assert.equal(resolveRoute("VLC", "SYD", OUTBOUND_DEFAULT_DATE), null);
  assert.equal(routeFor("VLC", "SYD"), null);
  // Valencia to Brisbane is not on the grid; an open origin/destination pair on
  // a metered API is a proxy someone else can spend.
  assert.equal(resolveRoute("BNE", "VLC", "2027-02-10"), null);
});

test("a known pair on an out-of-window date is refused", () => {
  assert.equal(resolveRoute("BCN", "PER", "2027-04-01"), null);
});
