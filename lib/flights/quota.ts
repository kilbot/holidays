/**
 * The two ceilings on live fare calls, and the words for hitting one.
 *
 * They are not the same kind of thing, and conflating them is what made the
 * page lie about itself:
 *
 * - **The monthly budget is the couple's own choice.** 2,000 calls is the plan
 *   they are paying for, and spending it is the point — the data is worth
 *   nothing sitting in a quota.
 * - **The daily cap is a runaway guard, not budgeting.** It exists so that a
 *   loop that gets stuck — a bad effect dependency, a cron that fires in a
 *   tight retry, a tab left open re-searching — cannot drain a month between
 *   two glances at the dashboard. It was 150/day, which is not a runaway
 *   threshold, it is a budget in disguise: an ordinary afternoon of moving the
 *   date strip across a fourteen-origin search reaches it, and the user hit it
 *   in a day and read the resulting silent fallback as *the data doesn't work*.
 *   At 500 a genuine runaway still cannot burn the month in under four days,
 *   which is the only job this number has.
 *
 * Whichever one refuses a call, the fetch falls back to stored history or the
 * research band. That fallback is correct and it is also invisible, so this
 * module reports *which gate is shut* alongside the counter, and the Flights
 * page says it in plain words next to the meter. The site's rule everywhere
 * else — inform, never block, and never let a rule read as the world being
 * that shape (docs/CONTEXT.md, Constraint) — applies to its own metered API.
 */

import { reserveDailyPerIp } from "@/lib/store/guards";
import type { KvClient } from "@/lib/store/kv";

export const MONTHLY_CALL_BUDGET = 2_000;

/**
 * Runaway protection, deliberately loose.
 *
 * Read the module comment before lowering it: this is not a spending control,
 * and using it as one is what produced a page that silently stopped pricing
 * things halfway through an afternoon.
 */
export const DAILY_CALL_CAP = 500;

/**
 * How many live fare calls one IP address may spend in a day.
 *
 * `/api/fares` takes no key. That is deliberate and it stays: the view link is
 * the permission, and a friend the couple sent the link to is a legitimate
 * spender of this budget by design. But a public endpoint that spends metered
 * money for anyone is also a public endpoint anyone can drain, and until now
 * the only thing standing between one script and the whole month was the
 * runaway guard — which is to say, four days.
 *
 * 300 is set well above what the page can do by hand. The Flights search is
 * fourteen origins on one date; a determined afternoon of moving the date strip
 * is tens of calls, not hundreds, and the warmed dates are cache hits that cost
 * nothing. Somebody who reaches 300 is not reading a fare calendar.
 *
 * It is not authentication and does not pretend to be — `x-forwarded-for` is
 * spoofable by anyone who cares. It is the difference between "drainable by
 * accident or by a bored script" and "drainable by somebody who means it".
 */
export const DAILY_CALL_CAP_PER_IP = 300;

const MONTH_TTL_SECONDS = 35 * 24 * 60 * 60;
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;
const dateParts = (now: Date) => now.toISOString().slice(0, 10);
const monthOf = (now: Date) => dateParts(now).slice(0, 7);
const monthKey = (now: Date) => `quota:${monthOf(now)}`;
const dayKey = (now: Date) => `quota:day:${dateParts(now)}`;

/**
 * Which ceiling, if either, is currently refusing live calls.
 *
 * `"monthly"` wins when both are reached, because it is the one that does not
 * clear overnight — telling someone to come back tomorrow when the budget is
 * spent until the 1st would be the wrong sentence.
 */
export type QuotaGate = "open" | "daily" | "monthly";

export interface FareQuota {
  used: number;
  budget: number;
  month: string;
  /** Calls made today, against the runaway guard. */
  usedToday: number;
  dailyCap: number;
  /**
   * What one visitor may spend in a day. Reported so the meter's fine print can
   * say it: a shared budget with no per-visitor limit stated is a budget the
   * couple cannot reason about when it empties.
   */
  perIpDailyCap: number;
  gate: QuotaGate;
}

export const gateOf = (monthly: number, daily: number): QuotaGate =>
  monthly >= MONTHLY_CALL_BUDGET
    ? "monthly"
    : daily >= DAILY_CALL_CAP
      ? "daily"
      : "open";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * When the monthly budget refills, as a date a person would say: `"1 Sep"`.
 *
 * Here rather than in the component because it is arithmetic on the same
 * `"2026-08"` this module produces, and a page should not have to know how the
 * counter's key is shaped to say when it resets.
 */
export function monthlyResetLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(index)) return "next month";
  // December rolls to January of the next year; the year is not printed, so
  // only the wrap matters.
  return `1 ${MONTH_NAMES[index % 12]}`;
}

export async function readFareQuota(kv: KvClient, now = new Date()): Promise<FareQuota> {
  const used = (await kv.getJson<number>(monthKey(now))) ?? 0;
  const usedToday = (await kv.getJson<number>(dayKey(now))) ?? 0;
  return {
    used,
    budget: MONTHLY_CALL_BUDGET,
    month: monthOf(now),
    usedToday,
    dailyCap: DAILY_CALL_CAP,
    perIpDailyCap: DAILY_CALL_CAP_PER_IP,
    gate: gateOf(used, usedToday),
  };
}

/**
 * Reserve one live fare call against the asking IP's own daily allowance.
 *
 * Separate from `reserveFareCall` because it answers a different question. That
 * one asks *may this site spend*; this one asks *may this visitor spend*, and
 * the answer to the second being no is not a reason to tell the couple their
 * month is gone. Both refusals fall back to stored history or the research
 * band, which is the honest answer either way.
 */
export function reserveIpFareCall(
  kv: KvClient,
  request: Request,
  now = new Date(),
): Promise<boolean> {
  return reserveDailyPerIp(kv, request, "fare", DAILY_CALL_CAP_PER_IP, now);
}

/**
 * Reserve one outbound SearchAPI request, or refuse it at either quota cap.
 *
 * **Increment first, then look at the number you were given.** The obvious
 * shape — read the counter, compare it to the cap, increment if there is room —
 * is three operations with two gaps in it, and every concurrent caller reads
 * the same value before any of them writes. A burst of forty requests against a
 * cap with one call left in it lets forty through: the counter ends up past the
 * ceiling and the "hard" cap was never hard (kilbot/holidays#90).
 *
 * `INCR` is atomic, so the value it returns is this caller's own place in the
 * queue and no two callers can be handed the same one. Over the line, the
 * number goes back — a refused call must not cost the same as a made one.
 *
 * The monthly budget is checked before the daily counter is touched at all, so
 * a request refused for the month does not spend a day's allowance on its way
 * out. A concurrent `readFareQuota` can catch a counter mid-refund and read one
 * high; it corrects itself within the round trip and no decision is made on it.
 */
export async function reserveFareCall(kv: KvClient, now = new Date()): Promise<boolean> {
  const monthly = await kv.incrementWithTtl(monthKey(now), MONTH_TTL_SECONDS);
  if (monthly > MONTHLY_CALL_BUDGET) {
    await kv.decrement(monthKey(now));
    return false;
  }

  const daily = await kv.incrementWithTtl(dayKey(now), DAY_TTL_SECONDS);
  if (daily > DAILY_CALL_CAP) {
    await kv.decrement(dayKey(now));
    await kv.decrement(monthKey(now));
    return false;
  }

  return true;
}
