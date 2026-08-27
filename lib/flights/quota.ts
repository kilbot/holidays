import type { KvClient } from "@/lib/store/kv";
export const MONTHLY_CALL_BUDGET = 2_000;
export const DAILY_CALL_CAP = 150;
const MONTH_TTL_SECONDS = 35 * 24 * 60 * 60;
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;
const dateParts = (now: Date) => now.toISOString().slice(0, 10);
const monthOf = (now: Date) => dateParts(now).slice(0, 7);
const monthKey = (now: Date) => `quota:${monthOf(now)}`;
const dayKey = (now: Date) => `quota:day:${dateParts(now)}`;

export interface FareQuota { used: number; budget: number; month: string }

export async function readFareQuota(kv: KvClient, now = new Date()): Promise<FareQuota> {
  return {
    used: (await kv.getJson<number>(monthKey(now))) ?? 0,
    budget: MONTHLY_CALL_BUDGET,
    month: monthOf(now),
  };
}
/** Reserve one outbound SearchAPI request, or refuse it at either quota cap. */
export async function reserveFareCall(kv: KvClient, now = new Date()): Promise<boolean> {
  const monthly = (await kv.getJson<number>(monthKey(now))) ?? 0;
  if (monthly >= MONTHLY_CALL_BUDGET) return false;
  const daily = (await kv.getJson<number>(dayKey(now))) ?? 0;
  if (daily >= DAILY_CALL_CAP) return false;
  // Hobby-site stakes: this check/increment pair may race by a few calls, which
  // costs quota but cannot corrupt user data and does not justify locking.
  await kv.incrementWithTtl(monthKey(now), MONTH_TTL_SECONDS);
  await kv.incrementWithTtl(dayKey(now), DAY_TTL_SECONDS);
  return true;
}
