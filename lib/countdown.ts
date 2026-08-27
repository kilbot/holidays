"use client";

/**
 * "Today", and the days between here and a deadline.
 *
 * Lifted out of `date-strip` when the Resources page (#67) needed the same
 * chip. The rule it encodes is the reason it is worth sharing rather than
 * writing twice:
 *
 * **A countdown must not be rendered on the server.** Baked into the HTML it is
 * a day wrong for anyone who leaves the tab open overnight, and it mismatches
 * hydration across a midnight. So the server snapshot is deliberately `null`
 * and every caller renders its labels first, with the number arriving on the
 * client. `null` is not a loading state to spinner over — it is the honest
 * answer to "what day is it" on a machine that is not the reader's.
 */

import { useSyncExternalStore } from "react";

import { daysBetween } from "@/lib/trip-dates";

const noSubscription = () => () => {};
const todayIso = () => new Date().toISOString().slice(0, 10);
const noToday = () => null;

/** The viewer's today as an ISO day, or `null` on the server. */
export function useToday(): string | null {
  return useSyncExternalStore(noSubscription, todayIso, noToday);
}

/**
 * Whole days from `today` to `iso`. Today is 0, tomorrow is 1, and a date that
 * has been and gone is negative.
 *
 * `daysBetween` is inclusive — it answers "how many days is this span" — so the
 * minus one turns a span into a distance.
 */
export function daysUntil(today: string, iso: string): number {
  return daysBetween(today, iso) - 1;
}
