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
  errorResponse,
  hasEditKey,
  jsonResponse,
  readJsonBody,
  throttleWrite,
} from "@/lib/store/guards";
import { isPlausibleId } from "@/lib/store/ids";
import { getKv } from "@/lib/store/kv";
import { readPlan, readPlanMeta, writePlan } from "@/lib/store/plans";

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
 * There is no optimistic-concurrency check. The ADR's audience is two people
 * who are usually in the same room, `updatedAt` comes back so a client can see
 * it lost a race, and a version conflict dialogue for this audience would cost
 * more than the collision it prevents.
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
  const plan = await writePlan(kv, planId, state);
  return jsonResponse({ planId, plan });
}
