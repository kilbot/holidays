# Flight data: what live pricing actually costs

Research for [issue #2](https://github.com/kilbot/holidays/issues/2). All sources accessed **2026-08-26** unless noted.
Currency: 1 USD ≈ €0.856 ([Fed H.10, 2026-08-24](https://www.federalreserve.gov/releases/h10/hist/dat00_eu.htm)).

## TL;DR

- **Amadeus Self-Service is dead.** Decommissioned **17 July 2026** — I confirmed the API hostnames no longer resolve in DNS. The obvious "free tier" answer no longer exists, and every guide still recommending it is stale. Biggest finding here.
- **Live pricing is affordable** — about **€34/month** — but only because our route set is small and fixed, which makes caching very effective.
- **Recommended live path: SearchAPI.io `google_flights`** at $40/mo, behind a cache plus a cron pre-warm.
- **Recommended fallback: committed fare-snapshot JSON** in the repo. €0, no dependency, and it doubles as the degraded mode when the API errors or the quota runs out.
- **Build the provider behind a thin swappable interface.** Google is currently suing SerpApi over exactly this kind of scraping, so the whole Google-Flights-wrapper category carries supplier-continuity risk.
- **Duffel is the tempting road not taken:** real bookable fares, Jetstar and Qantas as direct connects, ~€11/mo — but its terms are written for people who sell flights, and we've scoped booking out.
- **Nobody covers Rex.** Hand-snapshot those legs.

## Usage model

The ticket's stated pattern: tens to low hundreds of searches/day at peak planning, far fewer later.

- **Peak:** ~200 searches/day → **6,000/month**
- **Later:** ~20 searches/day → **600/month**

But *user-visible searches* ≠ *upstream API calls*. The route set is tiny and fixed:

| Group | Routes | Plausible dates each | Cache keys |
|---|---|---|---|
| Long-haul out (VLC/MAD/BCN/MXP → PER) | 4 | ~10 | 40 |
| East-coast return (SYD/MEL/BNE → Europe) | 3 | ~10 | 30 |
| AU domestic legs | ~6 | ~14 | ~84 |
| **Total distinct keys** | **~13 routes** | | **~154** |

At ~154 distinct cache keys, a **twice-daily refresh of the entire plausible grid costs ~308 calls/day ≈ 9,200/month** — and that is the *upper* bound, covering every date the user could toggle to. Lazy on-demand filling costs far less. Either way it fits the cheapest paid tier of the recommended provider.

## Comparison

| Provider | Free tier | Entry paid | €/mo at our volume | Bookable-accurate? | Signup | AU domestic LCC | Verdict |
|---|---|---|---|---|---|---|---|
| **SearchAPI.io** | 100 calls total | $40 / 10k | **€34** | Yes, via `booking_token` | Instant, no card for trial | Google Flights coverage | **Recommended** |
| **SerpApi** | 250/mo | $25 / 1k; $150 / 15k | €64–128 | Yes, via `booking_token` | Instant | Google Flights coverage | Same data, ~6× price |
| **Duffel** | 1,500 searches/period | then $0.005/search | €11–19 | **Yes — real bookable offers** | Instant test token; **KYC for live** | **Jetstar + Qantas direct**; Virgin via GDS; **no Rex** | Best data, ToS mismatch |
| **Travelpayouts Data API** | Free | Free | **€0** | **No — cached, up to 7 days old** | Instant token, no approval | Carriers listed; cache depth thin | **Fallback seed** |
| **Amadeus Self-Service** | — | — | — | Was live GDS | **Portal shut down 2026-07-17** | Weak on LCCs | **Unavailable** |
| **Kiwi.com Tequila** | — | — | — | Yes | **Invitation-only since 2024** | — | Unavailable |
| **Skyscanner Travel APIs** | — | — | — | Yes | Partner application, ~2wk, business review | Good | Won't qualify |
| **Travelpayouts Search API** | — | — | — | Yes, live | **50,000 MAU, "no exceptions"** | — | Won't qualify |
| **KAYAK Price Insights** | Sandbox on request | Not published | ? | Unverified | Email partnerships@kayak.com | Unverified | Worth one email |
| **FlightAPI.io** | 20 calls | $49 / 30k credits | €42 | **No — "cannot book"** | Instant | Own aggregation | Skip |
| **AviationStack** | 100/mo | $49.99 | — | **No prices at all** | Instant | n/a | Skip |
| **FlightLabs** | 7-day trial | **$249.99** | €214+ | Source undisclosed | Instant | Unverified | Skip |
| **Booking.com / Expedia Rapid** | — | — | — | **No flight pricing** | Partner application | n/a | Skip |
| **Sabre / Travelport** | Sandbox / 30-day trial | Not published | — | Sandbox is simulated | Commercial agreement | — | Skip |
| **Oxylabs / Bright Data** | 2k–5k | $49–99 | varies | DIY parser | Instant | DIY | Skip — no Flights parser |

## Per-provider notes

### Amadeus Self-Service — GONE (verify before assuming otherwise)

Amadeus announced in Feb 2026 that it was closing the Self-Service developer portal, paused new registrations in spring 2026, and **fully decommissioned it on 17 July 2026, deactivating existing API keys**. The Enterprise portal is unaffected, but Enterprise is a sales-contact, contract-and-KYC path with no free tier — not viable for a two-person holiday site.

**This is not a rumour — the endpoints are physically gone.** Verified directly on 2026-08-26:

```
$ dig +short test.api.amadeus.com A     # (no output — no A record)
$ dig +short api.amadeus.com A          # (no output — no A record)
```

Both Self-Service API hostnames have had their DNS A records removed. Nothing can call them. Corroborating primary evidence:

- **Amadeus's own docs repo**, [amadeus4dev/developer-guides](https://github.com/amadeus4dev/developer-guides), README first line: *"**[DEPRECATED] Developer Guides** — The Amadeus for Developers Self-Service offer has been deprecated."* The repo is archived, last push **2026-07-17**, matching the reported decommission date exactly.
- The official [Amadeus statement](https://amadeus.com/en/industry-messaging/statement-regarding-amadeus-for-developers-portal) linked from that README.
- The `amadeus` Node SDK on npm is stuck at **11.0.0, published 2024-10-14** — no release in nearly two years.
- [PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers): registrations paused March 2026, portal decommissioned **17 July 2026**, existing keys disabled. *(Trade press — but the repo-archive date and the DNS removal corroborate it precisely.)*

`developers.amadeus.com` still returns HTTP 200, but it's an Angular SPA shell behind Incapsula — which is why stale blog posts and search snippets still make it look alive. It isn't.

This matters because Amadeus Self-Service (~2,000 free Flight Offers Search calls/month) was *the* standard recommendation for a project like this. **Any guide recommending it is now wrong.** What remains at Amadeus is Enterprise only: account manager, commercial negotiation, no published rate card, no self-serve key.

Worth noting for the record: even when it existed, its **test environment served cached, limited data** — never bookable-accurate — and GDS content structurally under-represents low-cost carriers, so Jetstar and Rex would have been weak spots anyway.

### SearchAPI.io — recommended live path

[Pricing](https://www.searchapi.io/pricing) · [Google Flights docs](https://www.searchapi.io/docs/google-flights-api)

| Plan | USD/mo | Searches | $/search |
|---|---|---|---|
| Free | $0 | 100 total, no card | — |
| **Developer** | **$40** | **10,000** | **$0.0040** |
| Production | $100 | 35,000 | $0.0029 |

- **Rate limit:** up to 20% of monthly credits per hour — 2,000/hr on Developer. Far above anything we'd generate.
- **Failed requests are free** — only HTTP 200 successes bill.
- **Bookable:** returns `booking_token`, which a second call resolves into booking options with real booking URLs, fare types and baggage pricing. Note that second call is another billed search.
- **Sibling engines** for Flights Calendar and Travel Explore exist — useful if we later want a cheapest-date strip.
- **ToS:** prohibits reselling/redistributing the service to third parties; no explicit clause limiting how long you may cache results. Our use (displaying prices on our own small site) is well within normal use, but the absence of an explicit caching permission is worth knowing.
- **Unverified:** whether Flights calls carry a credit multiplier, and whether it has a browser-parity mode equivalent to SerpApi's `deep_search` (see the accuracy warning below). **Test both on the free 100 calls before committing.**

### SerpApi — same data, ~6× the price

[Pricing](https://serpapi.com/pricing) · [Google Flights API](https://serpapi.com/google-flights-api) · [Status](https://serpapi.com/status/google_flights)

| Plan | USD/mo | Searches | $/search |
|---|---|---|---|
| Free | $0 | 250 | — |
| Starter | $25 | 1,000 | $0.025 |
| Developer | $75 | 5,000 | $0.015 |
| Production | $150 | 15,000 | $0.010 |

Three things worth carrying over even if we don't pick SerpApi, because they are properties of *scraped Google Flights data in general*:

1. **Default results can be badly wrong on price.** SerpApi's own blog documents one query returning **$10,012 without `deep_search` vs $2,238 with it**. Their public issue tracker has a report of flights listed at **~$80,000 that actually cost ~$1,600** ([issue #2432](https://github.com/serpapi/public-roadmap/issues/2432)). For a budget tool, a wrong price is worse than no price — we must sanity-bound results.
2. **Latency is high.** SerpApi's own status page shows **8.10s average** for the Flights engine (99.91% success). This is a scrape of a slow page. It rules out synchronous fetch-on-keystroke and argues for pre-warmed cache.
3. **Free 1-hour cache.** Byte-identical repeat queries are free and don't count against quota. Any parameter change busts it.

**Legal risk:** Google sued SerpApi on 2025-12-19 (N.D. Cal. 5:25-cv-10826) alleging DMCA §1201 circumvention ([Google's post](https://blog.google/technology/safety-security/serpapi-lawsuit/)). SerpApi's Legal Shield only applies from the $150 Production tier up. Every Google-Flights-wrapper vendor scrapes the same way, so this is a **category-level continuity risk**, not a reason to prefer one wrapper over another. It is the reason to keep the provider swappable.

### Duffel — the accuracy-first alternative

[Pricing](https://duffel.com/pricing) · [Airlines](https://duffel.com/flights/airlines) · [Excess search](https://help.duffel.com/hc/en-gb/articles/4412912264466-What-is-Excess-Search)

- **Pricing is booking-based, not search-based:** $3.00/order, 1% of order value on managed content, $2.00/paid ancillary. We never book, so those are all €0. Billing currency can be set to AUD or EUR.
- **Excess search fee:** $0.005/search beyond a **1,500:1 search-to-order ratio**. The Services Agreement §2.3 is explicit: *"zero Orders shall be treated as one Order for the purposes of calculating the Search-to-Order Ratio"* — so we get **~1,500 free searches/period**, then half a US cent each. At 4,000 calls/month that's ~$12.50 ≈ **€11**, cheaper than SearchAPI.
- **Prices are genuinely bookable** — real airline offers, the same inventory Duffel sells against. No `deep_search` accuracy problem. Offers expire quickly by design.
- **AU coverage is the best of any option here:** **Qantas and Jetstar as Direct Connects** (Duffel's blog claims their Jetstar fares and ancillaries are *"more extensive than through GDS and at more competitive prices"*), plus Singapore Airlines and Emirates direct; Virgin Australia and Qatar Airways via **Travelport GDS**. For EU→PER the carrier list is strong: Qantas (the only nonstop Europe–Perth operator), Emirates, Singapore, BA, Iberia, Vueling, Air France/KLM, Lufthansa group, Qatar, Etihad, Cathay.
- **Rex/Regional Express is absent entirely** — zero hits in either the Direct Connect or Travelport list.
- **Rate limit:** 60 requests per 60 seconds, raisable on request. Search responses target 20s.
- **Signup:** test-mode token is instant from the dashboard, and test mode includes a reliable fake carrier (Duffel Airways, `ZZ`) plus airline sandboxes. **Live mode requires KYC review** — §1.1 keeps the account test-only *"until we have reviewed and approved all such information"*. No IATA accreditation needed; you ride Duffel's, which is what the 1% managed-content fee buys.
- **Integration is the nicest of the lot:** [`@duffel/api`](https://www.npmjs.com/package/@duffel/api) v4.28.0 published 2026-06-29 — actively maintained TypeScript SDK, bearer token + version header, and HTTP streaming for incremental search results.

**The catch — and it's a real one:** Duffel's fair-usage terms state the service *"may not be suitable"* for **metasearch engines or calendar search**, which is close to what a date-toggling planner does, and §2.3 reserves Duffel's right to *"monitor and apply a cap on your usage"*. A zero-booking account hammering search is precisely the behaviour the excess-search fee exists to deter. We'd be operating against the grain of the product, and would need to pass KYC as a travel seller we aren't.

**Verdict:** technically the best data at the lowest price, with the best Australian coverage and the best SDK — but the ToS fit is wrong for a site whose scope [explicitly excludes booking](https://github.com/kilbot/holidays/issues/1). Worth revisiting if scraped-price accuracy proves unusable in testing; accept the account risk knowingly rather than stumble into it.

### Travelpayouts / Aviasales Data API — free, but cached estimates

[Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API) · [Access requirements](https://support.travelpayouts.com/hc/en-us/articles/203956083-Requirements-for-Aviasales-data-API-access) · [Rate limits](https://support.travelpayouts.com/hc/en-us/articles/4402565416594-API-rate-limits) · [API reference](https://travelpayouts.github.io/slate/)

- **Free, and the signup gate is low.** Joining is free with instant access; the Data API needs only a token from Profile → API token, with **no brand approval** (unlike their Search API). Signup asks for a website or a social channel as your traffic source. Minutes, not days.
- **Generous rate limits:** per-minute, varying by endpoint — 600/min for `v3/prices_for_dates`, 300/min for `/v1/prices/cheap` and `/v2/prices/latest`, 60/min for the slower matrix endpoints. Not a constraint for us.
- **The data is cached from other users' past searches, not live.** The docs say plainly: *"data is transferred from the cache, so it is recommended to use them to generate static pages."* **The docs contradict themselves on staleness** — the access-requirements article says prices are stored *"from 2 to 7 days depending on the type of query"*, the Data API article says *"7 days for all types of queries"*, and `v3/prices_for_dates` is documented as the cheapest tickets found *"in the last 48 hours"*. Assume **up to 7 days old**.
- **Staleness metadata is version-dependent:** v1/v2 responses carry `found_at`, `expires_at` and an `actual` boolean; **`v3/prices_for_dates` returns none of them.** If we want an honest fetched-at on the snapshot, use the older v2 endpoints.
- **Explicitly indicative, not bookable.** The docs: *"It is not recommended that you use expired prices"*, and they position the product as *"to inform users and generate content pages"*. Treat every number as a historical low-water mark.
- **The `market` trap — the real coverage risk.** Market defaults to the origin's market, and **if it can't be determined the API returns `ru`-market data**, because different agencies are connected per market. VLC/MAD→PER and AU domestic will be sparse unless we pass a market with genuine Aviasales search volume on that route.
- **Carriers are in the catalogue**, at least: an unauthenticated call to `api.travelpayouts.com/data/en/airlines.json` returns Jetstar `JQ` (flagged `is_lowcost`), Virgin Australia `VA`, Rex `ZL` and Qantas `QF`. What's **unverified without a token is whether the price cache has any depth** on Perth long-haul or AU domestic — that's search-volume-driven and Aviasales' AU share is low. Assume thin.
- **ToS actively encourages caching:** *"We strongly recommend that you use cached data to limit the number of requests to API"*, with explicit suggestions to store results in a database or file. The restrictive rules (no scraping, conversion floors, robots.txt requirements) apply to their Search API, not this one.

**Verdict:** not the live path, but a genuinely useful **free seed** for the fare-snapshot fallback, and a zero-cost cross-check on whether scraped prices look sane. Half a day to integrate.

**Their real-time Search API is closed to us:** access requires **50,000 monthly active users**, described as *"the primary and mandatory condition"* with *"no exceptions"* ([source](https://support.travelpayouts.com/hc/en-us/articles/210995808-How-to-get-access-to-the-Aviasales-Search-API), updated 2026-07-14).

### Unavailable at our scale

- **Kiwi.com Tequila** — self-serve registration is dead. Kiwi's own Tequila product page now 301-redirects to a [policy statement](https://media.kiwi.com/articles-and-interviews/better-for-business-kiwi-com-takes-a-new-approach-to-partnerships/): *"Any new partnerships on the Tequila platform will be on an invitation only basis."* The API itself still runs for existing partners — `api.tequila.kiwi.com/v2/search` returns `403 "'apikey' header is required"` — but there is no way in. Policy has held since May 2024.
- **Sabre Dev Studio** — free self-serve sandbox, but sandbox data is simulated and not bookable. No published pricing; production needs a commercial agreement.
- **Travelport** — 30-day sandbox trial only, then a commercial agreement. Time-boxed, so no use as a long-lived free tier. Also note Travelport *is* Duffel's GDS content source, so going direct buys the same content minus Duffel's direct connects.
- **Skyscanner Travel APIs** — [partner application only](https://www.partners.skyscanner.net/product/travel-api): *"If you're an established business with a large audience, you can apply"*, ~2 weeks to a decision. No self-serve tier, no sandbox key, no published pricing. A two-person trip planner will not qualify. Any blog offering a "free Skyscanner API key" is describing an unofficial scraper.
- **Google** — **there is no official Google flight-price API.** Confirmed from Google's own developer surface: [developers.google.com/hotels](https://developers.google.com/hotels) lists Hotel Prices, Hotel Content, Vacation Rentals and UCP — zero flight products. QPX Express was retired **2018-04-10** and nothing public replaced it. This is why the scraper-wrapper category exists at all.
- **Booking.com Demand API** — no flight search or pricing. Verticals are Accommodation, Car rentals, Attractions; flights appear only in `orders/details` for post-booking reporting. Not a price source.
- **Expedia Rapid** — branded "Rapid **Lodging** API". No flight endpoint, and access needs partner application plus certification.
- **AviationStack** — schedules, status, routes and airports. **No fares at all.** Free tier 100 req/month. Useless for this question, though possibly handy later for flight status.
- **FlightLabs / goflightlabs** — lists "Flight Prices" but **does not disclose the data source**, and plans start at **$249.99/month**. Opaque and expensive. Skip.
- **FlightAPI.io** — [their own site](https://www.flightapi.io/) states *"You cannot book flights using our API. This API only tracks prices."* Not Google data, not bookable. Skip.
- **Oxylabs / Bright Data** — generic SERP scrapers with no Google Flights parser. You'd build and maintain the extraction yourself. The headline $0.0005/result is misleading for this use case.
- **Zyla / RapidAPI flight aggregators** — resale listings, not primary suppliers; most "Skyscanner API" and "Google Flights API" entries are unofficial scrapers of the very sites whose official programs are closed. Unverifiable; treat as scraper risk.

**One worth a single email:** [KAYAK "Flights Price Insights API"](https://affiliates.kayak.com/apis/travel-data) is a real, genuinely flight-price-focused product (calendar price trends, deals from *"real traveler data"*) offering *"free access to the Sandbox APIs"* via partnerships@kayak.com. No published pricing, rate limits or access criteria — gated by conversation. Worth one email since sandbox access is free, but don't plan around it, and it's unverified whether the insights are bookable-accurate or trend-only.

## Route coverage caveats

Nothing here was empirically tested — that needs live keys, and it is the **first thing to do on the free tiers**.

- **Long-haul EU→PER:** syntactically supported everywhere. But SerpApi explicitly warns that **less-popular airport codes** and **multi-city searches** return incomplete results without `deep_search`. **VLC is exactly that kind of secondary origin** — and our long-haul may start with a ground leg from Valencia anyway, so MAD/BCN are the more likely real origins.
- **Jetstar:** on Google Flights, and live on Duffel via direct connect. Solid.
- **Virgin Australia:** on Google Flights; on Duffel via Travelport. *Not confirmed from a primary Google source.*
- **Rex / Regional Express:** **coverage unverified everywhere, and absent from Duffel.** Rex went through voluntary administration in 2024 and was acquired by Air T in Dec 2025 — distribution feeds go stale exactly through restructures like that. **Assume Rex is unreliable and hand-snapshot any Rex leg.**

**Pre-commitment test (half a day):** run ~10 searches on SearchAPI's free 100 covering MAD→PER, VLC→PER, PER→SYD, SYD→HBA, SYD→CNS and one Rex sector, and diff against google.com/travel/flights in an incognito window. That test answers the coverage and accuracy questions better than any amount of further reading.

## Caching strategy

The design that makes this cheap. Fares don't move meaningfully within a few hours, so "fresh enough" is a matter of hours, not seconds — and the 8s scrape latency means we can't fetch synchronously anyway.

**Cache key:** `origin:dest:departDate:returnDate:cabin:pax`

**Two layers:**
1. **Nightly/twice-daily cron pre-warm** (Vercel Cron) over the ~154-key plausible grid, so the UI is almost always a cache hit and never waits 8 seconds.
2. **Lazy fill on miss** for any date the user toggles to that the grid didn't cover.

**TTLs, differentiated by how much freshness is actually worth:**

| Leg type | TTL | Why |
|---|---|---|
| AU domestic | 6h | Volatile, cheap, and these are what actually move when capsules toggle |
| Long-haul | 24h | Comfort-first, booked once in the ~Oct window — the number is a budget line, not a live decision input |

**Serve stale-while-revalidate:** return the cached price instantly with its `fetched-at`, kick off the refresh in the background. This matches the **Fare snapshot** term already in `docs/CONTEXT.md` — every displayed price carries a fetched-at, live or not, so the UI never has to distinguish "live" from "snapshot" in its rendering.

**Hard budget counter:** track upstream calls per month; when the cap is hit, stop calling and serve snapshots. Never let a toggle-happy afternoon produce a surprise bill.

**Sanity bounds:** reject and fall back to snapshot on any price outside a per-route plausible band (e.g. long-haul EU↔AU outside €600–€4,000). This directly defends against the $80,000-flight failure mode, which is the most likely way live pricing embarrasses the site.

## Estimated monthly cost

| Scenario | Upstream calls/mo | Provider | €/month |
|---|---|---|---|
| Peak planning, twice-daily full grid pre-warm | ~9,200 | SearchAPI Developer | **€34** |
| Peak planning, lazy + nightly pre-warm | ~3,000–4,500 | SearchAPI Developer | **€34** (same tier, headroom) |
| Post-booking / low activity | ~600 | SearchAPI Developer | **€34** (or drop to snapshots, €0) |
| Fallback only | 0 | Snapshots in repo | **€0** |

**€34/month is the answer**, flat, for as long as we want live pricing. It's the entry tier either way — there's no volume-driven cost blowup available at our scale, provided the budget counter is in place. Compare: the same volume on SerpApi is €64–128/month for identical underlying data.

Realistically the site only needs live pricing from now until the long-haul is booked (~October 2026) and through the domestic-leg bookings (into Nov/Dec). **Call it €34 × ~4 months ≈ €136 total**, then downgrade to snapshots. Against a €12,000–20,000 couple budget, that's a rounding error — roughly 0.1% of trip cost — and it is comfortably worth it if it prevents one bad date choice.

## Recommendation

**(a) Live path — SearchAPI.io `google_flights`, €34/month.**
Cheapest credible Google Flights access with a real parser and booking tokens, instant self-serve signup, and a free 100-call trial to validate coverage first. Wrap it in a `FlightPriceProvider` interface from day one so SerpApi or Duffel can be swapped in without touching application logic — the Google lawsuit makes that insurance, not over-engineering.

**(b) Cheap fallback — fare snapshots committed to the repo, €0.**
A JSON file of researched fares per route+date-band with a `fetched-at`, seeded from the free Travelpayouts Data API (using the **v2** endpoints, which return `found_at`/`expires_at` — v3 doesn't) and hand-corrected for thin routes, especially Rex. Pass an explicit `market` or the API quietly serves `ru`-market data. This is the degraded mode when the API errors, the quota is spent, or a returned price fails sanity bounds — and it is what the site runs on after booking is done. The domain model already has the **Fare snapshot** term for exactly this.

**(c) Estimated monthly € at realistic usage: €34/month**, ~€136 for the four months that actually matter.

**Do these two things before spending anything (half a day total):**

1. **Burn SearchAPI's free 100 calls on the real route set** — MAD→PER, VLC→PER, PER→SYD, SYD→HBA, SYD→CNS, one Rex sector — and diff against google.com/travel/flights in an incognito window. This answers coverage and accuracy at once, and it's the only thing that will.
2. **Grab a free Travelpayouts token** and check whether the price cache has any depth on our routes. Costs nothing, and it either gives us the snapshot seed or tells us to hand-research the snapshots instead.

**Two caveats to carry into [#7](https://github.com/kilbot/holidays/issues/7):**

- **Live pricing is worth much less on long-haul than it looks.** The long-haul selection criterion is **comfort-first** — A380, Changi layover, overnight stopover — and none of that is in a price feed. For long-haul the live number is a budget line; the actual choice wants a human looking at Google Flights. Live pricing earns its keep on the **AU domestic legs**, which are what actually move when dates and capsules toggle.
- **Validate before paying.** Spend the free 100 calls on the real route set first. If scraped prices prove unreliable on VLC/MAD→PER, the decision changes — either to Duffel (accurate, bookable, but a ToS mismatch and no Rex) or to snapshots-only, which for a comfort-first, book-once long-haul is a defensible outcome rather than a failure.
