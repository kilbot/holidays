/**
 * Adopt a Fork into the Plan's Scenario list. Edit key required.
 *
 * `docs/adr/0001-link-as-permission-sharing.md`: *"Forks can never modify the
 * canonical Plan; the couple can adopt (copy) a fork into their Scenario
 * list."* This route is the "can adopt" half, and the edit-key check is the
 * "can never" half — the Fork's author cannot call it, because the only thing
 * that moves a Fork's bytes into the Plan is a request from the couple.
 *
 * It is a copy, not a link. What lands in the Plan is the Fork's `PlanInput` as
 * it stood at this moment; the author can keep editing their Fork afterwards
 * and nothing they do reaches the itinerary.
 */

import {
  errorResponse,
  hasEditKey,
  jsonResponse,
  readJsonBody,
  throttleWrite,
} from "@/lib/store/guards";
import { isPlausibleId } from "@/lib/store/ids";
import { getKv } from "@/lib/store/kv";
import {
  adoptFork,
  readFork,
  readPlan,
  readPlanMeta,
  writePlan,
} from "@/lib/store/plans";

export const dynamic = "force-dynamic";

export async function POST(
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
    return errorResponse("Only the edit link can adopt a fork", 403);
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const forkId = (body.value as { forkId?: unknown } | null)?.forkId;
  if (!isPlausibleId(forkId)) return errorResponse("No such fork", 404);

  const [plan, fork] = await Promise.all([
    readPlan(kv, planId),
    readFork(kv, forkId),
  ]);
  if (!plan) return errorResponse("No such plan", 404);
  if (!fork || fork.forkedFrom !== planId) {
    return errorResponse("No such fork", 404);
  }

  const adopted = adoptFork(plan, forkId, fork);
  // Adopting the same Fork twice is a no-op, so the second call skips the write
  // entirely rather than bumping `updatedAt` for a document that did not change.
  const next = adopted.alreadyAdopted
    ? plan
    : await writePlan(kv, planId, adopted.state);

  return jsonResponse({
    planId,
    plan: next,
    scenarioId: adopted.scenarioId,
    alreadyAdopted: adopted.alreadyAdopted,
  });
}
