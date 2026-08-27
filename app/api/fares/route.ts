import { getFare } from "@/lib/flights/fares";
import { ROUTE_GRID } from "@/lib/flights/grid";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const date = searchParams.get("date");
  const route = ROUTE_GRID.find(
    (entry) => entry.from === from && entry.to === to && entry.dates.some((candidate) => candidate === date),
  );

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
    { from, to, date, ...fare },
    { headers: { "Cache-Control": `public, s-maxage=${route.ttlSeconds}` } },
  );
}
