/**
 * Optimistic concurrency on the canonical Plan — kilbot/holidays#90, finding 2.
 *
 * The loss this file exists to prevent, in order:
 *
 * 1. The couple edits something. `remote-store.ts` starts an 800ms debounce.
 * 2. Before it fires, one of them adopts a Fork. The **server** appends a
 *    Scenario the tab has never seen and answers the adopt.
 * 3. The debounce fires and `PUT`s the whole document — the one from step 1,
 *    with no adopted Scenario in it. Last write wins, and the adopted Fork is
 *    gone, silently, from a document the pushing tab never read.
 *
 * Two halves are tested here because the fix has two. The store half —
 * `writePlanIfCurrent` — refuses a write from a stale version and hands back
 * what is actually there. The browser half — `remoteScenarioStore` — sends the
 * version it is editing from, and on a refusal merges the server's document
 * into its own and tries again, so the traveller's edit *and* the adopted
 * Scenario both survive.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { EMPTY_INPUT } from "@/lib/engine/plan";
import {
  DEFAULT_SCENARIO,
  INITIAL_STATE,
  mergeScenarioState,
  toPlanDoc,
  type PlanDoc,
  type Scenario,
  type ScenarioState,
} from "@/lib/engine/scenario-doc";
import type { ScenarioStore } from "@/lib/engine/scenarios";
import { fakeKv } from "@/lib/store/__tests__/fake-kv";
import {
  EDIT_KEY_HEADER,
  PLAN_VERSION_HEADER,
  basePlanVersion,
} from "@/lib/store/guards";
import {
  createPlan,
  readPlan,
  writePlan,
  writePlanIfCurrent,
} from "@/lib/store/plans";
import {
  SAVE_DEBOUNCE_MS,
  remoteScenarioStore,
} from "@/lib/store/remote-store";

const PLAN_ID = "TESTPLAN00000000";
const EDIT_KEY = "an-edit-key-nobody-real-holds";
const AFTER_DEBOUNCE = SAVE_DEBOUNCE_MS + 150;

const scenario = (id: string): Scenario => ({
  id,
  name: id,
  createdAt: "2026-09-01T00:00:00.000Z",
  input: EMPTY_INPUT,
});

const state = (...ids: string[]): ScenarioState => ({
  scenarios: ids.map(scenario),
  currentId: ids[0],
  pins: [],
});

/* ------------------------------------------------------------------ */
/* The store: a version, and a write that checks it                    */
/* ------------------------------------------------------------------ */

test("a Plan document written before versions existed reads as version 0", () => {
  // Repair, never reject. The couple's live itinerary predates the field, and
  // refusing to load it — or treating a missing version as "unknown, refuse
  // every write" — would be the check causing the outage it exists to prevent.
  const doc = toPlanDoc({
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
    updatedAt: "2026-08-01T00:00:00.000Z",
  });
  assert.equal(doc.version, 0);

  for (const junk of [-1, 1.5, "3", null, Number.NaN]) {
    assert.equal(toPlanDoc({ version: junk }).version, 0, String(junk));
  }
  assert.equal(toPlanDoc({ version: 7 }).version, 7);
});

test("every accepted write moves the version on by one", async () => {
  const kv = fakeKv();
  const created = await createPlan(kv, INITIAL_STATE);
  assert.ok(created);
  assert.equal((await readPlan(kv, created.planId))?.version, 0);

  await writePlan(kv, created.planId, state("a"));
  assert.equal((await readPlan(kv, created.planId))?.version, 1);

  const second = await writePlanIfCurrent(kv, created.planId, state("b"), 1);
  assert.equal(second.ok, true);
  assert.equal((await readPlan(kv, created.planId))?.version, 2);
});

test("a write from a stale version is refused, and says what is there now", async () => {
  const kv = fakeKv();
  const created = await createPlan(kv, INITIAL_STATE);
  assert.ok(created);

  // Two tabs read version 0. One of them writes.
  const winner = await writePlanIfCurrent(kv, created.planId, state("adopted"), 0);
  assert.equal(winner.ok, true);

  // The other pushes the document it was holding, which knows nothing about
  // the write above. This is the adopt race, reduced to two calls.
  const loser = await writePlanIfCurrent(kv, created.planId, state("stale"), 0);
  assert.equal(loser.ok, false);
  if (loser.ok) return;

  assert.ok(loser.current, "the refusal carries the current document");
  assert.deepEqual(
    loser.current.scenarios.map((entry) => entry.id),
    ["adopted"],
    "and the winner's write is untouched",
  );
  assert.equal(loser.current.version, 1);
});

test("a refused write retried against the version it was handed lands", async () => {
  const kv = fakeKv();
  const created = await createPlan(kv, INITIAL_STATE);
  assert.ok(created);
  await writePlanIfCurrent(kv, created.planId, state("adopted"), 0);

  const refused = await writePlanIfCurrent(kv, created.planId, state("mine"), 0);
  assert.equal(refused.ok, false);
  if (refused.ok || !refused.current) return;

  // What the client does with the 409: fold the two together and push again.
  const merged = mergeScenarioState(state("mine"), refused.current);
  const retried = await writePlanIfCurrent(
    kv,
    created.planId,
    merged,
    refused.current.version,
  );
  assert.equal(retried.ok, true);
  if (!retried.ok) return;

  assert.deepEqual(
    retried.plan.scenarios.map((entry) => entry.id).sort(),
    ["adopted", "mine"],
    "the traveller's edit and the adopted Fork both survive",
  );
});

test("the merge keeps the server's new Scenarios and the tab's own edits", () => {
  const local: ScenarioState = {
    scenarios: [{ ...scenario("shared"), name: "renamed here" }],
    currentId: "shared",
    pins: [],
  };
  const server: ScenarioState = {
    scenarios: [scenario("shared"), scenario("adopted")],
    currentId: "adopted",
    pins: [],
  };

  const merged = mergeScenarioState(local, server);
  assert.deepEqual(
    merged.scenarios.map((entry) => entry.id),
    ["shared", "adopted"],
  );
  assert.equal(
    merged.scenarios[0].name,
    "renamed here",
    "the tab's edit is the newer intent for a Scenario both have",
  );
  assert.equal(merged.currentId, "shared", "and it keeps looking at its own");
});

test("a currentId that survives neither side falls back to something real", () => {
  const merged = mergeScenarioState(
    { scenarios: [], currentId: "gone", pins: [] },
    { scenarios: [scenario("adopted")], currentId: "adopted", pins: [] },
  );
  assert.equal(merged.currentId, "adopted");
});

test("no claimed version is an unconditional write, not a stale one", () => {
  // The bootstrap script and any browser running JavaScript from before #90.
  // Refusing them would break the seeding path to guard against a race they
  // cannot be in.
  const header = (value: string | null) =>
    basePlanVersion(
      new Request("https://example.test/", {
        headers: value === null ? {} : { [PLAN_VERSION_HEADER]: value },
      }),
    );

  assert.equal(header(null), null);
  assert.equal(header(""), null);
  assert.equal(header("nonsense"), null, "garbage is no claim, not claim zero");
  assert.equal(header("-1"), null);
  assert.equal(header("1.5"), null);
  assert.equal(header("0"), 0);
  assert.equal(header("12"), 12);
});

/* ------------------------------------------------------------------ */
/* The browser: push, be refused, merge, retry                         */
/* ------------------------------------------------------------------ */

interface FakeLocal extends ScenarioStore {
  current(): ScenarioState;
}

function fakeLocal(initial: ScenarioState): FakeLocal {
  let held = initial;
  const listeners = new Set<() => void>();
  return {
    kind: "local",
    current: () => held,
    read: () => held,
    write(next) {
      held = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

interface FakeServer {
  doc: PlanDoc;
  /** The base version each PUT claimed, in order. `null` for no claim. */
  claims: (number | null)[];
  conflicts: number;
  restore(): void;
}

/**
 * `/api/plan/<id>` with the version check in it, and nothing else.
 *
 * Deliberately a second fake rather than an extension of `preview.test.ts`'s:
 * that one is about who may write, this one is about what happens when two
 * writers do, and a fake that answers both questions answers neither clearly.
 */
function fakeServer(doc: ScenarioState & { version: number }): FakeServer {
  const original = globalThis.fetch;
  const server: FakeServer = {
    doc: { ...doc, updatedAt: "2026-08-27T00:00:00.000Z" },
    claims: [],
    conflicts: 0,
    restore: () => {
      globalThis.fetch = original;
    },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (method === "GET") return json({ plan: server.doc });
    if (headers[EDIT_KEY_HEADER] !== EDIT_KEY) {
      return json({ error: "forbidden" }, 403);
    }

    const claimed = headers[PLAN_VERSION_HEADER];
    server.claims.push(claimed === undefined ? null : Number(claimed));

    if (claimed !== undefined && Number(claimed) !== server.doc.version) {
      server.conflicts += 1;
      return json({ plan: server.doc, error: "stale" }, 409);
    }

    const body = JSON.parse(String(init?.body)) as ScenarioState;
    server.doc = {
      ...body,
      updatedAt: "2026-08-27T12:00:00.000Z",
      version: server.doc.version + 1,
    };
    return json({ plan: server.doc });
  }) as typeof globalThis.fetch;

  return server;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("a push says which version it is editing from", async (t) => {
  const server = fakeServer({ ...state("mine"), version: 4 });
  t.after(() => server.restore());

  const local = fakeLocal(state("mine"));
  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => EDIT_KEY,
  });

  await delay(20); // the boot hydrate
  store.write(state("mine", "another"));
  await delay(AFTER_DEBOUNCE);

  assert.deepEqual(server.claims, [4], "the version the hydrate handed it");
  assert.equal(server.doc.version, 5);
});

test("an adopt that lands mid-debounce is not erased by the push", async (t) => {
  // The reported bug, end to end. The tab hydrates at version 1, the traveller
  // toggles something, and while the debounce is running the server accepts an
  // adopt — exactly as `app/api/plan/[planId]/adopt` would — taking the
  // document to version 2 with a Scenario this tab has never seen.
  const server = fakeServer({ ...state("mine"), version: 1 });
  t.after(() => server.restore());

  const local = fakeLocal(state("mine"));
  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => EDIT_KEY,
  });
  await delay(20);

  store.write({
    ...state("mine"),
    scenarios: [{ ...scenario("mine"), name: "edited while adopting" }],
  });

  server.doc = {
    ...server.doc,
    scenarios: [...server.doc.scenarios, scenario("adopted-fork")],
    version: 2,
    updatedAt: "2026-08-27T11:00:00.000Z",
  };

  await delay(AFTER_DEBOUNCE);

  assert.equal(server.conflicts, 1, "the stale push was refused");
  assert.deepEqual(server.claims, [1, 2], "and retried against what is there");

  assert.deepEqual(
    server.doc.scenarios.map((entry) => entry.id).sort(),
    ["adopted-fork", "mine"],
    "the adopted Fork survived the push that used to erase it",
  );
  assert.equal(
    server.doc.scenarios.find((entry) => entry.id === "mine")?.name,
    "edited while adopting",
    "and so did the edit that was in flight",
  );

  // The tab is showing the merge too, not waiting for a reload to find out.
  assert.deepEqual(
    local.current().scenarios.map((entry) => entry.id).sort(),
    ["adopted-fork", "mine"],
  );
});
