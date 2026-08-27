import { parseRouteKeys, readCoverage } from "@/lib/flights/coverage";
import { getKv } from "@/lib/store/kv";

/**
 * `GET /api/fares/coverage?route=BCN-PER,MAD-PER`
 *
 * Which days already hold a fare. KV reads and two static tables — it cannot
 * reach SearchAPI and it cannot write, which is what lets a ninety-day calendar
 * ask it without anyone having to think about the quota.
 *
 * An unknown pair is dropped rather than refused: the caller is a calendar
 * asking about whatever origins its current search happens to have, and one
 * stale route key should shorten the answer, not fail it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routes = parseRouteKeys(searchParams.get("route"));

  if (routes.length === 0) {
    return Response.json({ error: "No known route requested" }, { status: 400 });
  }

  const coverage = await readCoverage(getKv(), routes);

  // Five minutes: the index only moves when the weekly cron warms or when
  // someone deliberately spends calls on a cold day, and the page folds its own
  // fresh quotes into its copy rather than coming back here for them.
  return Response.json(coverage, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
