/**
 * What one Scenario changes about another.
 *
 * `/scenarios` lists three saved trips whose totals differ by thousands of
 * euros, and a list of totals answers *which is cheaper* without answering the
 * only question that follows it: **what did we give up**. That answer already
 * exists in the data — a Scenario is a saved `PlanInput` (`scenarios.ts` says
 * why), so the difference between two Scenarios is the difference between two
 * plain objects, and it can be derived rather than written down by hand beside
 * each one.
 *
 * Deriving it is the whole point. A hand-written "drops the second reef day"
 * goes stale the moment somebody toggles something, and a Fork adopted from a
 * friend has no hand-written summary at all. This module reads the inputs.
 *
 * ## What is compared, and what is not
 *
 * Everything a Scenario *decides* is compared: the dates, the Adventures on the
 * Plan, the drags, the lodging tiers, the Event knobs, the hire cars, the Leg
 * modes, and the two global toggles.
 *
 * `fareOverrides` is deliberately **not**. Live fares are fetched per tab and
 * merged into every Scenario's input on the way to `buildPlan` (`use-plan.ts`),
 * so they are the same for all of them and belong to the moment rather than to
 * the Scenario. A diff that reported "12 fares differ" the second the network
 * answered would be noise about the site rather than news about the trip.
 *
 * ## Money and days come in from outside
 *
 * `totalEur` and `dayCount` are not derived here. They are properties of the
 * built Plan, not of the input, and the site already computes them exactly one
 * way — `scenarioTotals()` over `buildPlan`. Taking them as arguments is what
 * stops this module growing a second, quietly different opinion about what a
 * Scenario costs.
 */

import type { PlanInput } from "@/lib/engine/types";

/** One side of a comparison: the decisions, and what they came to. */
export interface DiffSubject {
  input: PlanInput;
  /** The plan-on figure, from `scenarioTotals`. */
  totalEur: number;
  dayCount: number;
}

/**
 * One Scenario read against another.
 *
 * Every list is of ids and sorted, so the shape is stable and a caller can
 * render names, count them, or ignore them. Signed numbers are always
 * *subject minus reference*: negative money is cheaper, negative days shorter.
 */
export interface ScenarioDiff {
  /** Nothing a Scenario decides differs. The lists are all empty. */
  identical: boolean;
  /** EUR, subject − reference. Negative is cheaper than the reference. */
  eur: number;
  /** Days, subject − reference. Negative is a shorter trip. */
  days: number;
  /** Adventures on the subject and not on the reference. */
  adventuresAdded: string[];
  /** Adventures on the reference and not on the subject. */
  adventuresRemoved: string[];
  /** The trip's own start or end date moved. */
  datesMoved: boolean;
  /** Event lines the subject switches off and the reference does not. */
  eventsOff: string[];
  /** Event lines the reference switches off and the subject keeps. */
  eventsKept: string[];
  /** Event lines the subject re-prices to a different figure. */
  eventsRepriced: string[];
  /** Adventures or Locations sleeping at a different tier. */
  lodgingChanged: string[];
  /** Adventures dragged to a different day. */
  placementsChanged: string[];
  /** Legs travelled a different way. */
  legModesChanged: string[];
  /** Adventures that gained or lost a paid car. */
  carsChanged: string[];
  /** The FX stress toggle differs. */
  fxStressChanged: boolean;
  /** The contingency row differs. */
  contingencyChanged: boolean;
}

/**
 * Keys whose value differs between two records, absent included.
 *
 * Absent and present-but-equal are the same answer on purpose: a Scenario that
 * writes `contingency: true` where another leaves it out has decided nothing
 * different, and reporting it would be reporting how the object was written
 * rather than what the trip is.
 */
function changedKeys<T extends string | number | boolean>(
  subject: Readonly<Record<string, T>>,
  reference: Readonly<Record<string, T>>,
): string[] {
  const keys = new Set([...Object.keys(subject), ...Object.keys(reference)]);
  return [...keys].filter((key) => subject[key] !== reference[key]).sort();
}

/** Ids in `these` and not in `those`, sorted. */
function missingFrom(
  these: readonly string[],
  those: readonly string[],
): string[] {
  const have = new Set(those);
  return [...these].filter((id) => !have.has(id)).sort();
}

/** Whether an Event knob means "this line is off". Absent and `true` do not. */
const isOff = (knob: boolean | number | undefined): boolean => knob === false;

/**
 * Read `subject` against `reference` — normally, every Scenario against the
 * current Plan.
 *
 * Pure, and cheap: a handful of set operations over objects with a few dozen
 * keys. Nothing here builds a Plan.
 */
export function diffScenarios(
  subject: DiffSubject,
  reference: DiffSubject,
): ScenarioDiff {
  const a = subject.input;
  const b = reference.input;

  const eventKeys = new Set([
    ...Object.keys(a.eventOverrides),
    ...Object.keys(b.eventOverrides),
  ]);
  const eventsOff: string[] = [];
  const eventsKept: string[] = [];
  const eventsRepriced: string[] = [];
  for (const id of [...eventKeys].sort()) {
    const mine = a.eventOverrides[id];
    const theirs = b.eventOverrides[id];
    if (mine === theirs) continue;
    if (isOff(mine)) eventsOff.push(id);
    else if (isOff(theirs)) eventsKept.push(id);
    // A number on either side that the other does not match is a re-price —
    // including back to the researched figure, which is a decision too.
    else if (typeof mine === "number" || typeof theirs === "number") {
      eventsRepriced.push(id);
    }
  }

  const diff: Omit<ScenarioDiff, "identical"> = {
    eur: subject.totalEur - reference.totalEur,
    days: subject.dayCount - reference.dayCount,
    adventuresAdded: missingFrom(a.toggled, b.toggled),
    adventuresRemoved: missingFrom(b.toggled, a.toggled),
    datesMoved: a.startDate !== b.startDate || a.endDate !== b.endDate,
    eventsOff,
    eventsKept,
    eventsRepriced,
    lodgingChanged: changedKeys(a.lodgingTiers, b.lodgingTiers),
    placementsChanged: changedKeys(a.placementOverrides, b.placementOverrides),
    legModesChanged: changedKeys(a.legModeOverrides, b.legModeOverrides),
    carsChanged: changedKeys(a.carOverrides, b.carOverrides),
    fxStressChanged: a.fxStress !== b.fxStress,
    contingencyChanged: a.contingency !== b.contingency,
  };

  return { ...diff, identical: nothingDiffers(diff) };
}

function nothingDiffers(diff: Omit<ScenarioDiff, "identical">): boolean {
  return (
    !diff.datesMoved &&
    !diff.fxStressChanged &&
    !diff.contingencyChanged &&
    diff.adventuresAdded.length === 0 &&
    diff.adventuresRemoved.length === 0 &&
    diff.eventsOff.length === 0 &&
    diff.eventsKept.length === 0 &&
    diff.eventsRepriced.length === 0 &&
    diff.lodgingChanged.length === 0 &&
    diff.placementsChanged.length === 0 &&
    diff.legModesChanged.length === 0 &&
    diff.carsChanged.length === 0
  );
}

/**
 * How many separate decisions the diff holds, money and days excluded.
 *
 * The headline chips show ±€, ±days and ±Adventures; this is what the row's
 * "and N other changes" line counts, so a Scenario that is cheaper *only*
 * because it sleeps in a tent still says so on the surface.
 */
export function diffChangeCount(diff: ScenarioDiff): number {
  return (
    diff.adventuresAdded.length +
    diff.adventuresRemoved.length +
    diff.eventsOff.length +
    diff.eventsKept.length +
    diff.eventsRepriced.length +
    diff.lodgingChanged.length +
    diff.placementsChanged.length +
    diff.legModesChanged.length +
    diff.carsChanged.length +
    (diff.datesMoved ? 1 : 0) +
    (diff.fxStressChanged ? 1 : 0) +
    (diff.contingencyChanged ? 1 : 0)
  );
}

/* ------------------------------------------------------------------ */
/* Signed figures                                                      */
/* ------------------------------------------------------------------ */

/**
 * A true minus sign, not a hyphen.
 *
 * `-` is a hyphen that happens to be on the keyboard: it sits at cap-height
 * next to a digit and reads as a dash. U+2212 is drawn on the same axis and at
 * the same weight as the `+` it alternates with, which is what makes a column
 * of signed figures scan as a column. The site's numerals are tabular, so the
 * glyphs line up too.
 */
const MINUS = "−";

/** "+€1,240", "−€3,237", "€0". */
export function formatSignedEur(delta: number): string {
  const rounded = Math.round(delta);
  const figure = `€${Math.abs(rounded).toLocaleString("en-GB")}`;
  if (rounded === 0) return figure;
  return rounded > 0 ? `+${figure}` : `${MINUS}${figure}`;
}

/** "+3", "−14", "0" — the sign a bare count needs to be read as a change. */
export function formatSigned(delta: number): string {
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `${MINUS}${Math.abs(delta)}`;
}
