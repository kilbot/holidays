/**
 * Create THE canonical Plan. Run once, ever.
 *
 * ```
 * npm run bootstrap:plan -- --out ../edit-link.txt
 * ```
 *
 * Prints the plan id and the view link to stdout, and writes the **edit link to
 * a file you name**. The split is the point: stdout ends up in terminal
 * scrollback, CI logs and agent transcripts, and
 * `docs/adr/0001-link-as-permission-sharing.md` closes with *"the edit link must
 * live in deployment env/data, never committed here"*. So `--out` is required,
 * and the one secret this project has only ever exists in two places — Redis,
 * and the file the operator chose.
 *
 * Afterwards, paste the printed id into `CANONICAL_PLAN_ID` in
 * `lib/store/canonical-plan.ts`. That id is not a secret; it *is* the view link.
 *
 * A second run creates a second Plan rather than touching the first —
 * `createPlan` claims its key with a set-if-absent — but there is no reason to
 * have two, and the site only ever reads the one in the constant.
 *
 * Run through the same loader the tests use, so this script can import the
 * project's TypeScript directly instead of keeping a second copy of the
 * document model in JavaScript:
 * `node --import ./lib/engine/__tests__/alias-hook.mjs --env-file=.env.local`.
 */

import { writeFileSync } from "node:fs";

import { INITIAL_STATE } from "@/lib/engine/scenario-doc";
import {
  PRODUCTION_ORIGIN,
  editUrl,
  viewUrl,
} from "@/lib/store/canonical-plan";
import { getKv } from "@/lib/store/kv";
import { createPlan } from "@/lib/store/plans";

function flag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const out = flag("out");
const origin = flag("origin") ?? PRODUCTION_ORIGIN;

if (!out) {
  console.error(
    "Refusing to run without --out <path>: the edit link is a secret and this\n" +
      "script will not print it to a terminal. Give it a file outside the repo.",
  );
  process.exit(1);
}

const created = await createPlan(getKv(), INITIAL_STATE);
if (!created) {
  console.error("A plan already exists at that id. Nothing was written.");
  process.exit(1);
}

writeFileSync(
  out,
  [
    "Southbound — canonical Plan edit link. Treat as a password.",
    "Anyone holding this URL can edit the itinerary (ADR 0001).",
    "Never commit it, never paste it into an issue or a PR.",
    "",
    `plan id:   ${created.planId}`,
    `edit link: ${editUrl(origin, created.editKey)}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);

console.log(`plan id:   ${created.planId}`);
console.log(`view link: ${viewUrl(origin)}`);
console.log(`edit link: written to ${out} (not printed)`);
console.log("");
console.log("Next: paste the plan id into CANONICAL_PLAN_ID in");
console.log("lib/store/canonical-plan.ts, then deploy.");
