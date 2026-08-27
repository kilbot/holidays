/**
 * What is actually on the Plan.
 *
 * Two stores have an opinion about that and they used to be merged with a
 * union, which is the bug #58 reported: `usePlan` computed
 *
 * ```ts
 * toggled: [...new Set([...input.toggled, ...placed])]
 * ```
 *
 * A union can only ever *add*. The reference Scenario ships with all eight
 * researched Adventures in `input.toggled`, and the only control the site gives
 * for putting an Adventure on the Plan or taking it off is the shortlist verdict
 * — so every one of those eight was pinned on, permanently, and the traveller
 * flipping "In the plan" watched a €24,541 total refuse to move.
 *
 * The fix is to stop treating the two lists as equals. They are not:
 *
 * - **The Scenario's `toggled` list is the seed.** It is what the Plan starts as
 *   and what a Fork carries — the reference trip, or whatever the couple saved.
 * - **A shortlist verdict is a decision made after the fact**, about one idea, by
 *   the person looking at it. When there is one, it wins.
 *
 * So: an idea marked *placed* is on the Plan, an idea marked *interested* or
 * *discarded* is off it, and an idea with no verdict at all falls back to the
 * seed. Which is also what the four states in docs/CONTEXT.md say — *placed* is
 * "on the Plan — give it calendar days", and the bench "occupies no calendar
 * Days" — stated in a way the engine can act on.
 *
 * Pure and React-free on purpose: `scenarios.ts` needs it to price every
 * Scenario the same way the current one is priced, and `node --test` needs it
 * without importing a store.
 */

/** The shortlist verdicts, as far as Plan membership is concerned. */
export type Verdict = "interested" | "placed" | "discarded";

export type VerdictMap = Readonly<Record<string, Verdict>>;

/**
 * The Capsule ids the Scheduler should place, sorted for a stable identity.
 *
 * Sorted because the result feeds a `useMemo` dependency and a `buildPlan`
 * input: two runs over the same state must produce the same array, or the Plan
 * rebuilds on every render.
 */
export function planMembership(
  toggled: readonly string[],
  marks: VerdictMap,
): string[] {
  const on = new Set(toggled);

  for (const [id, verdict] of Object.entries(marks)) {
    if (verdict === "placed") on.add(id);
    else on.delete(id);
  }

  return [...on].sort();
}
