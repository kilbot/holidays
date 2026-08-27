import { getFare } from "@/lib/flights/fares";
import { ROUTE_GRID } from "@/lib/flights/grid";

// The free tier includes 100 calls total, so a daily warm must leave headroom for interactive requests.
const MAX_WARM_CALLS = 30;

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
