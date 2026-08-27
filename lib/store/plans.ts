/**
 * The three documents the sharing layer stores, and the four things it does
 * with them.
 *
 * `docs/adr/0001-link-as-permission-sharing.md` settles the shape: one
 * canonical Plan with a view link and an edit link, visitor Forks that carry
 * their own URL, and an adopt that copies a Fork into the couple's Scenario
 * list. Forks can never touch the Plan — which here is not a rule enforced by a
 * check but a fact about the key space: a Fork is written under `fork:<id>` and
 * nothing in the fork path can address `plan:<id>`.
 *
 * ## Keys
 *
 * - `plan:<planId>`      — the canonical Plan: Scenarios, which one is current,
 *                          when it last changed. The document a view link reads
 *                          and an edit link writes.
 * - `plan:<planId>:meta` — `{ editKey }`. Split from the document above for one
 *                          reason: the view route hands back the whole Plan
 *                          document, and a secret in that object is a secret one
 *                          careless `Response.json` away from the world.
 * - `fork:<forkId>`      — a visitor's saved `PlanInput`, with the name they gave
 *                          it and an optional note.
 *
 * ## Why the client is an argument
 *
 * Every function here takes a `KvClient`. That is what lets the tests exercise
 * the adopt rules against a `Map` with no network and no `@upstash/redis` in
 * the import graph — and it keeps this module honest about the fact that it is
 * logic, not infrastructure.
 */

import {
  isRecord,
  nextScenarioId,
  parseInput,
  toPlanDoc,
  type PlanDoc,
  type Scenario,
  type ScenarioState,
} from "@/lib/engine/scenario-doc";
import type { PlanInput } from "@/lib/engine/types";
import type { KvClient } from "@/lib/store/kv";
import { newId } from "@/lib/store/ids";

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

/** The half of the Plan that never leaves the server. */
export interface PlanMeta {
  editKey: string;
}

/**
 * A visitor's Fork. docs/CONTEXT.md: *"a visitor-created Scenario: named,
 * saved, with its own URL (the link IS the permission — no accounts)"*.
 *
 * It stores a `PlanInput` and not a Plan, for the same reason a Scenario does:
 * a Plan is a pure function of its input, so the input is the whole Fork and it
 * survives every later change to the pricing constants.
 */
export interface ForkDoc {
  name: string;
  planInput: PlanInput;
  /** What the visitor wanted to say about it. Free text, shown as written. */
  authorNote?: string;
  createdAt: string;
  /** The Plan this was forked from. Always the canonical one, today. */
  forkedFrom: string;
}

// Both live in `lib/engine/scenario-doc.ts` — the shape of a stored Plan is
// shared with the browser, and only this side may see a Redis client.
export { toPlanDoc, type PlanDoc };

const planKey = (planId: string) => `plan:${planId}`;
const planMetaKey = (planId: string) => `plan:${planId}:meta`;
const forkKey = (forkId: string) => `fork:${forkId}`;

/** Longest a Fork name may be. Long enough to be descriptive, short enough to sit in the HUD. */
export const MAX_FORK_NAME_LENGTH = 60;
/** Longest an author note may be. A sentence or two, not an essay. */
export const MAX_AUTHOR_NOTE_LENGTH = 280;

/* ------------------------------------------------------------------ */
/* Reading and writing the canonical Plan                              */
/* ------------------------------------------------------------------ */

export async function readPlan(
  kv: KvClient,
  planId: string,
): Promise<PlanDoc | null> {
  const raw = await kv.getJson<unknown>(planKey(planId));
  if (raw === null) return null;
  return toPlanDoc(raw);
}

export async function writePlan(
  kv: KvClient,
  planId: string,
  state: ScenarioState,
  now: Date = new Date(),
): Promise<PlanDoc> {
  const doc: PlanDoc = { ...state, updatedAt: now.toISOString() };
  await kv.setJson(planKey(planId), doc);
  return doc;
}

export async function readPlanMeta(
  kv: KvClient,
  planId: string,
): Promise<PlanMeta | null> {
  const raw = await kv.getJson<unknown>(planMetaKey(planId));
  if (!isRecord(raw) || typeof raw.editKey !== "string") return null;
  return { editKey: raw.editKey };
}

/**
 * Create THE canonical Plan, once.
 *
 * Returns null if the Plan already exists — the bootstrap must not be able to
 * overwrite a live itinerary by being run twice, and `setJsonIfAbsent` makes
 * that a property of the write rather than of the caller remembering to check.
 */
export async function createPlan(
  kv: KvClient,
  seed: ScenarioState,
  now: Date = new Date(),
): Promise<{ planId: string; editKey: string } | null> {
  const planId = newId();
  const editKey = newId();
  const doc: PlanDoc = { ...seed, updatedAt: now.toISOString() };

  const claimed = await kv.setJsonIfAbsent(planKey(planId), doc);
  if (!claimed) return null;
  await kv.setJson(planMetaKey(planId), { editKey } satisfies PlanMeta);
  return { planId, editKey };
}

/* ------------------------------------------------------------------ */
/* Forks                                                               */
/* ------------------------------------------------------------------ */

export async function readFork(
  kv: KvClient,
  forkId: string,
): Promise<ForkDoc | null> {
  const raw = await kv.getJson<unknown>(forkKey(forkId));
  if (!isRecord(raw)) return null;
  return {
    name: typeof raw.name === "string" ? raw.name : "Untitled fork",
    planInput: parseInput(raw.planInput),
    ...(typeof raw.authorNote === "string" && raw.authorNote.length > 0
      ? { authorNote: raw.authorNote }
      : {}),
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date(0).toISOString(),
    forkedFrom: typeof raw.forkedFrom === "string" ? raw.forkedFrom : "",
  };
}

/**
 * Save a Fork. Anyone may; that is the point.
 *
 * The id comes back exactly once, in this response — it is not derivable from
 * the name, it is not listed anywhere, and nothing enumerates the key space. A
 * visitor who loses the URL has lost the Fork, which is the honest cost of
 * having no accounts.
 */
export async function createFork(
  kv: KvClient,
  input: {
    name: string;
    planInput: PlanInput;
    authorNote?: string;
    forkedFrom: string;
  },
  now: Date = new Date(),
): Promise<{ forkId: string; fork: ForkDoc }> {
  const forkId = newId();
  const fork: ForkDoc = {
    name: trimTo(input.name, MAX_FORK_NAME_LENGTH) || "Untitled fork",
    planInput: input.planInput,
    ...(input.authorNote
      ? { authorNote: trimTo(input.authorNote, MAX_AUTHOR_NOTE_LENGTH) }
      : {}),
    createdAt: now.toISOString(),
    forkedFrom: input.forkedFrom,
  };
  await kv.setJson(forkKey(forkId), fork);
  return { forkId, fork };
}

function trimTo(value: string, limit: number): string {
  return value.trim().slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Adopt                                                               */
/* ------------------------------------------------------------------ */

/**
 * Copy a Fork into the Plan's Scenario list. Pure — the route does the I/O.
 *
 * Three decisions worth stating, because each is a thing the obvious
 * implementation gets wrong:
 *
 * 1. **The current Scenario does not change.** Adopting a friend's Fork should
 *    put it on the shelf next to the couple's own Scenarios, not swap the Plan
 *    out from under them. docs/CONTEXT.md's *"exactly one is marked as the
 *    current Plan"* still holds; it is simply still the one that was.
 * 2. **Adopting twice adopts once.** The `adoptedFrom` stamp makes this
 *    idempotent, so a double-clicked button, a retried request or a second
 *    person hitting Adopt on the same link all produce one Scenario.
 * 3. **It copies, it does not link.** The adopted Scenario holds its own copy of
 *    the `PlanInput`. The Fork's author can keep editing their Fork afterwards
 *    and nothing they do reaches the Plan — the ADR's *"Forks can never modify
 *    the canonical Plan"*, made structural.
 */
export function adoptFork(
  state: ScenarioState,
  forkId: string,
  fork: ForkDoc,
  now: Date = new Date(),
): { state: ScenarioState; scenarioId: string; alreadyAdopted: boolean } {
  const existing = state.scenarios.find(
    (scenario) => scenario.adoptedFrom === forkId,
  );
  if (existing) {
    return { state, scenarioId: existing.id, alreadyAdopted: true };
  }

  const id = nextScenarioId(fork.name, state.scenarios);
  const scenario: Scenario = {
    id,
    name: trimTo(fork.name, MAX_FORK_NAME_LENGTH) || "Adopted fork",
    createdAt: now.toISOString(),
    input: fork.planInput,
    adoptedFrom: forkId,
  };

  return {
    state: {
      scenarios: [...state.scenarios, scenario],
      currentId: state.currentId,
    },
    scenarioId: id,
    alreadyAdopted: false,
  };
}
