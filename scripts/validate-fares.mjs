const ADULTS = 2;
const apiKey = process.env.SEARCHAPI_KEY;
if (!apiKey) {
  console.error("SearchAPI validation failed: SEARCHAPI_KEY is missing");
  process.exitCode = 1;
} else {
  const params = new URLSearchParams({
    engine: "google_flights",
    flight_type: "one_way",
    departure_id: "PER",
    arrival_id: "SYD",
    outbound_date: "2026-12-26",
    currency: "EUR",
    adults: String(ADULTS),
    api_key: apiKey,
  });

  try {
    const response = await fetch(`https://www.searchapi.io/api/v1/search?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const candidates = [...(data.best_flights ?? []), ...(data.other_flights ?? [])]
      .filter((flight) => typeof flight.price === "number" && Array.isArray(flight.flights))
      .sort((a, b) => a.price - b.price);
    const cheapest = candidates[0];
    const carriers = cheapest?.flights
      .map((leg) => leg.airline)
      .filter((carrier, index, all) => typeof carrier === "string" && all.indexOf(carrier) === index);
    const parsed = cheapest
      ? {
          priceEur: cheapest.price / ADULTS,
          carrier: carriers.join(" / ") || "Unknown carrier",
          durationMin: cheapest.total_duration,
          stops: Array.isArray(cheapest.layovers) ? cheapest.layovers.length : Math.max(0, cheapest.flights.length - 1),
        }
      : null;

    console.log(parsed);
  } catch (error) {
    console.error(`SearchAPI validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
