import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_CALL_CAP,
  DAILY_CALL_CAP_PER_IP,
  MONTHLY_CALL_BUDGET,
  monthlyResetLabel,
  readFareQuota,
  reserveFareCall,
  reserveIpFareCall,
} from "@/lib/flights/quota";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";

const NOW = new Date("2026-08-27T12:00:00.000Z");

test("a permitted real call increments its monthly and daily counters", async () => {
  const kv = fakeKv();

  assert.equal(await reserveFareCall(kv, NOW), true);
  assert.equal(await kv.getJson("quota:2026-08"), 1);
  assert.equal(await kv.getJson("quota:day:2026-08-27"), 1);
});

test("the monthly budget blocks a call without incrementing either counter", async () => {
  const kv = fakeKv({ "quota:2026-08": MONTHLY_CALL_BUDGET });

  assert.equal(await reserveFareCall(kv, NOW), false);
  assert.equal(await kv.getJson("quota:2026-08"), MONTHLY_CALL_BUDGET);
  assert.equal(await kv.getJson("quota:day:2026-08-27"), null);
});

test("the daily soft cap blocks a call without consuming monthly budget", async () => {
  const kv = fakeKv({
    "quota:2026-08": 12,
    "quota:day:2026-08-27": DAILY_CALL_CAP,
  });

  assert.equal(await reserveFareCall(kv, NOW), false);
  assert.equal(await kv.getJson("quota:2026-08"), 12);
});

test("the quota read reports the current month and zero when unused", async () => {
  assert.deepEqual(await readFareQuota(fakeKv(), NOW), {
    used: 0,
    budget: 2_000,
    month: "2026-08",
    usedToday: 0,
    dailyCap: DAILY_CALL_CAP,
    perIpDailyCap: DAILY_CALL_CAP_PER_IP,
    gate: "open",
  });
});

/* ------------------------------------------------------------------ */
/* Which gate is shut, and what the page is entitled to say about it   */
/* ------------------------------------------------------------------ */

/**
 * The reason this matters is a bug report, not a hypothetical: the user hit
 * the old 150-a-day guard mid-afternoon, every later row quietly fell back to
 * stored prices with no explanation anywhere on the page, and the honest
 * reading of that was *the data doesn't work*. The counter alone could not say
 * it — 151 of 2,000 monthly looks like plenty of headroom — so the gate is
 * reported as its own fact.
 */
test("the daily guard is reported as the reason, with monthly headroom intact", async () => {
  const kv = fakeKv({
    "quota:2026-08": 151,
    "quota:day:2026-08-27": DAILY_CALL_CAP,
  });

  const quota = await readFareQuota(kv, NOW);
  assert.equal(quota.gate, "daily");
  assert.equal(quota.usedToday, DAILY_CALL_CAP);
  // The half of the report that made the old silence so misleading.
  assert.ok(quota.used < quota.budget, "the month is nowhere near spent");
  // And the gate is not a label the read invented: the call is refused too.
  assert.equal(await reserveFareCall(kv, NOW), false);
});

test("a spent month outranks a spent day — the sentence is different", async () => {
  const kv = fakeKv({
    "quota:2026-08": MONTHLY_CALL_BUDGET,
    "quota:day:2026-08-27": DAILY_CALL_CAP,
  });

  // "resume tomorrow" would be wrong when the budget does not come back until
  // the 1st, so monthly wins whenever both are reached.
  assert.equal((await readFareQuota(kv, NOW)).gate, "monthly");
});

test("a day under the guard leaves the gate open", async () => {
  const kv = fakeKv({
    "quota:2026-08": 151,
    "quota:day:2026-08-27": DAILY_CALL_CAP - 1,
  });

  assert.equal((await readFareQuota(kv, NOW)).gate, "open");
  assert.equal(await reserveFareCall(kv, NOW), true);
});

/* ------------------------------------------------------------------ */
/* Concurrency: the caps have to hold under a burst                    */
/* ------------------------------------------------------------------ */

/**
 * The failure this is about is not theoretical — it is what "hard cap" meant
 * before kilbot/holidays#90. `reserveFareCall` read the counter, compared it to
 * the cap and then incremented, so every caller in a burst read the same value
 * before any of them wrote and every one of them was told there was room. One
 * stuck effect firing forty requests at a cap with one call left in it spent
 * forty.
 *
 * `fakeKv`'s `incrementWithTtl` models `INCR` faithfully — read and write with
 * no `await` between them — so `Promise.all` here really does interleave the
 * way concurrent requests do, and this test fails against the old code.
 */
test("a concurrent burst cannot spend more than the daily cap allows", async () => {
  const kv = fakeKv({
    "quota:2026-08": 0,
    "quota:day:2026-08-27": DAILY_CALL_CAP - 3,
  });

  const results = await Promise.all(
    Array.from({ length: 40 }, () => reserveFareCall(kv, NOW)),
  );

  assert.equal(
    results.filter(Boolean).length,
    3,
    "exactly the three calls that were left",
  );
  assert.equal(await kv.getJson("quota:day:2026-08-27"), DAILY_CALL_CAP);
  assert.equal(
    await kv.getJson("quota:2026-08"),
    3,
    "and the refused calls gave the monthly budget back",
  );
});

test("a burst against a spent month leaves the daily counter alone", async () => {
  const kv = fakeKv({ "quota:2026-08": MONTHLY_CALL_BUDGET });

  const results = await Promise.all(
    Array.from({ length: 25 }, () => reserveFareCall(kv, NOW)),
  );

  assert.equal(results.filter(Boolean).length, 0);
  assert.equal(await kv.getJson("quota:2026-08"), MONTHLY_CALL_BUDGET);
  // The month is the gate that refused them, so none of them may cost a day.
  assert.equal(await kv.getJson("quota:day:2026-08-27"), null);
});

test("a refused call costs nothing, so the next one still gets through", async () => {
  const kv = fakeKv({ "quota:day:2026-08-27": DAILY_CALL_CAP });

  assert.equal(await reserveFareCall(kv, NOW), false);
  assert.equal(
    await kv.getJson("quota:2026-08"),
    0,
    "the monthly increment was handed back",
  );

  // A new day, and the month is exactly as unspent as it should be.
  const tomorrow = new Date("2026-08-28T09:00:00.000Z");
  assert.equal(await reserveFareCall(kv, tomorrow), true);
  assert.equal(await kv.getJson("quota:2026-08"), 1);
});

/* ------------------------------------------------------------------ */
/* The per-IP allowance: /api/fares is keyless, not free                */
/* ------------------------------------------------------------------ */

/** A fare request from one address. The header Vercel actually sets. */
const from = (ip: string) =>
  new Request("https://example.test/api/fares?from=BCN&to=PER&date=2026-12-12", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });

test("one visitor's allowance runs out without touching anybody else's", async () => {
  const kv = fakeKv({
    [`ip:fare:1.2.3.4:2026-08-27`]: DAILY_CALL_CAP_PER_IP - 1,
  });

  assert.equal(await reserveIpFareCall(kv, from("1.2.3.4"), NOW), true);
  assert.equal(await reserveIpFareCall(kv, from("1.2.3.4"), NOW), false);
  assert.equal(
    await kv.getJson(`ip:fare:1.2.3.4:2026-08-27`),
    DAILY_CALL_CAP_PER_IP,
    "the refused call was handed back",
  );

  // The couple, on a different connection, are unaffected — which is the whole
  // reason this is a per-IP cap and not a lower shared one.
  assert.equal(await reserveIpFareCall(kv, from("5.6.7.8"), NOW), true);
});

test("a burst from one address cannot walk past its allowance", async () => {
  const kv = fakeKv({
    [`ip:fare:1.2.3.4:2026-08-27`]: DAILY_CALL_CAP_PER_IP - 5,
  });

  const results = await Promise.all(
    Array.from({ length: 60 }, () => reserveIpFareCall(kv, from("1.2.3.4"), NOW)),
  );

  assert.equal(results.filter(Boolean).length, 5);
  assert.equal(
    await kv.getJson(`ip:fare:1.2.3.4:2026-08-27`),
    DAILY_CALL_CAP_PER_IP,
  );
});

test("the allowance is per day, and yesterday's is not this one", async () => {
  const kv = fakeKv({
    [`ip:fare:1.2.3.4:2026-08-27`]: DAILY_CALL_CAP_PER_IP,
  });

  assert.equal(await reserveIpFareCall(kv, from("1.2.3.4"), NOW), false);
  assert.equal(
    await reserveIpFareCall(kv, from("1.2.3.4"), new Date("2026-08-28T01:00:00.000Z")),
    true,
  );
});

test("an unreachable store lets the visitor through rather than blocking them", async () => {
  // Fails open, like every other guard here. A limiter that takes the site down
  // when Redis is unreachable has become the outage it exists to prevent.
  const broken = {
    ...fakeKv(),
    async incrementWithTtl(): Promise<number> {
      throw new Error("no store");
    },
  };
  assert.equal(await reserveIpFareCall(broken, from("1.2.3.4"), NOW), true);
});

test("the meter is told what one visitor may spend", async () => {
  // The fine print on the Flights page reads this. A shared budget with no
  // stated per-visitor limit is one the couple cannot reason about when it
  // empties.
  const quota = await readFareQuota(fakeKv(), NOW);
  assert.equal(quota.perIpDailyCap, DAILY_CALL_CAP_PER_IP);
});

test("the monthly reset reads as a date, and wraps at the year", () => {
  assert.equal(monthlyResetLabel("2026-08"), "1 Sep");
  assert.equal(monthlyResetLabel("2026-12"), "1 Jan");
  assert.equal(monthlyResetLabel("nonsense"), "next month");
});
