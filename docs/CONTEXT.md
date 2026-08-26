# Context

Glossary for the Australia trip planner. Terms only — no implementation detail.

## Terms

- **Trip** — the whole journey: leave Valencia in December 2026, return from Australia's east coast in late January–mid February 2027.
- **Traveller** — one of the two people taking the Trip. Costs are usually quoted per couple unless marked per person.
- **Anchor** — a fixed or semi-fixed date+place commitment the itinerary must honour. Hard anchors: Christmas in Perth (family), New Year's Eve in Sydney. Soft anchor: Australia Day (26 Jan) — be somewhere good for it, city decided by itinerary flow.
- **Capsule** — a pre-researched, self-contained block of the trip that can be toggled on or off the Plan: a destination plus its recommended duration, best-of itinerary, and cost estimate (e.g. "Margaret River, 3 days", "Rottnest, day trip", "Great Barrier Reef, N days from a chosen base").
- **Leg** — a single movement between places (flight, train, ferry, or drive), with a cost and a duration. The long-haul Legs may start with a ground Leg (e.g. train Valencia→Madrid) — the origin is flexible.
- **Plan** — the currently selected set of Capsules and dates, plus the Legs that connect them and the resulting total cost. What the site displays and recalculates as toggles and dates change.
- **Budget** — the money frame the Plan is judged against: €6,000–€10,000 per Traveller (€12,000–€20,000 for the couple). Displayed in EUR; Australian costs are converted from AUD.
- **Daily cap** — the hard ceiling on a paid day's living costs (lodging + food + local transport): **A$500 per couple**. Travel style is Airbnb-first, hostel if needed — never mid-tier hotels. One-off marquee spends (reef boat days, NYE, inter-city Legs) are separate Plan line items, not part of the Daily cap.
- **Home base** — a place with free lodging and a borrowed car (Perth family home, the sister's farm). Capsules near a Home base cost far less than east-coast Capsules, where hotels and car rental are paid.
- **Fare snapshot** — a stored result of flight-price research for a specific route and date range, with a fetched-at date. The fallback data source if live pricing is too expensive.
- **Live pricing** — fetching current fares from a flight-data API at the moment the user changes dates or toggles a Capsule. Preferred if affordable.
- **Comfort-first** — the flight-selection criterion for long-haul Legs: best comfort per euro, not cheapest. Signals: aircraft type (e.g. A380), seat position, layover airport quality (Singapore Changi preferred), option of an overnight stopover.
