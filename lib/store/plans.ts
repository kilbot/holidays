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
  parseInput,
  toPlanDoc,
  type PlanDoc,
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
  /**
   * When the couple adopted this Fork, if they have.
   *
   * It is what takes the expiry off. An unadopted Fork is a draft somebody left
   * behind and it lives 90 days from its last visit; an adopted one is part of
   * the itinerary's history — the Scenario in the Plan says "adopted from this"
   * and a dead link there would be the site forgetting where its own trip came
   * from — so it lives until something deletes it.
   */
  adoptedAt?: string;
}

// Both live in `lib/engine/scenario-doc.ts` — the shape of a stored Plan is
// shared with the browser, and only this side may see a Redis client.
export { toPlanDoc, type PlanDoc };

const planKey = (planId: string) => `plan:${planId}`;
const planMetaKey = (planId: string) => `plan:${planId}:meta`;
const forkKey = (forkId: string) => `fork:${forkId}`;

/** Longest a Scenario name may be. Long enough to be descriptive, short enough to sit in the HUD. */
export const MAX_FORK_NAME_LENGTH = 60;

/**
 * How long an unadopted Fork lives after its last visit.
 *
 * Anyone may write a Fork and nothing ever deletes one, so the key space only
 * grows — a bounded leak for an audience of two, and an unbounded one for
 * anybody who notices (kilbot/holidays#90). Ninety days is longer than this
 * trip's whole planning window, and the clock restarts every time somebody
 * opens the link: a Fork a friend keeps coming back to is not abandoned, and a
 * Fork nobody has looked at since March is.
 *
 * An adopted Fork has no expiry at all — see `ForkDoc.adoptedAt`.
 */
export const FORK_TTL_SECONDS = 90 * 24 * 60 * 60;

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

/**
 * Replace the Plan, whatever is there. Bumps the version.
 *
 * The unconditional write, for callers with no base version to claim: the
 * seeding script, and a client old enough not to send one. Everything with a
 * document in its hands should be using `writePlanIfCurrent` instead.
 */
export async function writePlan(
  kv: KvClient,
  planId: string,
  state: ScenarioState,
  now: Date = new Date(),
): Promise<PlanDoc> {
  const current = await readPlan(kv, planId);
  return write(kv, planId, state, (current?.version ?? 0) + 1, now);
}

/**
 * Replace the Plan **only if** it is still at the version the caller last saw.
 *
 * Optimistic concurrency, and the reason it exists is one specific data loss:
 * `remote-store.ts` pushes the whole document on a debounce, so a push that was
 * already in flight when the couple adopted a Fork would land afterwards and
 * silently erase the adopted Scenario — a document it had never seen. `PUT`
 * carries the version it is editing from; a write against a stale one is
 * refused and the client refetches, merges and retries (kilbot/holidays#90).
 *
 * **The check is read-then-write, not a compare-and-set.** `KvClient` has no
 * CAS verb and adding one would mean a Lua script on the Upstash REST client
 * for an audience of two. What this closes is the window that actually bites —
 * the seconds-wide one between a debounce firing and the request landing.
 * What it leaves open is the microseconds between this read and this write,
 * which needs two writers to arrive inside the same request round trip.
 */
export async function writePlanIfCurrent(
  kv: KvClient,
  planId: string,
  state: ScenarioState,
  baseVersion: number,
  now: Date = new Date(),
): Promise<
  { ok: true; plan: PlanDoc } | { ok: false; current: PlanDoc | null }
> {
  const current = await readPlan(kv, planId);
  if (!current) return { ok: false, current: null };
  if (current.version !== baseVersion) return { ok: false, current };
  return {
    ok: true,
    plan: await write(kv, planId, state, current.version + 1, now),
  };
}

async function write(
  kv: KvClient,
  planId: string,
  state: ScenarioState,
  version: number,
  now: Date,
): Promise<PlanDoc> {
  const doc: PlanDoc = { ...state, updatedAt: now.toISOString(), version };
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
  // Version 0: nothing has written this document under the versioning rules
  // yet, so the first conditional write against it is the first that counts.
  const doc: PlanDoc = { ...seed, updatedAt: now.toISOString(), version: 0 };

  const claimed = await kv.setJsonIfAbsent(planKey(planId), doc);
  if (!claimed) return null;
  await kv.setJson(planMetaKey(planId), { editKey } satisfies PlanMeta);
  return { planId, editKey };
}

/* ------------------------------------------------------------------ */
/* Forks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Read a Fork — and, if nobody has adopted it, push its expiry back out.
 *
 * "Touched on read" is what makes the 90-day lifetime a measure of *neglect*
 * rather than of age. A Fork a friend keeps opening is alive; the countdown
 * only runs on ones nobody visits. An adopted Fork has no expiry to push, and
 * giving it one here would quietly re-arm the thing the adopt disarmed.
 */
export async function readFork(
  kv: KvClient,
  forkId: string,
): Promise<ForkDoc | null> {
  const raw = await kv.getJson<unknown>(forkKey(forkId));
  if (!isRecord(raw)) return null;
  const fork: ForkDoc = {
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
    ...(typeof raw.adoptedAt === "string" ? { adoptedAt: raw.adoptedAt } : {}),
  };

  if (!fork.adoptedAt) await kv.setTtl(forkKey(forkId), FORK_TTL_SECONDS);
  return fork;
}

/* ------------------------------------------------------------------ */
/* No new Scenarios over the wire                                      */
/* ------------------------------------------------------------------ */

/**
 * The Plan write with any Scenario the stored document does not already hold
 * taken out.
 *
 * Scenarios are curated, not created on the site (2026-09-30): the next Plan
 * arrives as a seeded Scenario through `scripts/seed-scenarios.mjs`, which
 * writes the store directly. So the one route that writes a Plan may change a
 * Scenario, reorder the list or delete one, and may not add one — the site's
 * create buttons are gone, and this is what makes that structural rather than a
 * matter of which buttons happen to be drawn. Pure; the route does the I/O.
 */
export function withoutNewScenarios(
  incoming: ScenarioState,
  stored: Pick<ScenarioState, "scenarios" | "currentId">,
): ScenarioState {
  const known = new Set(stored.scenarios.map((scenario) => scenario.id));
  const scenarios = incoming.scenarios.filter((scenario) =>
    known.has(scenario.id),
  );
  if (scenarios.length === 0) {
    return { ...incoming, scenarios: stored.scenarios, currentId: stored.currentId };
  }
  const currentId = scenarios.some(
    (scenario) => scenario.id === incoming.currentId,
  )
    ? incoming.currentId
    : scenarios[0].id;
  return { ...incoming, scenarios, currentId };
}
