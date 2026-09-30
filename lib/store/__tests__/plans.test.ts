/**
 * The document layer: create a Plan, read a Fork, and what a Plan write may do.
 *
 * The rules being pinned here are the ADR's, not the store's — *"Forks can
 * never modify the canonical Plan"* — plus the two invariants docs/CONTEXT.md
 * states about Scenarios: exactly one is current, and a Scenario is a saved
 * `PlanInput`; and, since 2026-09-30, that a Plan write never adds one.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EMPTY_INPUT } from "@/lib/engine/plan";
import {
  ADELINE_SCENARIO,
  DEFAULT_SCENARIO,
  INITIAL_STATE,
  lastEditedAt,
  type ScenarioState,
} from "@/lib/engine/scenario-doc";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";
import {
  FORK_TTL_SECONDS,
  createPlan,
  readFork,
  readPlan,
  readPlanMeta,
  toPlanDoc,
  withoutNewScenarios,
  writePlan,
  type ForkDoc,
} from "@/lib/store/plans";

const forkDoc = (over: Partial<ForkDoc> = {}): ForkDoc => ({
  name: "Doof NYE",
  planInput: { ...EMPTY_INPUT, toggled: ["byron-nimbin"] },
  createdAt: "2026-09-01T00:00:00.000Z",
  forkedFrom: "PLAN",
  ...over,
});

/* ------------------------------------------------------------------ */
/* The canonical Plan                                                  */
/* ------------------------------------------------------------------ */

test("createPlan writes the document and keeps the key out of it", async () => {
  const kv = fakeKv();
  const created = await createPlan(kv, INITIAL_STATE);
  assert.ok(created);

  const plan = await readPlan(kv, created.planId);
  assert.ok(plan);
  assert.deepEqual(
    plan.scenarios.map((scenario) => scenario.id),
    INITIAL_STATE.scenarios.map((scenario) => scenario.id),
    "the whole seed lands, savings Scenarios included",
  );
  assert.equal(plan.currentId, DEFAULT_SCENARIO.id);

  // The whole reason the meta document is a separate key: the view route hands
  // back everything above, and none of it may be the edit key.
  assert.ok(!JSON.stringify(plan).includes(created.editKey));

  const meta = await readPlanMeta(kv, created.planId);
  assert.equal(meta?.editKey, created.editKey);
});

test("the plan id and the edit key are different secrets", async () => {
  const created = await createPlan(fakeKv(), INITIAL_STATE);
  assert.ok(created);
  assert.notEqual(created.planId, created.editKey);
});

test("createPlan refuses to overwrite an existing plan", async () => {
  const kv = fakeKv();
  const created = await createPlan(kv, INITIAL_STATE);
  assert.ok(created);

  // Re-running the bootstrap must never land on top of a live itinerary. The
  // ids are random, so this forces the collision the set-if-absent guards.
  const before = kv.map.get(`plan:${created.planId}`);
  kv.setJsonIfAbsent = async () => false;
  assert.equal(await createPlan(kv, INITIAL_STATE), null);
  assert.equal(kv.map.get(`plan:${created.planId}`), before);
});

test("a plan document from an older build is repaired, not rejected", () => {
  const plan = toPlanDoc({
    scenarios: [{ id: "old", name: "Old", input: { toggled: ["rottnest-island"] } }],
    currentId: "gone",
  });
  assert.equal(plan.scenarios.length, 1);
  assert.deepEqual(plan.scenarios[0].input.toggled, ["rottnest-island"]);
  // The missing knobs came back as defaults...
  assert.equal(plan.scenarios[0].input.contingency, true);
  // ...and currentId naming a Scenario that is not there fell back to one that is.
  assert.equal(plan.currentId, "old");
});

test("a corrupt plan document falls back to the reference trip", () => {
  assert.equal(toPlanDoc("not a plan").currentId, DEFAULT_SCENARIO.id);
  assert.equal(
    toPlanDoc(null).scenarios.length,
    INITIAL_STATE.scenarios.length,
  );
});

test("a Scenario's own last-edited stamp survives the wire", () => {
  const edited = "2026-11-02T09:15:00.000Z";
  const plan = toPlanDoc({
    scenarios: [
      { id: "worked-on", name: "Worked on", createdAt: "2026-08-27T00:00:00.000Z", updatedAt: edited, input: {} },
      { id: "untouched", name: "Untouched", createdAt: "2026-08-27T00:00:00.000Z", input: {} },
    ],
    currentId: "worked-on",
  });

  assert.equal(plan.scenarios[0].updatedAt, edited);
  assert.equal(lastEditedAt(plan.scenarios[0]), edited);
  // Never edited, so the honest answer is when it was made — not a fabricated
  // edit at the same instant.
  assert.equal(plan.scenarios[1].updatedAt, undefined);
  assert.equal(lastEditedAt(plan.scenarios[1]), "2026-08-27T00:00:00.000Z");
});

test("a nonsense last-edited stamp is dropped, not trusted", () => {
  const plan = toPlanDoc({
    scenarios: [{ id: "x", name: "X", updatedAt: 1_760_000_000_000, input: {} }],
    currentId: "x",
  });
  assert.equal(plan.scenarios[0].updatedAt, undefined);
});

test("writePlan stamps updatedAt", async () => {
  const kv = fakeKv();
  const when = new Date("2026-10-01T12:00:00.000Z");
  const doc = await writePlan(kv, "PLAN", INITIAL_STATE, when);
  assert.equal(doc.updatedAt, when.toISOString());
  assert.equal((await readPlan(kv, "PLAN"))?.updatedAt, when.toISOString());
});

/* ------------------------------------------------------------------ */
/* Forks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Forks are no longer made or adopted on the site (2026-09-30: Scenarios are
 * curated), but the ones already saved still open from their links, so reading
 * one — and its lifetime — is still pinned here.
 */
const storeFork = async (kv: ReturnType<typeof fakeKv>, over: Partial<ForkDoc> = {}) => {
  await kv.setJson("fork:FORK1", forkDoc(over));
  await kv.setTtl("fork:FORK1", 3 * 24 * 60 * 60);
  return "FORK1";
};

test("a stored fork reads back with its input, its name and its note", async () => {
  const kv = fakeKv();
  const forkId = await storeFork(kv, { authorNote: "hear me out" });
  const stored = await readFork(kv, forkId);
  assert.equal(stored?.name, "Doof NYE");
  assert.deepEqual(stored?.planInput.toggled, ["byron-nimbin"]);
  assert.equal(stored?.authorNote, "hear me out");
});

test("a missing fork reads as absent", async () => {
  assert.equal(await readFork(fakeKv(), "nope"), null);
});

test("reading a fork pushes its expiry back out", async () => {
  const kv = fakeKv();
  // Three days left, as a stand-in for 87 days of nobody looking.
  const forkId = await storeFork(kv);
  await readFork(kv, forkId);
  assert.equal(
    kv.ttls.get(`fork:${forkId}`),
    FORK_TTL_SECONDS,
    "a Fork somebody keeps opening is not abandoned",
  );
});

test("an adopted fork is never given an expiry by reading it", async () => {
  const kv = fakeKv();
  await kv.setJson("fork:FORK2", forkDoc({ adoptedAt: "2026-09-02T00:00:00.000Z" }));
  const read = await readFork(kv, "FORK2");
  assert.equal(read?.adoptedAt, "2026-09-02T00:00:00.000Z");
  assert.equal(
    kv.ttls.has("fork:FORK2"),
    false,
    "the Plan points at this permanently — a countdown would be a dead link",
  );
});

/* ------------------------------------------------------------------ */
/* No new Scenarios over the wire                                      */
/* ------------------------------------------------------------------ */

const stored = (): ScenarioState => ({
  scenarios: [DEFAULT_SCENARIO, ADELINE_SCENARIO],
  currentId: DEFAULT_SCENARIO.id,
  pins: [],
});

test("a Plan write cannot add a Scenario the store does not hold", () => {
  const incoming: ScenarioState = {
    ...stored(),
    scenarios: [
      ...stored().scenarios,
      { ...DEFAULT_SCENARIO, id: "new-scenario", name: "New scenario" },
    ],
    currentId: "new-scenario",
  };
  const kept = withoutNewScenarios(incoming, stored());
  assert.deepEqual(
    kept.scenarios.map((scenario) => scenario.id),
    [DEFAULT_SCENARIO.id, ADELINE_SCENARIO.id],
  );
  assert.equal(kept.currentId, DEFAULT_SCENARIO.id, "never current by the back door");
});

test("a Plan write may still edit, switch and delete the Scenarios it holds", () => {
  const renamed = { ...ADELINE_SCENARIO, name: "Renamed" };
  const incoming: ScenarioState = {
    scenarios: [renamed],
    currentId: renamed.id,
    pins: [],
  };
  const kept = withoutNewScenarios(incoming, stored());
  assert.deepEqual(kept.scenarios, [renamed]);
  assert.equal(kept.currentId, renamed.id);
});

test("a write holding only unknown Scenarios keeps the stored ones", () => {
  const incoming: ScenarioState = {
    scenarios: [{ ...DEFAULT_SCENARIO, id: "stranger" }],
    currentId: "stranger",
    pins: [],
  };
  const kept = withoutNewScenarios(incoming, stored());
  assert.deepEqual(kept.scenarios, stored().scenarios);
  assert.equal(kept.currentId, DEFAULT_SCENARIO.id);
});
