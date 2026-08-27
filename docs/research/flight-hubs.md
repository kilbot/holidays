# Flight hubs: the multi-origin search grid

**Research for [kilbot/holidays#48](https://github.com/kilbot/holidays/issues/48). Researched 2026-08-27; every source below was accessed that day.**

Machine-readable grid: [`flight-hubs.json`](./flight-hubs.json) — 13 European outbound hubs, 7 Australian return
airports, with carriers, via-points, fare bands, and the Valencia positioning feed for each.

This builds on [`longhaul-comfort.md`](./longhaul-comfort.md), which settled *which routing is most comfortable*.
This file settles *which airports the search should cover, and what the positioning legs actually cost*.

---

## Bottom line

**Four hubs genuinely matter: Barcelona, Madrid, Milan Malpensa, Frankfurt.** Everything else is either a
price-discovery probe (Rome, Vienna, Istanbul, Amsterdam), a special-case unlock (London, for the Qantas
nonstop and the BA A380 upper deck, at ~€248 of APD for the couple), or completeness (Paris, Munich, Zurich,
Brussels).

- **Barcelona** — the comfort answer. Only Spanish city with a nonstop to Singapore (SQ387 BCN 12:35 → SIN
  08:25+1, A350-900). But it is **5x weekly, not daily**, it departs at midday, and there is **no flight from
  Valencia at all** — the feed is a 3-hour train. Night before in Barcelona is not a preference, it is
  structural.
- **Madrid** — the flexibility answer, and the only hub where a **protected flight feed from Valencia** exists
  (Iberia = oneworld = same ticket as Cathay or Qatar; Air Europa = SkyTeam = same ticket as China Southern).
  Cathay goes daily HKG–MAD on 25 Oct 2026, and one of its two rotations departs **MAD 22:30** — the only
  long-haul in the grid a same-day 1h56 train can safely feed.
- **Milan Malpensa** — **the correction to the prior research.** `longhaul-comfort.md` §5 says Milan loses its
  Singapore connection on 27 Oct 2026. Only half true: the 3x weekly SIN–MXP–BCN *tag* (SQ377/378) is
  cancelled, but the **SIN–MXP nonstop (SQ355/356) goes from 4x weekly to daily on 25 Oct 2026**. Milan keeps
  **seven** weekly A350-900 nonstops to Changi — more than Barcelona's five — plus year-round Cathay, plus
  Thai. And Ryanair and Wizz both fly Valencia → **Malpensa itself**, not a satellite field. Milan is a
  first-rank hub for this trip.
- **Frankfurt** — the protection answer. **VLC→FRA on Lufthansa + FRA→SIN→PER on Singapore Airlines is one
  ticket, one alliance, bags checked through from Valencia.** It is the only way to reach the comfort-winning
  carrier without either an unprotected train or an unprotected LCC. SQ runs 14x weekly to Frankfurt, the
  densest SQ service on the continent. (Munich and Zurich are the same trick, thinner and dearer.)

Two smaller corrections to the prior file: SQ **Munich** is an increase from 7 to **10 weekly** (not a new 3x
weekly route) — *and it drops back in February 2027*, which matters if Munich is also used for the return. SQ
**Barcelona** goes from 2x to 5x weekly as part of the Madrid tag.

---

## The positioning-arbitrage verdict

The honest arithmetic, for **two people with two checked bags**:

| Cost of getting to the hub | Couple, all in |
|---|---|
| **Barcelona by train + mandatory hotel night** | €50–120 train + €80–140 hotel = **€130–260** |
| **Madrid by train, same day** (feeding the 22:30 Cathay) | €16–110 train, **no hotel** = **€16–110** |
| **Madrid by Iberia on the same ticket** | €90–240 flights, no hotel, **protected** |
| **LCC to Milan/Rome/Vienna + hotel night** | €50–220 fares + **€70–120 hold bags** + €70–140 hotel = **€190–480** |

So the LCC positioning move costs roughly **€60–220 more for the couple than the Barcelona train** — i.e.
about **€30–110 per person**. That is the number a cheaper hub has to beat.

**The rule for the site: a positioning hub wins only if its fare band is at least ~€150 per person below the
Barcelona band.** Below that, the saving is eaten by hold bags, the hotel and the transfer, and paid for with
lost protection.

By that rule:

- **Milan beats Barcelona on paper** — a cheaper origin market (deal-fare anchors put MXP–PER around €667–689
  in shoulder season vs Spain's higher floor), daily rather than 5x weekly SQ, and a same-airport Ryanair/Wizz
  feed. The delta is real but not huge, so Milan wins on *date flexibility* more than on money.
- **Rome is the cheapest same-airport LCC feed in the grid** — Ryanair, Vueling *and* Wizz all fly VLC→**FCO**
  itself. But Cathay is summer-only at Rome, so the carrier set is thinner than Milan's.
- **Vienna is the genuine budget floor and nothing else.** Ryanair VLC→VIE (main airport) + Scoot VIE→SIN→PER
  on one Scoot ticket is the cheapest way two humans can physically get from Valencia to Perth — deal anchors
  around €626 pp. It is also low-cost long-haul: no meals, no bags, 31" pitch, and a 04:15 arrival in Perth.
  It is in the grid so the site can show the floor honestly, not because it should win.
- **Bergamo, Beauvais, Charleroi, Orly, Stansted/Gatwick/Luton, Eindhoven, Rotterdam, Hahn are traps.** They
  are the cheapest fares from Valencia and they all land at the **wrong airport**, adding 50 minutes (BGY→MXP)
  to 2.5 hours (BVA→CDG) of surface transfer. Hahn is worse still — Ryanair's VLC–Hahn is **summer-seasonal
  and does not operate in December**. The search must compare airport-pairs, not city-pairs.
- **London never wins on price.** UK APD on ultra-long-haul economy is £106 pp (~€124, ~**€248 for the
  couple**) from 1 Apr 2026, on top of either an expensive BA feeder or a cross-London coach. Search LHR only
  when the Qantas nonstop or the BA A380 upper deck is specifically wanted.

**The structural point underneath all of this:** the positioning leg's *alliance* matters more than its fare.
Valencia has Star feed (Lufthansa→FRA/MUC, Swiss→ZRH, Austrian→VIE, Turkish→IST), oneworld feed (BA→LHR,
Iberia→MAD) and SkyTeam feed (Air France→CDG, KLM→AMS). Each of those can be a **single PNR** with the
long-haul, which deletes exactly the risk `longhaul-comfort.md` §5 identifies as the real danger — a missed
connection on a sold-out mid-December Perth flight. Ryanair, Wizz, easyJet, Transavia and Vueling can never be.
**Emirates is the one major Perth carrier with neither a Valencia feed nor an alliance** — it is always a
self-connect.

One unverified item worth testing at booking: **Turkish and Singapore Airlines are both Star Alliance**, and SQ
serves Istanbul. VLC→IST (TK, 11x weekly) → SIN → PER (SQ) would be a single ticket departing from Valencia's
own airport with no train and no LCC. Whether it constructs and prices sanely is **[CHECK]** — it is the most
interesting unproven line in the grid.

---

## Overnight practicality, hub by hub

| Hub | Verdict | Why |
|---|---|---|
| **MAD** | **good — often unnecessary** | 22:30 Cathay departure, 25 trains/day, 1h56. Deep airport-hotel supply at T4 if wanted. |
| **FRA / MUC / CDG / LHR / AMS / ZRH / VIE / IST / FCO / BRU** | **good** | In-terminal or walkway hotels (Sheraton T1 at FRA, Hilton in the MAC forum at MUC, Hilton at FCO T3, YOTELAIR airside at IST, NH at VIE). Vienna is the best value; Zurich the worst. |
| **BCN** | **ok — but forced** | Midday SQ departure and no flight from Valencia, so the night before is mandatory. Airport-hotel supply at El Prat is thinner than at MAD/FRA/CDG; the city (20 min by R2 Nord) is cheaper and better. |
| **MXP** | **ok** | Sheraton is inside T1 and the long-hauls all use T1 — fine *if* you position into MXP. Positioning into **BGY** and transferring is **poor**: don't do that leg same-day. |
| **CDG via ORY/BVA**, **LHR via STN/LGW/LTN** | **poor** | A cross-city evening transfer converts a restful night-before into a second travel day and burns the LCC saving in coach fares. |

---

## Return side: what changed

The return grid (SYD / MEL / BNE, plus ADL and CBR) is in the JSON. Three findings worth surfacing:

1. **Turkish is the only itinerary that ends at Valencia airport.** SYD → SIN → IST → VLC, one ticket, one
   airline, A350-900 on the long sectors, bags through, **no train and no positioning flight at either end**.
   Five weekly from Sydney (TK22/23, renumbered from TK174/175 on 26 Oct 2026), three weekly from Melbourne
   (TK168/169). Not available from Brisbane — Turkish does not serve BNE.
2. **Madrid is the only European arrival point that can be through-ticketed home.** BCN→VLC has **no flight on
   any carrier** — it is train or bus, unprotected, always. MAD→VLC on Iberia rides the same oneworld PNR as
   Cathay or Qatar; on Air Europa it rides the same SkyTeam PNR as China Southern.
3. **Two new options and one trap.** Qatar **restores Canberra** (via Melbourne, same aircraft) from 9 Dec
   2026, 4x weekly — CBR is a credible return origin for the first time in years. Singapore Airlines opens
   **Western Sydney (WSI)** daily from 23 Nov 2026, though SQ202 lands SIN 05:05 against a 23:30 SIN–BCN
   departure, forcing an ~18h Singapore layover. The trap: **Qatar's Adelaide–Doha service is seasonal, 16 Jun
   – 14 Sep only** — it does not fly in February, whatever an aggregator suggests. Cathay's Adelaide–Hong Kong
   *is* in season (11 Nov – 27 Mar, Wed/Fri/Sun). **Gold Coast (OOL) is excluded entirely**: its only long-haul
   is AirAsia X to Kuala Lumpur, which has no European network.

February is the cheapest month of the year ex-Australia (aggregator average Sydney–Spain €804 in February vs
€1,344 in December), so the return is where a wide multi-origin search pays off most.

---

## Fare bands: read them as rankings, not quotes

Every `typicalDecBandEurPP` / `typicalFebBandEurPP` in the JSON is an **[ESTIMATE]** — synthesised from the
aggregator route averages already captured in `longhaul-comfort.md` §7 (MAD–PER typical €1,263–5,709; BCN–PER
typical €954–3,672) and adjusted for origin-market price level. They are calibrated to rank hubs against each
other. They are **not** live quotes and must not be presented as prices.

Two things the bands deliberately exclude and the site must add before comparing: **LCC hold-bag fees** (~€35–60
each way per bag on peak December dates — material for two people with two 23kg cases) and **UK APD** (€124 pp
on any LHR ultra-long-haul economy ticket).

---

## Sources

All accessed **2026-08-27**. Airline and airport primary sources first.

**Route and schedule (primary):**
- [Malaysia Aviation Group — Europe flights, March 2026](https://malaysiaaviationgroup.com.my/en/MAG-media-centre/news-releases/2026/additional-europe-flights-march-2026.html) — MH's European network is LHR and CDG only
- [Singapore Airlines — Madrid launch / Europe expansion, Oct 2026](https://www.singaporeair.com/en_UK/gb/corporate/newsroom/press-release/2026/april---june-2026/Europe_Madrid_October/)
- [Cathay Pacific — Madrid daily + Iberia codeshares](https://news.cathaypacific.com/cathay-pacific-expands-its-latin-america-coverage-via-madrid-with-new-iberia-codeshares)
- [Emirates — Dubai to Perth](https://www.emirates.com/english/destinations/dxb/per/flights-from-dubai-to-perth/) — 7x weekly, 777
- [Vietnam Airlines — Ho Chi Minh City to Perth](https://www.vietnamairlines.com/en-vn/flights-from-ho-chi-minh-city-to-perth) — 3x weekly Mon/Thu/Sat
- [Aena — Ryanair at Valencia Airport](https://www.aena.es/en/valencia/airlines/ryanair.html)

**Schedule tracking:**
- [AeroRoutes — Singapore Airlines NW26 Europe service changes](https://www.aeroroutes.com/eng/260508-sqnw26eu) — the Milan/Munich/Barcelona corrections
- [AeroRoutes — Cathay Pacific increases Madrid service from late Oct 2026](https://www.aeroroutes.com/eng/260629-cxnw26mad) — CX372 MAD 11:25, CX298 MAD 22:30

**Network reference:**
- [Valencia Airport — airlines and destinations](https://en.wikipedia.org/wiki/Valencia_Airport) — the positioning-feed table; confirms no VLC–BCN service
- [FlightConnections — flights from Valencia (VLC)](https://www.flightconnections.com/flights-from-valencia-vlc) — monthly frequency per hub; BCN at zero
- [List of Cathay Pacific destinations](https://en.wikipedia.org/wiki/List_of_Cathay_Pacific_destinations) — Milan year-round, Rome/Barcelona seasonal
- [List of Thai Airways destinations](https://en.wikipedia.org/wiki/List_of_Thai_Airways_International_destinations)
- [Brisbane Airport — airlines and destinations](https://en.wikipedia.org/wiki/Brisbane_Airport)
- [FlightConnections — Vienna to Singapore](https://www.flightconnections.com/flights-from-vie-to-sin) — Scoot 4x weekly, sole operator
- [Flightmapper — Scoot SIN–PER](https://info.flightmapper.net/route/Scoot_TR_SIN_PER) — TR28 SIN 23:00 → PER 04:15 daily from 25 Oct 2026

**Trade press:**
- [Business Traveller — Turkish Airlines Istanbul–Sydney via Singapore](https://www.businesstraveller.com/news/turkish-airlines-sydney-singapore-route/) — TK22/23, 5x weekly A350-900
- [Mainly Miles — Turkish launching Singapore–Sydney](https://mainlymiles.com/2026/08/06/turkish-airlines-launching-singapore-sydney-flights/) — 26 Oct 2026 – 27 Mar 2027
- [The MileLion — SQ launching Western Sydney from November 2026](https://milelion.com/2026/03/25/singapore-airlines-launching-flights-to-western-sydney-airport-from-november-2026/) — SQ201/202, 2-class A350-900
- [Simple Flying — Cathay's 11th European destination (Munich)](https://simpleflying.com/cathay-pacific-flights-new-european-destination-munich/)
- [Simple Flying — Australia–Middle East routes 2026](https://simpleflying.com/australia-middle-east-routes-23-daily-flights-2026/) — Etihad SYD 2x daily / MEL 1x daily, no BNE
- [Simple Flying — Scoot cuts Gold Coast–Singapore](https://simpleflying.com/scoot-cut-gold-coast-singapore-flights/)
- [Executive Traveller — Thai resumes daily Perth–Bangkok](https://www.executivetraveller.com/news/thai-airways-perth-bangkok-flights) — TG481 BKK 07:20 → PER 15:05, 787-9
- [Travel Weekly AU — China Southern as a gateway to Europe](https://travelweekly.com.au/uncovering-china-as-a-gateway-to-europe-with-china-southern-airlines/) — the CAN–Europe list
- [RAA SA Move — direct international flights from Adelaide](https://samove.raa.com.au/direct-international-flights-from-adelaide/) — CX ADL–HKG 11 Nov – 27 Mar
- [Travel And Tour World — Qatar resumes Adelaide–Doha June 2026](https://www.travelandtourworld.com/news/article/qatar-airways-resumes-direct-flights-from-adelaide-to-doha-in-june-2026-a-comprehensive-guide-to-what-australian-travelers-need-to-know-about-the-return-of-this-key-air-route-connecting-australia-and/) — seasonal 16 Jun – 14 Sep, the February trap
- [Nomad Lawyer — Qatar restores Canberra via Melbourne](https://www.nomadlawyer.org/qatar-airways-canberra-boeing-777-300er-melbourne-doha-route-2026) — from 9 Dec 2026, 4x weekly

**Fare anchors (aggregator / deal data — [ESTIMATE] only):**
- [Secret Flying — European cities to Perth from €626](https://www.secretflying.com/posts/european-cities-to-perth-australia-from-only-e626-roundtrip/) — Vienna €626–630, Milan €667–689, Rome €690–693, shoulder season
- [Omio — Valencia to Bergamo](https://www.omio.com/flights/valencia/bergamo-m6sln) — Ryanair VLC–BGY from ~€19

**Unverified / to check at booking:**
- Whether a VLC–IST–SIN–PER single Star Alliance ticket (TK + SQ) constructs and prices
- SQ's Milan and Rome departure times for December 2026 (only the cancelled MXP tag's 12:25 is on record)
- Cathay's Madrid aircraft assignment (A350-900 shown, confirmation promised by September 2026)
- Thai's Amsterdam resumption date — "late 2026", must be flying by mid-December to count
- Vietnam Airlines' Europe–Perth connections: they may route via Hanoi rather than Ho Chi Minh City on the
  needed days, silently becoming a two-stop
- Cathay's Adelaide season dates repeating for 2026–27
