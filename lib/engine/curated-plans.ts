/**
 * The Scenarios as lettered Plans — Plan A, Plan B, … — and where each one's
 * write-up lives, if it has one.
 *
 * Scenarios are curated, not created on the site (2026-09-30): the Travellers
 * give Claude their preferences and it adds the next Plan, as a seeded Scenario
 * in `scenario-doc.ts` plus, when the brief is written, a markdown write-up in
 * `content/plans/`. So the letter is a fact about the Scenario, fixed here by
 * id, rather than its position in the list — deleting Plan B must not quietly
 * turn Plan C into a second Plan B.
 *
 * The Scenario's own `name` stays what it was and becomes the subtitle: "Plan A
 * · The All-Stops Tour".
 */

export interface CuratedPlan {
  /** The Scenario id this Plan is. */
  id: string;
  letter: string;
  /** The written plan, when there is one. */
  writeup?: {
    /** The URL segment under `/scenarios/`. */
    slug: string;
    /** File name in `content/plans/`, exactly as the Traveller wrote it. */
    file: string;
    /** Whose words the write-up is. */
    by: string;
  };
}

export const CURATED_PLANS: readonly CuratedPlan[] = [
  { id: "fireworks-nye", letter: "A" },
  { id: "comfortable-10k", letter: "B" },
  { id: "aggressive-15k", letter: "C" },
  {
    id: "adeline-west-to-east",
    letter: "D",
    writeup: {
      slug: "plan-d",
      file: "plan-d-adeline-west-to-east.md",
      by: "Adeline",
    },
  },
];

const BY_ID = new Map(CURATED_PLANS.map((plan) => [plan.id, plan]));

/**
 * The letter a Scenario shows under.
 *
 * A Scenario from before the letters (a copy made in some browser, a fork the
 * couple adopted) has none of its own, so it takes the next letter after the
 * curated ones by its position among the uncurated — never one of the curated
 * letters, so no two rows ever share one.
 */
export function planLetter(
  id: string,
  scenarios: readonly { id: string }[],
): string {
  const curated = BY_ID.get(id);
  if (curated) return curated.letter;
  const uncurated = scenarios.filter((scenario) => !BY_ID.has(scenario.id));
  const offset = Math.max(
    0,
    uncurated.findIndex((scenario) => scenario.id === id),
  );
  return String.fromCharCode(65 + CURATED_PLANS.length + offset);
}

/** "Plan D · Adeline's pick — west to east". */
export function planTitle(letter: string, name: string): string {
  return `Plan ${letter} · ${name}`;
}

export function curatedPlan(id: string): CuratedPlan | undefined {
  return BY_ID.get(id);
}

export function curatedPlanBySlug(slug: string): CuratedPlan | undefined {
  return CURATED_PLANS.find((plan) => plan.writeup?.slug === slug);
}
