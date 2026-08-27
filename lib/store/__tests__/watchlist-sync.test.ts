/**
 * The watchlist as a shared document: what a pin does in each mode, and what
 * survives a trip through storage.
 *
 * kilbot/holidays#68 puts pins in the Plan rather than in a browser, for a
 * reason that only shows up in a test like this one: the trip has two
 * travellers and two phones, and a fare pinned on one has to be there on the
 * other. That makes a pin an ordinary Plan edit, which means it inherits the
 * two rules #58 and #62 settled for every other edit —
 *
 * - **Edit mode**: the write lands locally *and* reaches the canonical Plan.
 * - **View mode**: the write lands locally, reaches nothing, and the status
 *   says `"preview"` from the first attempt, so `PreviewNotice` can offer the
 *   visitor a fork of their own.
 *
 * — and it is worth pinning both down at the seam rather than assuming they
 * came for free, because the whole point of storing pins in the Plan document
 * was to get them.
 *
 * The KV store is never involved: this is the browser half of the wire, and the
 * server is a `fetch` stub that behaves the way `app/api/plan/[planId]` does.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  DEFAULT_SCENARIO,
  parseScenarioState,
  toPlanDoc,
  type PlanDoc,
  type ScenarioState,
} from "@/lib/engine/scenario-doc";
import type { ScenarioStore } from "@/lib/engine/scenarios";
import { addPin, pinOf, type FlightPin } from "@/lib/flights/watchlist";
import { EDIT_KEY_HEADER } from "@/lib/store/guards";
import {
  SAVE_DEBOUNCE_MS,
  readSyncStatus,
  remoteScenarioStore,
} from "@/lib/store/remote-store";

const PLAN_ID = "TESTPLAN00000000";
const EDIT_KEY = "an-edit-key-nobody-real-holds";
const AFTER_DEBOUNCE = SAVE_DEBOUNCE_MS + 150;

const PIN: FlightPin = pinOf({
  leg: "outbound",
  optionId: "bcn-sq-sin",
  from: "BCN",
  to: "PER",
  date: "2026-12-12",
  carrier: "Singapore Airlines",
  fareEurPP: 1_240,
  fareSource: "history",
  totalEurCouple: 2_760,
  comfort: 8.4,
  pinnedAt: "2026-08-27T12:00:00.000Z",
});

const empty = (): ScenarioState => ({
  scenarios: [DEFAULT_SCENARIO],
  currentId: DEFAULT_SCENARIO.id,
  pins: [],
});

/** What `useWatchlist().pin` does, minus React. */
const withPin = (state: ScenarioState): ScenarioState => ({
  ...state,
  pins: addPin(state.pins, PIN).pins,
});

/* ------------------------------------------------------------------ */
/* Doubles — the same pair `preview.test.ts` uses                      */
/* ------------------------------------------------------------------ */

interface FakeLocal extends ScenarioStore {
  current(): ScenarioState;
}

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
  doc: PlanDoc;
  calls: { method: string; url: string; editKey: string | null }[];
  restore(): void;
}

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

    if (method === "GET") return json({ plan: server.doc });
    if (editKey !== EDIT_KEY) return json({ error: "forbidden" }, 403);

    // The route parses the body exactly as the browser parses its own storage,
    // so a pin only reaches the Plan if the shared parser lets it.
    const state = parseScenarioState(JSON.parse(String(init?.body)));
    server.doc = { ...state, updatedAt: "2026-08-27T12:00:00.000Z" };
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
/* Storage                                                             */
/* ------------------------------------------------------------------ */

test("a Plan document from before the watchlist parses to an empty one", () => {
  // The whole reason `pins` is repaired rather than required on the wire: the
  // couple's live Plan predates this feature by three deploys.
  const older = { scenarios: [DEFAULT_SCENARIO], currentId: DEFAULT_SCENARIO.id };
  assert.deepEqual(parseScenarioState(older).pins, []);
  assert.deepEqual(toPlanDoc(older).pins, []);
});

test("pins round-trip through the document, and junk in the field does not", () => {
  const stored = JSON.parse(JSON.stringify(withPin(empty()))) as unknown;
  assert.deepEqual(parseScenarioState(stored).pins, [PIN]);

  const vandalised = { ...empty(), pins: "not a watchlist" };
  assert.deepEqual(parseScenarioState(vandalised).pins, []);
});

test("a document whose Scenarios are unreadable still hands back the pins", () => {
  // The two halves fail independently. Losing the watchlist because a Scenario
  // was corrupt would be a second casualty of the first accident.
  const broken = { scenarios: "gone", currentId: 7, pins: [PIN] };
  const state = parseScenarioState(broken);
  assert.deepEqual(state.pins, [PIN]);
  assert.ok(state.scenarios.length > 0, "and it falls back to the reference trip");
});

/* ------------------------------------------------------------------ */
/* Edit mode                                                           */
/* ------------------------------------------------------------------ */

test("edit mode: a pin shows on this device and reaches the shared Plan", async () => {
  const server = fakeServer({ ...empty(), updatedAt: "2026-08-27T00:00:00.000Z" });
  const local = fakeLocal(empty());

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => EDIT_KEY,
  });
  await delay(10); // the boot hydrate

  store.write(withPin(local.current()));

  assert.deepEqual(local.current().pins, [PIN], "immediately, with nothing awaited");

  await delay(AFTER_DEBOUNCE);

  assert.equal(writes(server).length, 1, "exactly one debounced save");
  assert.deepEqual(server.doc.pins, [PIN], "and it is on the couple's Plan");

  server.restore();
});

test("edit mode: the other traveller's phone gets the pin on hydrate", async () => {
  // The reason pins are in this document at all. This tab has never seen the
  // pin; the canonical Plan has.
  const server = fakeServer({ ...withPin(empty()), updatedAt: "2026-08-27T12:00:00.000Z" });
  const local = fakeLocal(empty());

  remoteScenarioStore(local, { planId: PLAN_ID, getEditKey: () => EDIT_KEY });
  await delay(10);

  assert.deepEqual(local.current().pins, [PIN]);
  server.restore();
});

test("edit mode: forking a Scenario carries the watchlist across", async () => {
  // A Scenario is a calendar and the watchlist is not on it. The write paths
  // that build a state by hand are where this quietly goes wrong.
  const server = fakeServer({ ...withPin(empty()), updatedAt: "2026-08-27T12:00:00.000Z" });
  const local = fakeLocal(empty());

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    getEditKey: () => EDIT_KEY,
  });
  await delay(10);

  const now = local.current();
  store.write({
    ...now,
    scenarios: [...now.scenarios, { ...DEFAULT_SCENARIO, id: "doof-nye", name: "Doof NYE" }],
    currentId: "doof-nye",
  });
  await delay(AFTER_DEBOUNCE);

  assert.deepEqual(server.doc.pins, [PIN]);
  server.restore();
});

/* ------------------------------------------------------------------ */
/* View mode                                                           */
/* ------------------------------------------------------------------ */

test("view mode: a pin previews, says so, and never touches the shared Plan", async () => {
  const pristine = empty();
  const server = fakeServer({ ...pristine, updatedAt: "2026-08-27T00:00:00.000Z" });
  const local = fakeLocal(pristine);

  const store = remoteScenarioStore(local, {
    planId: PLAN_ID,
    // A visitor on the view link: no edit key, ever.
    getEditKey: () => null,
  });
  await delay(10);

  store.write(withPin(local.current()));

  // The preview is real and immediate — the visitor's watchlist works, it is
  // simply theirs alone until they save a version of their own.
  assert.deepEqual(local.current().pins, [PIN]);
  assert.equal(readSyncStatus().status, "preview");

  await delay(AFTER_DEBOUNCE);

  assert.equal(writes(server).length, 0, "nothing was pushed");
  assert.deepEqual(server.doc.pins, [], "and the couple's watchlist is untouched");
  assert.equal(readSyncStatus().status, "preview", "and it stays said");

  server.restore();
});
