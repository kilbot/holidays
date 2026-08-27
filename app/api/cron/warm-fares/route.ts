import { getFare } from "@/lib/flights/fares";
import { ROUTE_GRID } from "@/lib/flights/grid";

/**
 * Ceiling on calls per warm run.
 *
 * The Flights page (#50) turned the grid from thirteen route/date pairs into
 * about a hundred: thirteen European hubs to Perth and ten return pairs, each
 * on three dates, because a multi-origin search that has to fetch every origin
 * live is a slow page and an expensive one. Warmed nightly they are all cache
 * hits.
 *
 * 120 is a ceiling, not a target — the grid currently asks for fewer, and the
 * headroom absorbs a few more dates without another edit here. At one run a day
 * that is at most ~3,650 calls a month against the paid tier's 10,000, leaving
 * roughly two thirds of the allowance for interactive requests, previews and
 * the odd cache miss. If the grid ever grows past this the run reports
 * `skipped` rather than silently overspending.
 */
const MAX_WARM_CALLS = 120;

export async function GET() {
  let warmed = 0;
  let failed = 0;
  let skipped = 0;
  let calls = 0;

  for (const route of ROUTE_GRID) {
    for (const date of route.dates) {
      if (calls >= MAX_WARM_CALLS) {
        skipped += 1;
        continue;
      }

      calls += 1;
      const fare = await getFare(route, date);
      if (fare?.source === "live") warmed += 1;
      else failed += 1;
    }
  }

  return Response.json({ warmed, failed, skipped });
}
