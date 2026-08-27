"use client";

/**
 * Scenarios — named alternate calendars, compared side by side.
 *
 * docs/CONTEXT.md: *"a full alternate calendar for a big fork (e.g. 'Fireworks
 * NYE' vs 'Doof NYE', 12-Feb vs 22-Feb departure): each Scenario has its own
 * Days, Legs, and total cost, compared side by side; exactly one is marked as
 * the current Plan."*
 *
 * A Scenario is not a copy of a Plan. It is a **saved `PlanInput`** — dates,
 * toggles, overrides, knobs — and its Days, Legs and total are what `buildPlan`
 * makes of it. That is the whole design: a Plan is a pure function of its
 * input, so storing the input stores the Scenario exactly, survives every
 * change to the pricing constants, and makes a side-by-side comparison two
 * calls to the same function.
 *
 * ## The boundary #30 used
 *
 * The seam is `ScenarioStore`: an interface with four methods and no knowledge
 * of where the bytes live. `localScenarioStore()` is the localStorage
 * implementation; `remoteScenarioStore()` (`lib/store/remote-store.ts`) wraps it
 * to sync the canonical Plan with the server. Nothing above this file knows
 * which it has, and `chooseScenarioStore()` is the one line that decides.
 *
 * ## Storage
 *
 * localStorage is still the floor, deliberately. There are no accounts, the
 * network is not guaranteed, and a traveller poking at the Plan on a phone in a
 * tunnel should keep their session — so the local store is where the state
 * *lives*, and the server is something the remote wrapper syncs it with. Every
 * access is wrapped: Safari private mode throws on read and a full quota throws
 * on write, and neither should cost the traveller their session.
 */

import { useCallback, useSyncExternalStore } from "react";

import { buildPlan } from "@/lib/engine/plan";
import {
  DEFAULT_SCENARIO,
  INITIAL_STATE,
  nextScenarioId,
  parseScenarioState,
  type Scenario,
  type ScenarioState,
} from "@/lib/engine/scenario-doc";
import type { CapsuleSpec, PlanInput } from "@/lib/engine/types";

const STORAGE_KEY = "southbound.scenarios.v1";

export { DEFAULT_SCENARIO };
export type { Scenario, ScenarioState };

/**
 * Where Scenarios live. The seam #30 filled to put them on a server: a Fork is
 * a Scenario with a URL, and a URL is a storage concern, not a domain one.
 */
export interface ScenarioStore {
  read(): ScenarioState;
  write(state: ScenarioState): void;
  subscribe(listener: () => void): () => void;
  /** Server stores will want this async; the local one resolves immediately. */
  readonly kind: "local" | "remote";
}

/* ------------------------------------------------------------------ */
/* The localStorage store                                              */
/* ------------------------------------------------------------------ */

let cachedRaw: string | null = null;
let cachedState: ScenarioState = INITIAL_STATE;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Bytes to a value `parseScenarioState` can repair. Corrupt reads as absent. */
function readJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function onStorageEvent(event: StorageEvent) {
  if (event.key === null || event.key === STORAGE_KEY) {
    for (const listener of listeners) listener();
  }
}

export function localScenarioStore(): ScenarioStore {
  return {
    kind: "local",
    read() {
      // useSyncExternalStore compares by reference, so the parsed state is
      // cached against the raw string and only rebuilt when that changes —
      // including when another tab writes it.
      const raw = readRaw();
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedState = parseScenarioState(readJson(raw));
      }
      return cachedState;
    },
    write(state) {
      const raw = JSON.stringify(state);
      // Cache first: with storage unavailable the tab still gets its edit.
      cachedRaw = raw;
      cachedState = state;
      try {
        window.localStorage.setItem(STORAGE_KEY, raw);
      } catch {
        cachedRaw = null;
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      if (listeners.size === 0) {
        window.addEventListener("storage", onStorageEvent);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.removeEventListener("storage", onStorageEvent);
        }
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Which store this tab got                                            */
/* ------------------------------------------------------------------ */

/**
 * The store this tab reads through — local until the sharing layer says
 * otherwise.
 *
 * Local is the default and not a placeholder: the engine knows nothing about a
 * network, which is how `node --test` imports this file and how the site keeps
 * working when there is no server to reach.
 *
 * The swap is safe at any moment, including after the first render, because
 * `remoteScenarioStore` *wraps* this same local store rather than replacing it:
 * both delegate `read` and `subscribe` to the one module-level cache above, so
 * a component that subscribed a millisecond too early is subscribed to exactly
 * the right thing.
 */
const LOCAL = localScenarioStore();
let STORE: ScenarioStore = LOCAL;
let installed = false;

const store = (): ScenarioStore => STORE;

// `useSyncExternalStore` holds onto the references it is handed, so these are
// stable wrappers rather than `STORE.read` passed directly.
const subscribeToStore = (listener: () => void) => STORE.subscribe(listener);
const readStore = () => STORE.read();
const getServerSnapshot = (): ScenarioState => INITIAL_STATE;

/**
 * Install the store the app boots with. Called once, by the sharing layer —
 * the only place that knows there is a server at all.
 */
export function installScenarioStore(
  choose: (local: ScenarioStore) => ScenarioStore,
): void {
  if (installed) return;
  installed = true;
  STORE = choose(LOCAL);
}

/**
 * Put a Capsule on the current Scenario, or take it off — without a hook.
 *
 * The shortlist is the only surface that puts an Adventure on the Plan, and it
 * lives on `/adventures`, three pages away from anything that renders a Plan.
 * Calling `usePlan()` there to get at `toggle` would run the Scheduler and the
 * whole ledger on every keystroke of the sift, for a number nothing on that page
 * shows. So the write is a plain function over the same store the hook reads,
 * exactly like `setMark` in `lib/shortlist.ts`.
 *
 * It writes to the **current** Scenario, which is what every other knob does:
 * the alternates are alternates, and marking an idea on the Plan while looking
 * at "Fireworks NYE" means putting it on "Fireworks NYE".
 *
 * This is what makes membership survive a reload and travel in a Fork. The
 * shortlist's own marks are per-browser by design (`lib/shortlist.ts` says why),
 * so a placement recorded only there would never reach the couple's other phone.
 */
export function setToggled(capsuleId: string, on: boolean): void {
  const now = store().read();
  const current =
    now.scenarios.find((scenario) => scenario.id === now.currentId) ??
    now.scenarios[0];
  if (!current) return;

  const already = current.input.toggled.includes(capsuleId);
  if (already === on) return;

  const toggled = on
    ? [...current.input.toggled, capsuleId]
    : current.input.toggled.filter((id) => id !== capsuleId);

  store().write({
    ...now,
    scenarios: now.scenarios.map((scenario) =>
      scenario.id === current.id
        ? { ...scenario, input: { ...scenario.input, toggled } }
        : scenario,
    ),
  });
}

/**
 * Whether a Capsule is on the current Scenario. The read half of the pair, and
 * what lets the shortlist tell a first press of *Plan* from a second one.
 */
export function isToggled(capsuleId: string): boolean {
  const now = store().read();
  const current =
    now.scenarios.find((scenario) => scenario.id === now.currentId) ??
    now.scenarios[0];
  return Boolean(current?.input.toggled.includes(capsuleId));
}

export interface ScenarioApi extends ScenarioState {
  current: Scenario;
  /** Replace the current Scenario's input. Every knob change lands here. */
  update: (input: PlanInput) => void;
  /** Save a copy under a new name and switch to it. */
  fork: (name: string, input?: PlanInput) => string;
  select: (id: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export function useScenarios(): ScenarioApi {
  const state = useSyncExternalStore(
    subscribeToStore,
    readStore,
    getServerSnapshot,
  );
  const current =
    state.scenarios.find((scenario) => scenario.id === state.currentId) ??
    state.scenarios[0];

  const update = useCallback((input: PlanInput) => {
    const now = store().read();
    store().write({
      ...now,
      scenarios: now.scenarios.map((scenario) =>
        scenario.id === now.currentId ? { ...scenario, input } : scenario,
      ),
    });
  }, []);

  const fork = useCallback((name: string, input?: PlanInput) => {
    const now = store().read();
    const source =
      now.scenarios.find((scenario) => scenario.id === now.currentId) ??
      now.scenarios[0];
    const id = nextScenarioId(name, now.scenarios);
    store().write({
      scenarios: [
        ...now.scenarios,
        {
          id,
          name,
          createdAt: new Date().toISOString(),
          input: input ?? source.input,
        },
      ],
      currentId: id,
    });
    return id;
  }, []);

  const select = useCallback((id: string) => {
    const now = store().read();
    if (!now.scenarios.some((scenario) => scenario.id === id)) return;
    store().write({ ...now, currentId: id });
  }, []);

  const rename = useCallback((id: string, name: string) => {
    const now = store().read();
    store().write({
      ...now,
      scenarios: now.scenarios.map((scenario) =>
        scenario.id === id ? { ...scenario, name } : scenario,
      ),
    });
  }, []);

  const remove = useCallback((id: string) => {
    const now = store().read();
    // Never leave the Plan without a current Scenario: docs/CONTEXT.md says
    // exactly one is marked, and zero is not one.
    if (now.scenarios.length <= 1) return;
    const scenarios = now.scenarios.filter((scenario) => scenario.id !== id);
    store().write({
      scenarios,
      currentId: now.currentId === id ? scenarios[0].id : now.currentId,
    });
  }, []);

  return { ...state, current, update, fork, select, remove, rename };
}

/* ------------------------------------------------------------------ */
/* Side by side                                                        */
/* ------------------------------------------------------------------ */

/** One Scenario's headline numbers, for a comparison row. */
export interface ScenarioTotal {
  id: string;
  name: string;
  current: boolean;
  dayCount: number;
  /** The plan-on figure plus its contingency row — what the HUD shows. */
  totalEur: number;
  bandEur: [number, number];
  worstCaseEur: number;
  /** Warnings the Scenario carries. A cheaper Plan with three is not cheaper. */
  warnings: number;
}

/**
 * Every Scenario's total, computed the same way.
 *
 * This is the "compared side by side" half of docs/CONTEXT.md's Scenario, and
 * it is three lines because a Plan is a pure function of its input: comparing
 * two Scenarios is calling `buildPlan` twice. There is no separate comparison
 * model to keep in step, and no risk of the comparison being computed
 * differently from the Plan it compares.
 *
 * The caller supplies the catalogue so this module stays free of the research
 * corpus — the same boundary `capsules.ts` exists to hold.
 */
export function scenarioTotals(
  state: ScenarioState,
  catalogue: readonly CapsuleSpec[],
  /**
   * Live fares, keyed by Leg id. Passed through so the current Scenario's row
   * agrees with the headline figure above it — a comparison whose first row
   * disagrees with the number it sits under is worse than no comparison. Keys
   * carry their date, so a Scenario on other dates simply matches none of them.
   */
  fareOverrides: Readonly<Record<string, number>> = {},
): ScenarioTotal[] {
  return state.scenarios.map((scenario) => {
    const plan = buildPlan(
      {
        ...scenario.input,
        fareOverrides: { ...scenario.input.fareOverrides, ...fareOverrides },
      },
      catalogue,
    );
    return {
      id: scenario.id,
      name: scenario.name,
      current: scenario.id === state.currentId,
      dayCount: plan.dayCount,
      totalEur: plan.rollUp.totalEur,
      bandEur: plan.rollUp.bandEur,
      worstCaseEur: plan.rollUp.worstCaseEur,
      warnings: plan.warnings.length,
    };
  });
}
