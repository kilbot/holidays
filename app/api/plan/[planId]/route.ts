/**
 * The canonical Plan: read by anyone, written by whoever holds the edit key.
 *
 * `docs/adr/0001-link-as-permission-sharing.md`: *"holding a URL is the
 * permission"*. `GET` is the view link's whole implementation. `PUT` is the
 * edit link's, and the only difference between the two callers is a header.
 *
 * The Plan is one mutable document behind one URL, so nothing here may be
 * cached — `force-dynamic` keeps the route out of the build's static pass and
 * `jsonResponse` puts `no-store` on the way out.
 */

import { parseScenarioState } from "@/lib/engine/scenario-doc";
import {
  basePlanVersion,
  errorResponse,
  hasEditKey,
  jsonResponse,
  readJsonBody,
  throttleWrite,
} from "@/lib/store/guards";
import { isPlausibleId } from "@/lib/store/ids";
import { getKv } from "@/lib/store/kv";
import {
  readPlan,
  readPlanMeta,
  writePlan,
  writePlanIfCurrent,
} from "@/lib/store/plans";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  if (!isPlausibleId(planId)) return errorResponse("No such plan", 404);

  const plan = await readPlan(getKv(), planId);
  if (!plan) return errorResponse("No such plan", 404);

  // The meta document — and so the edit key — is deliberately not read here.
  return jsonResponse({ planId, plan });
}

/**
 * Replace the Plan.
 *
 * A whole-document write rather than a patch, because that is what the client
 * has: `ScenarioStore.write` hands over the entire state, and a Plan is small.
 * The body is run through the same `parseScenarioState` the browser uses on its
 * own localStorage, so the only thing a caller can store in the Plan is a Plan —
 * the edit key buys the right to write, not the right to write anything.
 *
 * There **is** an optimistic-concurrency check, added by #90, and the reason is
 * not two people editing the same knob — the ADR is right that this audience
 * does not have that problem. It is that this is a *whole-document* write on a
 * debounce, so a push already in flight when the couple adopts a Fork lands
 * afterwards and erases a Scenario the pushing tab has never seen. That is data
 * loss, not a lost race, and no amount of "they're in the same room" fixes it.
 *
 * So a write may carry the version it is editing from, and a stale one is
 * refused with `409` and the current document attached, which is what lets the
 * client merge and retry without a second round trip. There is still no
 * conflict dialogue: nothing here asks the traveller anything.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  if (!isPlausibleId(planId)) return errorResponse("No such plan", 404);

  const kv = getKv();
  const throttled = await throttleWrite(kv, request);
  if (!throttled.ok) return throttled.response;

  const meta = await readPlanMeta(kv, planId);
  if (!meta) return errorResponse("No such plan", 404);
  if (!hasEditKey(request, meta.editKey)) {
    return errorResponse("This link can view the plan, not edit it", 403);
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const state = parseScenarioState(body.value);
  const base = basePlanVersion(request);

  // No claimed version is not a stale claim — it is a caller with no document
  // in its hands, and it writes unconditionally exactly as it always did.
  if (base === null) {
    return jsonResponse({ planId, plan: await writePlan(kv, planId, state) });
  }

  const written = await writePlanIfCurrent(kv, planId, state, base);
  if (!written.ok) {
    if (!written.current) return errorResponse("No such plan", 404);
    // The current document travels with the refusal. The client's next move is
    // to merge and retry, and making it fetch what this handler already had in
    // memory would widen the very window the check exists to close.
    return jsonResponse(
      {
        planId,
        plan: written.current,
        error: "The plan changed since this edit started",
      },
      409,
    );
  }
  return jsonResponse({ planId, plan: written.plan });
}
