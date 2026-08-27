/**
 * Add the seeded Scenarios to the **live** canonical Plan. Run once, by hand.
 *
 * ```
 * npm run seed:scenarios              # dry run — prints the diff, writes nothing
 * npm run seed:scenarios -- --write   # actually writes
 * ```
 *
 * ## Why this exists at all
 *
 * `lib/engine/scenario-doc.ts` seeds `INITIAL_STATE` with three Scenarios —
 * "Fireworks NYE" and the two savings paths #65 priced. That seed is what a
 * browser with no saved Plan gets, and what `scripts/bootstrap-plan.mjs` would
 * write if the canonical Plan were being created today. It is not.
 *
 * The canonical Plan already exists in KV, it holds the couple's own edits, and
 * `createPlan` is set-if-absent precisely so a second bootstrap can never
 * overwrite a live itinerary. So a new seeded Scenario reaches the real Plan
 * exactly one way: somebody runs this, on purpose, once.
 *
 * ## What it does, and what it refuses to do
 *
 * It **adds** the Scenarios the live document is missing, by id, and leaves
 * everything else alone — the couple's own Scenarios, their edits to any
 * Scenario that shares an id with a seed, and `currentId`. A Scenario the
 * couple has since renamed or re-planned is theirs; this script is not a
 * migration and it does not reconcile. If the ids all match already it writes
 * nothing and says so.
 *
 * It never prints or touches the edit key: the key lives in
 * `plan:<id>:meta`, this reads and writes `plan:<id>`, and the two are separate
 * documents for exactly that reason.
 *
 * Run through the same loader the tests use, so the script imports the
 * project's TypeScript rather than keeping a second copy of the document model:
 * `node --import ./lib/engine/__tests__/alias-hook.mjs --env-file=.env.local`.
 */

import { INITIAL_STATE } from "@/lib/engine/scenario-doc";
import { CANONICAL_PLAN_ID } from "@/lib/store/canonical-plan";
import { getKv } from "@/lib/store/kv";
import { readPlan, writePlan } from "@/lib/store/plans";

const write = process.argv.includes("--write");

if (!CANONICAL_PLAN_ID) {
  console.error("No CANONICAL_PLAN_ID — run scripts/bootstrap-plan.mjs first.");
  process.exit(1);
}

const kv = getKv();
const live = await readPlan(kv, CANONICAL_PLAN_ID);

if (!live) {
  console.error(
    `No Plan at ${CANONICAL_PLAN_ID}. Check the KV credentials in .env.local.`,
  );
  process.exit(1);
}

const have = new Set(live.scenarios.map((scenario) => scenario.id));
const missing = INITIAL_STATE.scenarios.filter(
  (scenario) => !have.has(scenario.id),
);

console.log(`plan:      ${CANONICAL_PLAN_ID}`);
console.log(`updated:   ${live.updatedAt}`);
console.log(`live:      ${live.scenarios.map((s) => s.id).join(", ")}`);
console.log(`current:   ${live.currentId}`);
console.log("");

if (missing.length === 0) {
  console.log("Nothing to add — every seeded Scenario is already there.");
  process.exit(0);
}

for (const scenario of missing) {
  console.log(`  + ${scenario.id}  "${scenario.name}"`);
}
console.log("");

if (!write) {
  console.log("Dry run. Re-run with --write to apply.");
  process.exit(0);
}

const next = await writePlan(kv, CANONICAL_PLAN_ID, {
  scenarios: [...live.scenarios, ...missing],
  // Untouched on purpose: whichever Scenario the couple was looking at stays
  // the current Plan. A seeding script does not get to change what the site
  // opens on.
  currentId: live.currentId,
});

console.log(`Wrote ${next.scenarios.length} Scenarios at ${next.updatedAt}.`);
