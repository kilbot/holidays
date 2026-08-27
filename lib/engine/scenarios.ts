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
 * ## The boundary for #30
 *
 * Forks and server storage are #30's job. The seam is `ScenarioStore`: an
 * interface with four methods and no knowledge of where the bytes live.
 * `localScenarioStore()` is the localStorage implementation; a server-backed
 * one drops in beside it without touching a caller. Nothing above this file
 * knows which it has.
 *
 * ## Storage
 *
 * localStorage, deliberately — there are no accounts, and #30 is where sharing
 * lands. Every access is wrapped: Safari private mode throws on read and a full
 * quota throws on write, and neither should cost the traveller their session.
 * The in-memory copy is authoritative for the tab either way; storage is where
 * it tries to persist, not where it lives.
 */

import { useCallback, useSyncExternalStore } from "react";

import { EMPTY_INPUT, buildPlan } from "@/lib/engine/plan";
import type { CapsuleSpec, PlanInput } from "@/lib/engine/types";

const STORAGE_KEY = "southbound.scenarios.v1";

export interface Scenario {
  id: string;
  name: string;
  /** ISO instant. Display only — nothing sorts or expires on it. */
  createdAt: string;
  input: PlanInput;
}

export interface ScenarioState {
  scenarios: Scenario[];
  /** Exactly one Scenario is the current Plan. */
  currentId: string;
}

/**
 * Where Scenarios live. The seam #30 replaces to put them on a server: a Fork
 * is a Scenario with a URL, and a URL is a storage concern, not a domain one.
 */
export interface ScenarioStore {
  read(): ScenarioState;
  write(state: ScenarioState): void;
  subscribe(listener: () => void): () => void;
  /** Server stores will want this async; the local one resolves immediately. */
  readonly kind: "local" | "remote";
}

/* ------------------------------------------------------------------ */
/* The default Scenario                                                */
/* ------------------------------------------------------------------ */

/**
 * "Fireworks NYE" — the reference trip, with all eight researched Capsules on.
 * It is a starting position, not a recommendation: everything in it can be
 * toggled off, dragged, or forked.
 */
export const DEFAULT_SCENARIO: Scenario = {
  id: "fireworks-nye",
  name: "Fireworks NYE",
  createdAt: "2026-08-27T00:00:00.000Z",
  input: {
    ...EMPTY_INPUT,
    toggled: [
      "margaret-river",
      "rottnest-island",
      "sydney-nye",
      "gbr-port-douglas",
      "fnq-wildlife",
      "byron-nimbin",
      "tasmania-arc",
      "melbourne-party",
    ],
  },
};

const INITIAL: ScenarioState = {
  scenarios: [DEFAULT_SCENARIO],
  currentId: DEFAULT_SCENARIO.id,
};

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Rebuild a `PlanInput` from whatever came out of storage.
 *
 * Field by field, with `EMPTY_INPUT` as the floor. A stored Scenario written by
 * an older build is missing whichever knobs have been added since, and the
 * right answer to that is the default for the missing ones — never a discarded
 * Scenario and never a crash.
 */
function parseInput(raw: unknown): PlanInput {
  if (!isRecord(raw)) return EMPTY_INPUT;

  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

  const record = <T,>(value: unknown, ok: (item: unknown) => item is T) => {
    if (!isRecord(value)) return {};
    const clean: Record<string, T> = {};
    for (const [key, item] of Object.entries(value)) {
      if (ok(item)) clean[key] = item;
    }
    return clean;
  };

  const isString = (item: unknown): item is string => typeof item === "string";
  const isNumber = (item: unknown): item is number =>
    typeof item === "number" && Number.isFinite(item);
  const isBoolean = (item: unknown): item is boolean =>
    typeof item === "boolean";

  return {
    startDate:
      typeof raw.startDate === "string" ? raw.startDate : EMPTY_INPUT.startDate,
    endDate:
      typeof raw.endDate === "string" ? raw.endDate : EMPTY_INPUT.endDate,
    toggled: strings(raw.toggled),
    placementOverrides: record(raw.placementOverrides, isString),
    legModeOverrides: record(raw.legModeOverrides, isString) as PlanInput["legModeOverrides"],
    lodgingTiers: record(raw.lodgingTiers, isString) as PlanInput["lodgingTiers"],
    carOverrides: record(raw.carOverrides, isBoolean),
    fxStress: raw.fxStress === true,
    contingency: raw.contingency !== false,
    fareOverrides: record(raw.fareOverrides, isNumber),
  };
}

function parse(raw: string | null): ScenarioState {
  if (!raw) return INITIAL;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.scenarios)) return INITIAL;

    const scenarios = parsed.scenarios
      .filter(isRecord)
      .filter((entry) => typeof entry.id === "string")
      .map(
        (entry): Scenario => ({
          id: entry.id as string,
          name: typeof entry.name === "string" ? entry.name : "Untitled",
          createdAt:
            typeof entry.createdAt === "string"
              ? entry.createdAt
              : DEFAULT_SCENARIO.createdAt,
          input: parseInput(entry.input),
        }),
      );

    if (scenarios.length === 0) return INITIAL;

    const currentId =
      typeof parsed.currentId === "string" &&
      scenarios.some((scenario) => scenario.id === parsed.currentId)
        ? parsed.currentId
        : scenarios[0].id;

    return { scenarios, currentId };
  } catch {
    return INITIAL;
  }
}

/* ------------------------------------------------------------------ */
/* The localStorage store                                              */
/* ------------------------------------------------------------------ */

let cachedRaw: string | null = null;
let cachedState: ScenarioState = INITIAL;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
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
        cachedState = parse(raw);
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

const STORE = localScenarioStore();

const getServerSnapshot = (): ScenarioState => INITIAL;

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
    STORE.subscribe,
    STORE.read,
    getServerSnapshot,
  );
  const current =
    state.scenarios.find((scenario) => scenario.id === state.currentId) ??
    state.scenarios[0];

  const update = useCallback((input: PlanInput) => {
    const now = STORE.read();
    STORE.write({
      ...now,
      scenarios: now.scenarios.map((scenario) =>
        scenario.id === now.currentId ? { ...scenario, input } : scenario,
      ),
    });
  }, []);

  const fork = useCallback((name: string, input?: PlanInput) => {
    const now = STORE.read();
    const source =
      now.scenarios.find((scenario) => scenario.id === now.currentId) ??
      now.scenarios[0];
    const id = nextId(name, now.scenarios);
    STORE.write({
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
    const now = STORE.read();
    if (!now.scenarios.some((scenario) => scenario.id === id)) return;
    STORE.write({ ...now, currentId: id });
  }, []);

  const rename = useCallback((id: string, name: string) => {
    const now = STORE.read();
    STORE.write({
      ...now,
      scenarios: now.scenarios.map((scenario) =>
        scenario.id === id ? { ...scenario, name } : scenario,
      ),
    });
  }, []);

  const remove = useCallback((id: string) => {
    const now = STORE.read();
    // Never leave the Plan without a current Scenario: docs/CONTEXT.md says
    // exactly one is marked, and zero is not one.
    if (now.scenarios.length <= 1) return;
    const scenarios = now.scenarios.filter((scenario) => scenario.id !== id);
    STORE.write({
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
  placedCatalogIds: readonly string[] = [],
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
        toggled: [
          ...new Set([...scenario.input.toggled, ...placedCatalogIds]),
        ],
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

/** A slug that is not already taken, so two "Doof NYE" forks can coexist. */
function nextId(name: string, existing: readonly Scenario[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "scenario";
  let id = base;
  let suffix = 2;
  while (existing.some((scenario) => scenario.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}
