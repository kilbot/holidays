/**
 * What is actually on the Plan — and where that fact is allowed to live.
 *
 * Two stores had an opinion and they were merged with a union, which is the bug
 * #58 reported. `usePlan` computed
 *
 * ```ts
 * toggled: [...new Set([...input.toggled, ...placed])]
 * ```
 *
 * A union can only ever *add*. The reference Scenario ships with all eight
 * researched Adventures in `input.toggled`, and the only control the site gives
 * for putting an Adventure on the Plan or taking it off is the shortlist's *In
 * the plan* switch — so every one of those eight was pinned on, permanently, and
 * the traveller flipping the switch watched a €24,541 total refuse to move.
 *
 * ## One source of truth: the Scenario
 *
 * The fix is not a better merge, it is deleting one of the two opinions.
 * Membership is `input.toggled` and nothing else, because that is the list that
 *
 * - is synced to the canonical Plan, so the couple's other phone agrees;
 * - a Fork copies, so a visitor's version is the version they saw;
 * - a hydrate can **put back** — which is what makes a view-mode preview
 *   genuinely revertible. The shortlist lives in localStorage and the server has
 *   never heard of it, so membership held there would survive a discard and a
 *   reload, and "reverting on reload" would be a lie the site told twice.
 *
 * The shortlist keeps what it is good at: *interested* (on the bench, no
 * calendar days) and *discarded* (stop showing me this), which are one
 * traveller's sift and rightly per-browser. `lib/shortlist.ts` writes the
 * Scenario through whenever a verdict bears on membership.
 *
 * ## The display alias
 *
 * docs/CONTEXT.md still names four shortlist states, and *placed* is one of
 * them: "on the Plan — give it calendar days". So *placed* survives as a
 * **derived** verdict — `effectiveVerdicts` below — and every surface that draws
 * a pin, a pressed button or a filter reads that rather than the raw marks. It
 * settles the two ways the two stores can disagree:
 *
 * - a Capsule on the Plan with no verdict recorded (all eight of them, on a
 *   first visit) reads as *placed*, so pressing *Plan* on it is not a no-op that
 *   looks like a click;
 * - a stale *placed* mark left behind by a discarded preview reads as nothing at
 *   all, because the Plan it referred to has been put back.
 *
 * Pure and React-free: `node --test` needs it without a store, and it is the
 * kind of rule that should be readable in one screen.
 */

/** The shortlist verdicts, as far as the Plan is concerned. */
export type Verdict = "interested" | "placed" | "discarded";

export type VerdictMap = Readonly<Record<string, Verdict>>;

/**
 * The Capsule ids the Scheduler should place.
 *
 * Deduplicated and sorted, because the result feeds a `useMemo` dependency and a
 * `buildPlan` input: two runs over the same Scenario must produce the same
 * array, or the Plan rebuilds on every render.
 */
export function planMembership(toggled: readonly string[]): string[] {
  return [...new Set(toggled)].sort();
}

/**
 * The verdicts as the UI should show them, reconciled against the Plan.
 *
 * On the Plan wins in both directions — see the module note above. Everything
 * else passes through untouched, so a bench of six ideas is still a bench of six
 * ideas.
 */
export function effectiveVerdicts(
  toggled: readonly string[],
  marks: VerdictMap,
): VerdictMap {
  const onPlan = new Set(toggled);
  const out: Record<string, Verdict> = {};

  for (const [id, verdict] of Object.entries(marks)) {
    // A *placed* mark is only ever a shadow of the Scenario's list; the list
    // itself is added below, so a mark the list does not back is dropped.
    if (verdict !== "placed" && !onPlan.has(id)) out[id] = verdict;
  }
  for (const id of onPlan) out[id] = "placed";

  return out;
}
