import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/fares/coverage/route";
import type { CoverageReport } from "@/lib/flights/coverage";
import { OUTBOUND_DEFAULT_DATE } from "@/lib/flights/grid";
import { appendFareHistory } from "@/lib/flights/history";
import { fakeKv, type FakeKv } from "@/lib/store/__tests__/fake-kv";
import { setKvClient } from "@/lib/store/kv";

const ask = async (query: string): Promise<{ status: number; body: CoverageReport }> => {
  const response = await GET(new Request(`https://example.test/api/fares/coverage${query}`));
  return { status: response.status, body: (await response.json()) as CoverageReport };
};

const dayOf = (report: CoverageReport, date: string) =>
  report.days.find((day) => day.date === date) ?? null;

test.afterEach(() => setKvClient(null));

test("a route with no stored fares reports its warmed days and nothing else", async () => {
  setKvClient(fakeKv());

  const { status, body } = await ask("?route=BCN-PER");
  assert.equal(status, 200);
  assert.deepEqual(body.window, { start: "2026-12-01", end: "2027-02-28" });
  assert.equal(body.routes.length, 1);
  assert.deepEqual(body.routes[0].dates, {});
  // Warmed is a claim about the cron's list, never about having a price.
  assert.deepEqual(dayOf(body, OUTBOUND_DEFAULT_DATE), {
    date: OUTBOUND_DEFAULT_DATE,
    source: "warm",
    cheapestEur: null,
    routes: 0,
  });
  assert.equal(dayOf(body, "2027-01-09"), null);
});

test("a stored observation makes its day known, with the price", async () => {
  const kv = fakeKv({
    "fares:cov:BCN-PER": { "2027-01-09": { priceEur: 1_240, ts: "2026-08-27T12:00:00.000Z" } },
  });
  setKvClient(kv);

  const { body } = await ask("?route=BCN-PER");
  assert.deepEqual(dayOf(body, "2027-01-09"), {
    date: "2027-01-09",
    source: "history",
    cheapestEur: 1_240,
    routes: 1,
  });
  assert.equal(body.routes[0].snapshotEur, 1_900);
});

test("several routes fold into one cheapest price per day", async () => {
  setKvClient(
    fakeKv({
      "fares:cov:BCN-PER": { "2027-01-09": { priceEur: 1_240, ts: "2026-08-27T12:00:00.000Z" } },
      "fares:cov:MAD-PER": { "2027-01-09": { priceEur: 1_180, ts: "2026-08-27T12:00:00.000Z" } },
      "fares:cov:MXP-PER": { "2027-02-02": { priceEur: 1_400, ts: "2026-08-27T12:00:00.000Z" } },
    }),
  );

  const { body } = await ask("?route=BCN-PER,MAD-PER,MXP-PER");
  assert.equal(body.routes.length, 3);
  assert.deepEqual(dayOf(body, "2027-01-09"), {
    date: "2027-01-09",
    source: "history",
    cheapestEur: 1_180,
    routes: 2,
  });
  assert.equal(dayOf(body, "2027-02-02")?.routes, 1);
});

test("stored dates outside the window are not reported as coverage", async () => {
  setKvClient(
    fakeKv({
      "fares:cov:BCN-PER": {
        "2026-11-30": { priceEur: 900, ts: "2026-08-27T12:00:00.000Z" },
        "2027-01-09": { priceEur: 1_240, ts: "2026-08-27T12:00:00.000Z" },
      },
    }),
  );

  const { body } = await ask("?route=BCN-PER");
  assert.deepEqual(Object.keys(body.routes[0].dates), ["2027-01-09"]);
  assert.equal(dayOf(body, "2026-11-30"), null);
});

test("unknown pairs are dropped, and a request with only unknown pairs is a 400", async () => {
  setKvClient(fakeKv());

  const mixed = await ask("?route=BCN-PER,VLC-SYD");
  assert.equal(mixed.status, 200);
  assert.deepEqual(mixed.body.routes.map((route) => route.route), ["BCN-PER"]);

  assert.equal((await ask("?route=VLC-SYD")).status, 400);
  assert.equal((await ask("")).status, 400);
});

test("the endpoint only reads: no key is written answering it", async () => {
  const kv: FakeKv = fakeKv({
    "fares:cov:BCN-PER": { "2027-01-09": { priceEur: 1_240, ts: "2026-08-27T12:00:00.000Z" } },
  });
  setKvClient(kv);

  await ask("?route=BCN-PER,MAD-PER");
  assert.deepEqual(kv.writes, []);
});

test("a history write is what puts a day on the index", async () => {
  const kv = fakeKv();
  setKvClient(kv);

  await appendFareHistory(kv, "BCN", "PER", "2027-01-09", {
    ts: "2026-08-27T12:00:00.000Z",
    priceEur: 1_240,
    carrier: "Test Air",
    source: "searchapi",
  });

  const { body } = await ask("?route=BCN-PER");
  assert.equal(dayOf(body, "2027-01-09")?.cheapestEur, 1_240);
});
