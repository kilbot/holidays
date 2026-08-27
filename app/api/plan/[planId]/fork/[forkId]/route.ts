/**
 * Read one Fork. The other half of "the link IS the permission".
 *
 * Nested under the Plan it was forked from because that is what a Fork is —
 * docs/CONTEXT.md defines it as a visitor-created Scenario of *this* Plan, and a
 * URL that says so reads correctly when a friend pastes it into a group chat.
 *
 * Read-only. A Fork is edited by its author holding its URL and posting a new
 * one; there is no `PUT` here because there is no key to check it against.
 */

import { errorResponse, jsonResponse } from "@/lib/store/guards";
import { isPlausibleId } from "@/lib/store/ids";
import { getKv } from "@/lib/store/kv";
import { readFork } from "@/lib/store/plans";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; forkId: string }> },
) {
  const { planId, forkId } = await params;
  if (!isPlausibleId(forkId)) return errorResponse("No such fork", 404);

  const fork = await readFork(getKv(), forkId);
  if (!fork) return errorResponse("No such fork", 404);
  // A Fork of another Plan is not this Plan's fork, and answering as if it were
  // would let one Plan's URL space quietly address another's.
  if (fork.forkedFrom !== planId) return errorResponse("No such fork", 404);

  return jsonResponse({ forkId, fork });
}
