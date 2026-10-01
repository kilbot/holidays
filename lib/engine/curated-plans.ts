/**
 * Numbered Scenarios and their curated write-ups, fixed by Scenario id.
 */

export interface CuratedPlan {
  /** The Scenario id this plan is. */
  id: string;
  /** Holds the Scenario's number as a string, renumbered 2026-10-01. */
  letter: string;
  /** The written plan, when there is one. */
  writeup?: {
    /** The URL segment under `/scenarios/`. */
    slug: string;
    /** File name in `content/plans/`, exactly as the Traveller wrote it. */
    file: string;
    /** Whose words the write-up is. */
    by?: string;
  };
}

export const CURATED_PLANS: readonly CuratedPlan[] = [
  {
    id: "adeline-west-to-east",
    letter: "1",
    writeup: {
      slug: "adeline-west-to-east",
      file: "plan-d-adeline-west-to-east.md",
      by: "Adeline",
    },
  },
  { id: "fireworks-nye", letter: "2", writeup: { slug: "all-stops", file: "all-stops.md" } },
  { id: "comfortable-10k", letter: "3", writeup: { slug: "comfortable", file: "comfortable.md" } },
  { id: "aggressive-15k", letter: "4", writeup: { slug: "aggressive", file: "aggressive.md" } },
];

const BY_ID = new Map(CURATED_PLANS.map((plan) => [plan.id, plan]));

/**
 * The number a Scenario shows under.
 *
 * An uncurated Scenario takes the next number after the curated ones by its
 * position among the uncurated.
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
  return String(CURATED_PLANS.length + offset + 1);
}

/** "Scenario 1 · Adeline's pick — west to east". */
export function planTitle(letter: string, name: string): string {
  return `Scenario ${letter} · ${name}`;
}

export function curatedPlan(id: string): CuratedPlan | undefined {
  return BY_ID.get(id);
}

export function curatedPlanBySlug(slug: string): CuratedPlan | undefined {
  return CURATED_PLANS.find((plan) => plan.writeup?.slug === slug);
}
