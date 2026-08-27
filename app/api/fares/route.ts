import { getFare } from "@/lib/flights/fares";
import { isPreWarmed, resolveRoute } from "@/lib/flights/grid";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const date = searchParams.get("date");
  const route = resolveRoute(from, to, date);

  if (!route || !date) {
    return Response.json({ error: "Unknown route or date" }, { status: 404 });
  }

  const fare = await getFare(route, date, {
    allowApi: searchParams.get("stored") !== "1",
  });
  if (!fare) {
    return Response.json({ error: "Fare unavailable" }, { status: 503 });
  }

  return Response.json(
    { from, to, date, warmed: isPreWarmed(route, date), ...fare },
    // A day the cron warms can be cached for the route's full TTL. A day it
    // does not is a one-off someone paid for by hand: still cacheable, but for
    // a day rather than a week, so a cold date the couple came back to is not
    // quietly seven days stale.
    {
      headers: {
        "Cache-Control": `public, s-maxage=${isPreWarmed(route, date) ? route.ttlSeconds : 86_400}`,
      },
    },
  );
}
