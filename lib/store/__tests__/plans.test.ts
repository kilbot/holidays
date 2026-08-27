/**
 * The document layer: create, fork, adopt.
 *
 * The rules being pinned here are the ADR's, not the store's — *"Forks can
 * never modify the canonical Plan; the couple can adopt (copy) a fork into
 * their Scenario list"* — plus the two invariants docs/CONTEXT.md states about
 * Scenarios: exactly one is current, and a Scenario is a saved `PlanInput`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EMPTY_INPUT } from "@/lib/engine/plan";
import {
  DEFAULT_SCENARIO,
  INITIAL_STATE,
  type ScenarioState,
} from "@/lib/engine/scenario-doc";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";
import {
  adoptFork,
  createFork,
  createPlan,
  readFork,
  readPlan,
  readPlanMeta,
  toPlanDoc,
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

test("a fork stores its input, its name and where it came from", async () => {
  const kv = fakeKv();
  const { forkId, fork } = await createFork(kv, {
    name: "  Doof NYE  ",
    planInput: { ...EMPTY_INPUT, toggled: ["byron-nimbin"] },
    authorNote: "hear me out",
    forkedFrom: "PLAN",
  });

  assert.equal(fork.name, "Doof NYE", "trimmed");
  assert.equal(fork.forkedFrom, "PLAN");
  const stored = await readFork(kv, forkId);
  assert.deepEqual(stored?.planInput.toggled, ["byron-nimbin"]);
  assert.equal(stored?.authorNote, "hear me out");
});

test("a fork never lands in the plan's key space", async () => {
  const kv = fakeKv();
  await createFork(kv, {
    name: "Doof NYE",
    planInput: EMPTY_INPUT,
    forkedFrom: "PLAN",
  });
  // ADR 0001's "Forks can never modify the canonical Plan", as a fact about
  // which keys this code path can address.
  assert.ok(kv.writes.every((key) => key.startsWith("fork:")));
});

test("an unnamed fork gets a name rather than an empty label", async () => {
  const kv = fakeKv();
  const { fork } = await createFork(kv, {
    name: "   ",
    planInput: EMPTY_INPUT,
    forkedFrom: "PLAN",
  });
  assert.equal(fork.name, "Untitled fork");
});

test("long names and notes are cut to length", async () => {
  const kv = fakeKv();
  const { fork } = await createFork(kv, {
    name: "x".repeat(500),
    planInput: EMPTY_INPUT,
    authorNote: "y".repeat(5000),
    forkedFrom: "PLAN",
  });
  assert.equal(fork.name.length, 60);
  assert.equal(fork.authorNote?.length, 280);
});

test("a missing fork reads as absent", async () => {
  assert.equal(await readFork(fakeKv(), "nope"), null);
});

/* ------------------------------------------------------------------ */
/* Adopt                                                               */
/* ------------------------------------------------------------------ */

const state = (): ScenarioState => ({
  scenarios: [DEFAULT_SCENARIO],
  currentId: DEFAULT_SCENARIO.id,
});

test("adopt appends the fork's input as a new Scenario", () => {
  const result = adoptFork(state(), "FORK1", forkDoc());
  assert.equal(result.state.scenarios.length, 2);
  const adopted = result.state.scenarios[1];
  assert.equal(adopted.name, "Doof NYE");
  assert.equal(adopted.adoptedFrom, "FORK1");
  assert.deepEqual(adopted.input.toggled, ["byron-nimbin"]);
  assert.equal(result.alreadyAdopted, false);
});

test("adopt does not swap the current Plan out from under the couple", () => {
  const result = adoptFork(state(), "FORK1", forkDoc());
  assert.equal(result.state.currentId, DEFAULT_SCENARIO.id);
});

test("adopt leaves the existing Scenarios untouched", () => {
  const before = state();
  const result = adoptFork(before, "FORK1", forkDoc());
  assert.deepEqual(result.state.scenarios[0], DEFAULT_SCENARIO);
  assert.equal(before.scenarios.length, 1, "the input state is not mutated");
});

test("adopting the same fork twice adopts it once", () => {
  const first = adoptFork(state(), "FORK1", forkDoc());
  const second = adoptFork(first.state, "FORK1", forkDoc({ name: "Renamed" }));
  assert.equal(second.state.scenarios.length, 2);
  assert.equal(second.alreadyAdopted, true);
  assert.equal(second.scenarioId, first.scenarioId);
  assert.equal(second.state, first.state, "no new document to write");
});

test("two different forks with the same name both land", () => {
  const first = adoptFork(state(), "FORK1", forkDoc());
  const second = adoptFork(first.state, "FORK2", forkDoc());
  assert.equal(second.state.scenarios.length, 3);
  assert.notEqual(second.scenarioId, first.scenarioId);
  assert.equal(second.state.scenarios[1].id, "doof-nye");
  assert.equal(second.state.scenarios[2].id, "doof-nye-2");
});

test("adopt takes the fork's input as it stood, and changes nothing about it", () => {
  const fork = forkDoc();
  const result = adoptFork(state(), "FORK1", fork);
  assert.deepEqual(result.state.scenarios[1].input, fork.planInput);
  // The Plan holds a copy of the input — never a reference to the Fork document,
  // which is what makes ADR 0001's "forks can never modify the canonical Plan"
  // survive the author editing their Fork afterwards.
  assert.deepEqual(fork, forkDoc(), "adopting did not touch the fork");
  assert.ok(
    !JSON.stringify(result.state.scenarios[1]).includes("forkedFrom"),
    "the Scenario carries a stamp, not the Fork document",
  );
});

test("an unnamed fork adopts under a usable name", () => {
  const result = adoptFork(state(), "FORK1", forkDoc({ name: "   " }));
  assert.equal(result.state.scenarios[1].name, "Adopted fork");
});
