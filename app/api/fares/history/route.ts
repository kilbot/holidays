import { readFareSeries, type FareSeries } from "@/lib/flights/history";
import { inFareWindow, routeFor } from "@/lib/flights/grid";
import { MAX_PINS } from "@/lib/flights/watchlist";
import { getKv } from "@/lib/store/kv";

/**
 * `GET /api/fares/history?pin=BCN-PER:2026-12-12,SIN-PER:2027-02-12`
 *
 * What the watchlist reads (kilbot/holidays#68): the stored price line for each
 * pinned route-day, newest observation included, so a pin can show what has
 * happened since it was taken.
 *
 * **It cannot spend a fare call.** Not "does not" — cannot: it imports the
 * history store and never `lib/flights/fares`, so there is no path from this
 * handler to SearchAPI at all. That is the ticket's rule made structural, and
 * it is the reason twenty pins are affordable to draw on every page load.
 *
 * Unknown pairs and days outside the fare window are dropped rather than
 * refused, the same bargain `/api/fares/coverage` strikes: the caller is a
 * watchlist that may hold a pin from before a grid edit, and one stale entry
 * should shorten the answer rather than fail it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const series = await readSeries(searchParams.get("pin"));

  if (series === null) {
    return Response.json({ error: "No known route-day requested" }, { status: 400 });
  }

  // Five minutes, matching the coverage index: the history only moves when the
  // cron warms or when someone prices a day, and the Flights page folds its own
  // fresh quotes into what it draws rather than coming back here for them.
  return Response.json({ series }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}

/** `"BCN-PER:2026-12-12,…"` → the stored line for each, or null if none parse. */
async function readSeries(value: string | null): Promise<FareSeries[] | null> {
  if (!value) return null;

  const kv = getKv();
  const seen = new Set<string>();
  const series: FareSeries[] = [];

  for (const token of value.split(",")) {
    const [pair, date] = token.trim().split(":");
    if (!pair || !inFareWindow(date)) continue;

    const [from, to] = pair.toUpperCase().split("-");
    const route = routeFor(from, to);
    if (!route) continue;

    const key = `${route.from}-${route.to}:${date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    series.push(await readFareSeries(kv, route.from, route.to, date));

    // The watchlist's own ceiling, enforced here as well: a request cannot make
    // the store fan out past what a full watchlist would ask for.
    if (series.length >= MAX_PINS) break;
  }

  return series.length === 0 ? null : series;
}
