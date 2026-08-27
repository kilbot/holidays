/**
 * What a write does in each mode — the #58 regression, at the seam where it
 * actually happened.
 *
 * `remoteScenarioStore` is the store that decides. The bug was that its
 * decision was invisible: with no edit key it skipped the push and returned,
 * leaving the sync status saying whatever it had said before, so a visitor's
 * rearranged trip was local-only and nothing on the page knew. These tests pin
 * both halves of the fixed contract:
 *
 * - **Edit mode**: the write lands locally *and* reaches the server.
 * - **View mode**: the write lands locally, reaches nothing, and the status
 *   says `"preview"` from the first attempt.
 *
 * The KV store is never involved — this is the browser half of the wire, and
 * the server is a `fetch` stub that behaves the way `app/api/plan/[planId]`
 * does: 403 without the right key, echo the stored doc with it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { EMPTY_INPUT } from "@/lib/engine/plan";
import {
  DEFAULT_SCENARIO,
  type PlanDoc,
  type ScenarioState,
} from "@/lib/engine/scenario-doc";
import type { ScenarioStore } from "@/lib/engine/scenarios";
import { EDIT_KEY_HEADER } from "@/lib/store/guards";
import {
  SAVE_DEBOUNCE_MS,
  discardPreview,
  readSyncStatus,
  remoteScenarioStore,
} from "@/lib/store/remote-store";

const PLAN_ID = "TESTPLAN00000000";
const EDIT_KEY = "an-edit-key-nobody-real-holds";

/** Long enough for the debounced push to have fired, or definitely not to. */
const AFTER_DEBOUNCE = SAVE_DEBOUNCE_MS + 150;

/* ------------------------------------------------------------------ */
/* Doubles                                                             */
/* ------------------------------------------------------------------ */

/** The reference trip, minus one Adventure — a toggle, as a whole state. */
function withoutTasmania(): ScenarioState {
  return {
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
    scenarios: [
      {
        ...DEFAULT_SCENARIO,
        input: {
          ...DEFAULT_SCENARIO.input,
          toggled: DEFAULT_SCENARIO.input.toggled.filter(
            (id) => id !== "tasmania-arc",
          ),
        },
      },
    ],
  };
}

interface FakeLocal extends ScenarioStore {
  /** What the tab is holding right now. */
  current(): ScenarioState;
}

/**
 * The localStorage store, as a variable.
 *
 * `remoteScenarioStore` wraps a `ScenarioStore` and never looks inside it, so a
 * plain object is a complete stand-in — and it keeps `window` out of a test
 * that is about the network.
 */
function fakeLocal(initial: ScenarioState): FakeLocal {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    kind: "local",
    current: () => state,
    read: () => state,
    write(next) {
      state = next;
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
  /** The canonical Plan document, as the store would find it. */
  doc: PlanDoc;
  /** Every request the store made, in order. */
  calls: { method: string; url: string; editKey: string | null }[];
  restore(): void;
}

/** `/api/plan/<id>`, in about twenty lines, with ADR 0001's one rule. */
function fakeServer(doc: PlanDoc): FakeServer {
  const original = globalThis.fetch;
  const server: FakeServer = {
    doc,
    calls: [],
    restore: () => {
      globalThis.fetch = original;
    },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const editKey = headers[EDIT_KEY_HEADER] ?? null;
    server.calls.push({ method, url, editKey });

    if (method === "GET") {
      return json({ plan: server.doc });
    }

    // The whole of the ADR's access control: holding the key is the permission.
    if (editKey !== EDIT_KEY) return json({ error: "forbidden" }, 403);

    const body = JSON.parse(String(init?.body)) as ScenarioState;
    server.doc = { ...body, updatedAt: "2026-08-27T12:00:00.000Z" };
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

const writes = (server: FakeServer) =>
  server.calls.filter((call) => call.method === "PUT");

/* ------------------------------------------------------------------ */
/* Edit mode                                                           */
/* ------------------------------------------------------------------ */

test("edit mode: a toggle changes this tab and reaches the server", async () => {
  const server = fakeServer({
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
    updatedAt: "2026-08-27T00:00:00.000Z",
  });
  const local = fakeLocal({
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
  });

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => EDIT_KEY,
  });
  await delay(10); // the boot hydrate

  store.write(withoutTasmania());

  // Immediately: the tab holds the new Plan, with nothing awaited. Everything
  // downstream — the rollup, the strip — recomputes off this.
  assert.ok(
    !local.current().scenarios[0].input.toggled.includes("tasmania-arc"),
    "the toggle should be in effect locally before any request",
  );

  await delay(AFTER_DEBOUNCE);

  const put = writes(server);
  assert.equal(put.length, 1, "exactly one debounced save");
  assert.equal(put[0].editKey, EDIT_KEY, "the save carries the edit key");
  assert.ok(
    !server.doc.scenarios[0].input.toggled.includes("tasmania-arc"),
    "the canonical Plan should have taken the toggle",
  );
  assert.equal(readSyncStatus().status, "synced");

  server.restore();
});

test("edit mode: a burst of knob-twiddling is one save", async () => {
  const server = fakeServer({
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
    updatedAt: "2026-08-27T00:00:00.000Z",
  });
  const local = fakeLocal({
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
  });

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => EDIT_KEY,
  });
  await delay(10);

  for (let i = 0; i < 5; i += 1) store.write(withoutTasmania());
  await delay(AFTER_DEBOUNCE);

  assert.equal(writes(server).length, 1);
  server.restore();
});

/* ------------------------------------------------------------------ */
/* View mode                                                           */
/* ------------------------------------------------------------------ */

test("view mode: a toggle previews, says so, and never touches the server", async () => {
  const pristine: ScenarioState = {
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
  };
  const server = fakeServer({ ...pristine, updatedAt: "2026-08-27T00:00:00.000Z" });
  const local = fakeLocal(pristine);

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    // A visitor: no edit key, ever.
    getEditKey: () => null,
  });
  await delay(10);

  store.write(withoutTasmania());

  // The preview is real and immediate — option (a) in #58, and the reason a
  // disabled UI was rejected.
  assert.ok(
    !local.current().scenarios[0].input.toggled.includes("tasmania-arc"),
    "the visitor's toggle should take effect in their browser",
  );
  // …and it is announced on the same tick, not after a failed round trip.
  assert.equal(
    readSyncStatus().status,
    "preview",
    "the first unsaveable write must raise the preview status",
  );

  await delay(AFTER_DEBOUNCE);

  assert.equal(writes(server).length, 0, "no write may be attempted at all");
  assert.deepEqual(
    server.doc.scenarios[0].input.toggled,
    DEFAULT_SCENARIO.input.toggled,
    "the canonical Plan must be exactly as it was",
  );
  assert.equal(readSyncStatus().status, "preview", "and it stays said");

  server.restore();
});

test("view mode: discarding the preview puts the couple's Plan back", async () => {
  const pristine: ScenarioState = {
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
  };
  const server = fakeServer({ ...pristine, updatedAt: "2026-08-27T00:00:00.000Z" });
  const local = fakeLocal(pristine);

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => null,
  });
  await delay(10);

  store.write(withoutTasmania());
  assert.equal(readSyncStatus().status, "preview");

  await discardPreview();

  assert.deepEqual(
    local.current().scenarios[0].input.toggled,
    DEFAULT_SCENARIO.input.toggled,
    "the tab should be holding the shared Plan again",
  );
  assert.equal(readSyncStatus().status, "synced");
  assert.equal(writes(server).length, 0);

  server.restore();
});

test("view mode: a discard that cannot reach the store leaves the preview standing", async () => {
  const pristine: ScenarioState = {
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
  };
  const server = fakeServer({ ...pristine, updatedAt: "2026-08-27T00:00:00.000Z" });
  const local = fakeLocal(pristine);

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => null,
  });
  await delay(10);
  store.write(withoutTasmania());

  // The tunnel, the flaky café wifi, the deployment-protection redirect.
  const reachable = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("no network");
  }) as typeof globalThis.fetch;

  const restored = await discardPreview();
  globalThis.fetch = reachable;

  assert.equal(restored, false, "the caller has to be told it did not happen");
  assert.ok(
    !local.current().scenarios[0].input.toggled.includes("tasmania-arc"),
    "nothing was restored, so the preview is still what the tab holds",
  );
  assert.equal(
    readSyncStatus().status,
    "preview",
    "and the warning must not be cleared by a failed restore",
  );

  server.restore();
});

test("view mode: a Fork carries the previewed input, not the shared one", async () => {
  // Not a store test so much as the promise the notice makes. `saveFork` is
  // handed `usePlan().input`, which reads through this store — so whatever the
  // preview did is what a Fork saves.
  const local = fakeLocal({
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
  });
  const server = fakeServer({
    scenarios: [DEFAULT_SCENARIO],
    currentId: DEFAULT_SCENARIO.id,
    pins: [],
    updatedAt: "2026-08-27T00:00:00.000Z",
  });

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => null,
  });
  await delay(10);
  store.write(withoutTasmania());

  const forked = store.read().scenarios[0].input;
  assert.ok(!forked.toggled.includes("tasmania-arc"));
  assert.notDeepEqual(forked, EMPTY_INPUT);

  server.restore();
});
