/**
 * Fork the Plan. No key required — that is the whole idea.
 *
 * docs/CONTEXT.md, Fork: *"a visitor-created Scenario: named, saved, with its
 * own URL (the link IS the permission — no accounts)"*. A visitor who has been
 * playing with the itinerary in their browser posts what they built, gets an
 * unguessable id back **once**, and that id is their claim on it.
 *
 * The Fork lands under `fork:<id>`, a key space this route is the only writer
 * of and the Plan routes never read from except through an explicit adopt. That
 * is the ADR's *"Forks can never modify the canonical Plan"* — not a check that
 * could be forgotten, but a place the write cannot reach.
 */

import { parseInput } from "@/lib/engine/scenario-doc";
import {
  errorResponse,
  jsonResponse,
  readJsonBody,
  throttleWrite,
} from "@/lib/store/guards";
import { isPlausibleId } from "@/lib/store/ids";
import { getKv } from "@/lib/store/kv";
import { createFork, readPlan } from "@/lib/store/plans";

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

  // A Fork records what it forked from, so the id has to name a real Plan.
  const plan = await readPlan(kv, planId);
  if (!plan) return errorResponse("No such plan", 404);

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const raw = body.value;
  if (!raw || typeof raw !== "object") {
    return errorResponse("Expected a fork", 400);
  }

  const { name, planInput, authorNote } = raw as Record<string, unknown>;
  const { forkId, fork } = await createFork(kv, {
    name: typeof name === "string" ? name : "",
    planInput: parseInput(planInput),
    ...(typeof authorNote === "string" ? { authorNote } : {}),
    forkedFrom: planId,
  });

  // The id is returned here and nowhere else. Nothing lists forks, and nothing
  // derives one id from another: losing the URL loses the Fork.
  return jsonResponse({ forkId, fork }, 201);
}
