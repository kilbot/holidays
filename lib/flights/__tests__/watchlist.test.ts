/**
 * The watchlist model, and the endpoint that draws it.
 *
 * Three properties are load-bearing enough to pin down here rather than trust:
 *
 * 1. **A pin survives bytes of unknown provenance.** It is stored inside the
 *    shared Plan document, so a watchlist written by an older build — or by the
 *    other traveller's phone mid-deploy — has to parse into *something*. Never
 *    reject, always repair.
 * 2. **The drift compares like with like.** A pin taken against the research
 *    band is not an observation, and reporting the gap between a guess and a
 *    quote as a price change would be the page inventing news.
 * 3. **Nothing here spends a fare call.** The endpoint reads the history store
 *    and writes nothing at all, which the fake KV can prove by having recorded
 *    no writes and no `fetch` having been made.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/fares/history/route";
import { appendFareHistory, type FareSeries } from "@/lib/flights/history";
import {
  addPin,
  driftOf,
  isPinned,
  MAX_PINS,
  parsePins,
  pinIdOf,
  pinOf,
  removePin,
  type FlightPin,
} from "@/lib/flights/watchlist";
import { fakeKv, type FakeKv } from "@/lib/store/__tests__/fake-kv";
import { setKvClient } from "@/lib/store/kv";

const PINNED_AT = "2026-08-27T12:00:00.000Z";

function pin(overrides: Partial<FlightPin> = {}): FlightPin {
  return pinOf({
    leg: "outbound",
    optionId: "bcn-sq-sin",
    from: "BCN",
    to: "PER",
    date: "2026-12-12",
    carrier: "Singapore Airlines",
    fareEurPP: 1_240,
    fareSource: "history",
    totalEurCouple: 2_760,
    comfort: 8.4,
    pinnedAt: PINNED_AT,
    ...overrides,
  });
}

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

test("a pin's id is its leg, its itinerary and its day", () => {
  assert.equal(pin().id, pinIdOf("outbound", "bcn-sq-sin", "2026-12-12"));
  // The same itinerary on another day is another pin — the day is half of what
  // the couple forgets, so it cannot be collapsed away.
  assert.notEqual(pin().id, pin({ date: "2026-12-13" }).id);
});

test("a new pin goes to the front", () => {
  const first = pin();
  const second = pin({ optionId: "mad-qf-sin" });
  const { pins } = addPin(addPin([], first).pins, second);
  assert.deepEqual(
    pins.map((entry) => entry.optionId),
    ["mad-qf-sin", "bcn-sq-sin"],
  );
});

test("re-pinning is idempotent and does not re-date the quote", () => {
  const original = pin();
  const restated = pin({ fareEurPP: 1_400, pinnedAt: "2026-09-01T00:00:00.000Z" });
  const { pins, full } = addPin([original], restated);

  assert.equal(full, false);
  assert.equal(pins.length, 1);
  // The instant is the whole value of a pin. A second click must not quietly
  // replace the quote-at-pin-time with today's.
  assert.equal(pins[0].fareEurPP, 1_240);
  assert.equal(pins[0].pinnedAt, PINNED_AT);
});

test("the cap refuses rather than evicting", () => {
  const full = Array.from({ length: MAX_PINS }, (_, index) =>
    pin({ optionId: `option-${index}` }),
  );
  const result = addPin(full, pin({ optionId: "one-too-many" }));

  assert.equal(result.full, true);
  assert.equal(result.pins.length, MAX_PINS);
  // Dropping the oldest would silently delete something the couple chose to
  // watch; refusing tells them, and the UI has a sentence for it.
  assert.equal(isPinned(result.pins, pinIdOf("outbound", "option-0", "2026-12-12")), true);
});

test("unpinning removes exactly one", () => {
  const pins = [pin(), pin({ optionId: "mad-qf-sin" })];
  const left = removePin(pins, pins[0].id);
  assert.deepEqual(
    left.map((entry) => entry.optionId),
    ["mad-qf-sin"],
  );
  assert.deepEqual(removePin(left, "not-a-pin"), left);
});

/* ------------------------------------------------------------------ */
/* Repair, never reject                                                */
/* ------------------------------------------------------------------ */

test("anything that is not a list of pins reads as an empty watchlist", () => {
  for (const raw of [null, undefined, 42, "pins", { pins: [] }]) {
    assert.deepEqual(parsePins(raw), []);
  }
});

test("a pin from an older build keeps what it has and defaults the rest", () => {
  const [repaired] = parsePins([
    { leg: "return", optionId: "syd-sq-sin", from: "SYD", to: "BCN", date: "2027-02-12" },
  ]);

  assert.equal(repaired.id, pinIdOf("return", "syd-sq-sin", "2027-02-12"));
  assert.equal(repaired.carrier, "Unknown carrier");
  // Null rather than zero: "no price recorded" is a thing the watchlist can
  // say, and €0 is a thing it would have to lie about.
  assert.equal(repaired.fareEurPP, null);
  assert.equal(repaired.totalEurCouple, null);
  assert.equal(repaired.comfort, null);
  assert.equal(repaired.fareSource, "estimate");
});

test("an entry with nothing to identify it is dropped, and the rest survive", () => {
  const pins = parsePins([
    { leg: "outbound", optionId: "a", from: "BCN", to: "PER" }, // no date
    { optionId: "b", from: "BCN", to: "PER", date: "2026-12-12" }, // no leg
    { leg: "sideways", optionId: "c", from: "BCN", to: "PER", date: "2026-12-12" },
    "not a pin",
    null,
    pin(),
  ]);

  assert.deepEqual(pins.map((entry) => entry.optionId), ["bcn-sq-sin"]);
});

test("a nonsense price is repaired to absent rather than trusted", () => {
  const [repaired] = parsePins([
    { ...pin(), fareEurPP: -50, totalEurCouple: Number.NaN, comfort: "high" },
  ]);
  assert.equal(repaired.fareEurPP, null);
  assert.equal(repaired.totalEurCouple, null);
  assert.equal(repaired.comfort, null);
});

test("a stored id that disagrees with its own fields is recomputed", () => {
  // One pin with two identities would be pinned in the watchlist and unpinned
  // on the row it came from.
  const [repaired] = parsePins([{ ...pin(), id: "something-else" }]);
  assert.equal(repaired.id, pinIdOf("outbound", "bcn-sq-sin", "2026-12-12"));
});

test("duplicates collapse and the cap holds on read", () => {
  assert.equal(parsePins([pin(), pin(), pin()]).length, 1);

  const overflowing = Array.from({ length: MAX_PINS + 5 }, (_, index) =>
    pin({ optionId: `option-${index}` }),
  );
  assert.equal(parsePins(overflowing).length, MAX_PINS);
});

/* ------------------------------------------------------------------ */
/* Drift                                                               */
/* ------------------------------------------------------------------ */

test("a fare that has risen since the pin drifts up, to the euro", () => {
  const drift = driftOf(pin({ fareEurPP: 1_240 }), 1_280.4);
  assert.deepEqual(drift, {
    currentEurPP: 1_280,
    deltaEur: 40,
    direction: "up",
    reason: null,
  });
});

test("a fare that has fallen drifts down, and an unchanged one reads flat", () => {
  assert.equal(driftOf(pin(), 1_200).direction, "down");
  assert.equal(driftOf(pin(), 1_240).direction, "flat");
  assert.equal(driftOf(pin(), 1_240).deltaEur, 0);
});

test("a pin taken against the research band has no drift to report", () => {
  const drift = driftOf(pin({ fareSource: "estimate" }), 1_400);
  assert.equal(drift.deltaEur, null);
  assert.equal(drift.reason, "estimate");
  // The current price is still worth showing; it is the *comparison* that would
  // have been guess-versus-quote.
  assert.equal(drift.currentEurPP, 1_400);
});

test("nothing stored since the pin says so rather than reading as flat", () => {
  const drift = driftOf(pin(), null);
  assert.equal(drift.reason, "nothing-since");
  assert.equal(drift.direction, null);
  assert.equal(drift.currentEurPP, null);
});

test("a pin with no price at pin time reports why, not a delta", () => {
  assert.equal(driftOf(pin({ fareEurPP: null }), 1_100).reason, "unpriced");
});

/* ------------------------------------------------------------------ */
/* The endpoint the watchlist reads                                    */
/* ------------------------------------------------------------------ */

const ask = async (query: string): Promise<{ status: number; series: FareSeries[] }> => {
  const response = await GET(new Request(`https://example.test/api/fares/history${query}`));
  const body = (await response.json()) as { series?: FareSeries[] };
  return { status: response.status, series: body.series ?? [] };
};

const seed = async (kv: FakeKv, date: string, prices: readonly number[]) => {
  for (const [index, priceEur] of prices.entries()) {
    await appendFareHistory(kv, "BCN", "PER", date, {
      ts: `2026-08-${String(20 + index).padStart(2, "0")}T12:00:00.000Z`,
      priceEur,
      carrier: "Singapore Airlines",
      source: "searchapi",
    });
  }
};

test.afterEach(() => setKvClient(null));

test("a pinned route-day comes back as a line, oldest point first", async () => {
  const kv = fakeKv();
  await seed(kv, "2026-12-12", [1_100, 1_200, 1_300]);
  setKvClient(kv);

  const { status, series } = await ask("?pin=BCN-PER:2026-12-12");
  assert.equal(status, 200);
  assert.equal(series.length, 1);
  assert.deepEqual(series[0].points.map((point) => point.priceEur), [1_100, 1_200, 1_300]);
  assert.equal(series[0].current?.priceEur, 1_300);
  assert.equal(series[0].current?.carrier, "Singapore Airlines");
  assert.equal(series[0].trend, "up");
});

test("a pin nobody has priced comes back empty rather than absent", async () => {
  setKvClient(fakeKv());

  const { series } = await ask("?pin=BCN-PER:2026-12-19");
  assert.equal(series.length, 1);
  assert.deepEqual(series[0].points, []);
  assert.equal(series[0].current, null);
  assert.equal(series[0].trend, null);
});

test("drawing the watchlist spends nothing — no writes, no fetch", async () => {
  const kv = fakeKv();
  await seed(kv, "2026-12-12", [1_100, 1_200]);
  const writesBefore = kv.writes.length;
  setKvClient(kv);

  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetched = true;
    return Response.json({});
  };

  try {
    await ask("?pin=BCN-PER:2026-12-12");
    assert.equal(fetched, false, "the watchlist must never reach SearchAPI");
    assert.equal(kv.writes.length, writesBefore, "and it must never write");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stale and duplicate entries shorten the answer rather than failing it", async () => {
  const kv = fakeKv();
  await seed(kv, "2026-12-12", [1_100]);
  setKvClient(kv);

  const { status, series } = await ask(
    "?pin=BCN-PER:2026-12-12,ZZZ-PER:2026-12-12,BCN-PER:2025-01-01,BCN-PER:2026-12-12",
  );
  assert.equal(status, 200);
  assert.equal(series.length, 1, "unknown pair, out-of-window day and duplicate all drop");
});

test("a request naming nothing knowable is refused, not answered emptily", async () => {
  setKvClient(fakeKv());
  assert.equal((await ask("")).status, 400);
  assert.equal((await ask("?pin=ZZZ-YYY:2026-12-12")).status, 400);
});

test("the endpoint will not fan out past a full watchlist", async () => {
  setKvClient(fakeKv());

  const days = Array.from({ length: MAX_PINS + 6 }, (_, index) => {
    const day = String(1 + index).padStart(2, "0");
    return `BCN-PER:2026-12-${day}`;
  });
  const { series } = await ask(`?pin=${days.join(",")}`);
  assert.equal(series.length, MAX_PINS);
});
