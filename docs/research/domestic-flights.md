# Australian domestic flights & pricing — Dec 2026 – Feb 2027

Research for [issue #4](https://github.com/kilbot/holidays/issues/4). Feeds the site's **Fare snapshot** data for domestic **Legs**.

**Researched:** 26 August 2026. All source URLs carry an access date in [Sources](#sources).
**Currency:** prices are **AUD, one-way, economy, per person** unless stated otherwise.
**FX rate used: A$1 = €0.61** (AUD/EUR 0.6136 on 25 Aug 2026, exchange-rates.org). EUR figures are rounded to the nearest €5. A$100 ≈ €61; €100 ≈ A$164.

> **Confidence.** No live fare quotes for Dec 2026 / Jan 2027 dates could be pulled — Google Flights, Kayak and Trip.com all block automated dated searches, and the trip is still ~4 months out. Every band below is **modelled** from (a) route-level averages published by aggregators in Aug 2026, (b) the Compare the Market / Timeout Dec-2025 peak-day dataset, and (c) live airline sale fares posted 22–25 Aug 2026. Bands are deliberately wide. Treat them as planning envelopes, not quotes, and re-snapshot in **late Sep / Oct 2026**, which is also the right time to actually book (see [Booking curve](#booking-curve)).

---

## 1. Headline: PER→SYD between Christmas and NYE

**This is the single most expensive domestic Leg of the trip, and the one with the least flexibility.**

| | AUD pp | EUR pp | AUD couple | EUR couple |
|---|---|---|---|---|
| **Plan on** | **A$500** | **€305** | **A$1,000** | **€610** |
| Realistic band | A$400–700 | €245–425 | A$800–1,400 | €490–855 |
| Jetstar Starter, booked early | A$300–450 | €185–275 | A$600–900 | €365–550 |
| Booked inside 3 weeks / Qantas flex | A$800–1,200 | €490–730 | A$1,600–2,400 | €975–1,465 |

**Why these numbers:**

- **Sale floor.** Live Aug-2026 sales (travel Sep 26 – Jun 27, peak dates excluded) put PER↔SYD one-way at **Jetstar A$193 / Virgin A$279 / Qantas A$299**. That is the route's genuine floor with no holiday demand on it.
- **Route average.** December is the dearest month on PER–SYD every year: A$644 average *return* (A$407–642 spread) vs A$479 in May; Trip.com's rolling data has December one-ways averaging A$285 and returns A$949. Those averages smear the cheap first fortnight of December in with Christmas week, so the last week sits well above them.
- **Peak-day multiplier.** The best day-level Australian dataset (Dec 2025) shows Christmas-week fares running **3–4.5× the early-December floor** — SYD→CNS went from A$104 in the first week of December to **A$455 on 27 December, +77%** on the cheapest-available fare. MEL→PER's dearest December day was A$1,958 and BNE→PER's A$1,970 (top-of-market, i.e. what's left when cheap inventory is gone).
- **Press guidance.** Compare the Market / Timeout name **20–22 Dec and 26–29 Dec** as the priciest days of the year, with Sydney/Melbourne→Perth "more than $300" on those dates — a conservative floor, not the typical fare.
- **Independent band.** ShopBack's seasonal guide puts Sydney–Perth at **A$400–700 peak**, A$200–380 off-peak, A$149–229 at its cheapest. That matches the reconstruction above and is the band adopted here.

### Which day in the 25–31 Dec window is cheapest

The window is uniformly bad; the differences are second-order. Ranked cheapest → dearest for a PER→SYD departure:

| Departure | Relative cost | Note |
|---|---|---|
| **25 Dec (Christmas Day)** | cheapest by a wide margin | Rules itself out — Christmas is the Perth Anchor. Only viable if the family Christmas is lunch-only and they fly the evening of the 25th; the last PER departure is **23:55**, so an evening-of-Christmas red-eye is genuinely available and genuinely cheap. |
| **26 Dec (Boxing Day)** | high, but the best of the realistic options | Boxing Day is the front edge of the peak. Morning departures price better than afternoon. |
| **30 Dec** | high | Post-peak-outbound lull hasn't arrived yet; NYE inbound demand into SYD is building. |
| **31 Dec (NYE)** | high, and operationally risky | A 4-hour transcon plus a 3-hour time change on NYE itself leaves no margin for a delay. Not recommended for a hard Anchor. |
| **27–29 Dec** | **worst** — named peak days in every dataset | Avoid. |

**Recommendation for the Plan:** default to **26 Dec**, red-eye or early morning, with **25 Dec evening** offered as the cheap-but-brutal alternative. Model the 27–29 Dec option at the top of the band so the site shows the penalty.

### Carriers, red-eyes and coverage

Nonstop PER–SYD: **Qantas, Virgin Australia, Jetstar** — ~68 flights/week, ~10 per day, 4h05–4h20 eastbound. (Rex is not a factor: its 737 inter-capital network was killed in the 2024 administration and it now flies Saab 340 regionals only under US owner Air T.)

| Carrier | Position on this route | Christmas-week behaviour |
|---|---|---|
| **Jetstar** | Cheapest by a wide margin on transcon — A$80–120 below VA/QF on east-coast↔Perth in the Aug-2026 sale. A320/A321. | Thin peak inventory: cheap Starter buckets sell out first, so the Jetstar advantage shrinks most in exactly this week. Book earliest. |
| **Virgin Australia** | Mid. 737-8/-10 and some 737-MAX. Best on-time performance on the route (92%). | Choice fare (bag + seat included) is often within A$50 of a Jetstar Starter + bag on this leg. |
| **Qantas** | Dearest, most frequent, widest schedule including A330 and 787-9 rotations (real seats, real service on a 4h sector). | Holds inventory latest — the fallback if JQ/VA sell out, at a price. |

**Red-eyes exist and are the cheapest slot.** PER departures run 00:50 through 23:55; the last service leaves Perth **23:55 and lands Sydney 06:15**. Eastbound overnight is the "easy" direction (you lose 3 hours, so a 23:55 departure is only ~4h in the air but delivers you at dawn). This is the single biggest lever on this Leg — worth A$80–150 pp against a mid-morning departure, and it saves a hotel night.

### How early to book

**Book PER→SYD Christmas week by late September / early October 2026.** Generic advice for this route is ~57–68 days out, but that is optimised for ordinary weeks. For Christmas–New Year the guidance is consistently **8–12 weeks ahead**, and specifically **book in September–October for A$250–450 returns**. Australian domestic fares do *not* have a late-drop pattern — inventory is bucketed and only ever ratchets up as cheap buckets sell. Inside two weeks, prices spike hard.

**Practical rule for the site:** show a "book by" date of **1 Oct 2026** on this Leg, and escalate the modelled price ~15% per month after that.

---

## 2. Per-leg price bands (seed data)

One-way, economy, per person. EUR at 0.61. "Sale/low" = a real sale fare or the route's observed floor; "Typical" = what to budget; "Peak" = school-holiday / event dates or a late booking.

| # | Leg | Carriers (nonstop) | Time | Sale/low A$ | **Typical A$** | Peak A$ | **Typical €** | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | **PER→SYD, 26–31 Dec 26** | JQ, VA, QF | 4h10 | 300 | **400–700** | 800–1,200 | **€245–425** | The critical Leg. Plan A$500 / €305. Red-eye cheapest. Book by 1 Oct. |
| 2 | PER→SYD, off-peak | JQ, VA, QF | 4h10 | 193–299 | 250–380 | 400–700 | €155–230 | Aug-26 sale: JQ 193 / VA 279 / QF 299. |
| 3 | PER→MEL, off-peak | JQ, VA, QF | 4h10 | 183–280 | 240–360 | 400–650 | €145–220 | ~41 flights/day, 3 carriers. Dec avg return A$585. |
| 4 | PER→BNE, off-peak | JQ, VA, QF | 5h05 | 199–300 | 260–400 | 450–700 | €160–245 | Fewer frequencies than PER–SYD/MEL. |
| 5 | **SYD→HBA (Hobart), Jan** | QF (20/wk), JQ (14), VA (14) | 1h50 | 89 | **130–220** | 250–400 (2–12 Jan) | **€80–135** | Jan avg return A$215. |
| 6 | SYD→LST (Launceston), Jan | JQ (7/wk), QF (6), VA (5) | 1h47 | 78 | 110–190 | 220–350 | €67–116 | Consistently ~A$20–40 under Hobart. |
| 7 | MEL→HBA, Jan | QF (27/wk), JQ (26), VA (24) | 1h15 | 79 | 105–175 | 200–320 | €64–107 | ~77 nonstops/wk. ~20% under SYD–HBA. |
| 7b | MEL→LST, Jan | QF (24/wk), VA (20), JQ (19) | 1h14 | 57 | 90–150 | 180–290 | €55–92 | Cheapest way into Tasmania. |
| 8 | **SYD→CNS (Cairns), Jan** | JQ, VA, QF | 3h10 | 89–129 | **150–220** | 280–400 (1–10 Jan) | **€90–135** | ~29 flights/day. Jan is the *cheapest* month on this route (A$265 avg return vs A$365 in Dec). |
| 9 | MEL→CNS, Jan | JQ, VA, QF | 3h25 | 99–139 | 160–230 | 300–420 | €98–140 | Avg return A$342. |
| 10 | BNE→CNS, Jan | JQ, VA, QF | 2h25 | 59–99 | 110–160 | 200–300 | €67–98 | Cheapest reef access by far. Avg return A$254; Jan A$193. |
| 11 | SYD→PPP (Whitsunday Coast) | JQ | 2h30 | 94 | 150–210 | 260–350 | €90–130 | ~1/day. Cheaper Whitsundays gateway. |
| 12 | BNE→PPP | JQ, VA | 1h45 | 81 | 130–180 | 220–300 | €80–110 | ~4/day. |
| 13 | SYD→HTI (Hamilton Is.) | QF, VA (+ some JQ) | 2h30 | 134 | 200–270 | 320–430 | €120–165 | QF/VA duopoly; ~A$50–90 pp each way above PPP. |
| 14 | BNE→HTI | QF, VA | 1h50 | 124 | 180–250 | 290–390 | €110–153 | 5/day. |
| 15 | SYD↔MEL positioning | JQ, VA, QF | 1h30 | 53–119 | 110–180 | 200–400 | €67–110 | Aug-26 sale: JQ 77 (MEL) / 53 (Avalon), VA 105, QF 119. |
| 16 | SYD↔BNE positioning | JQ, VA, QF | 1h30 | 64–119 | 100–170 | 180–360 | €61–104 | Aug-26 sale: JQ 64 (to Western Sydney), VA 105, QF 119. |
| 17 | MEL↔BNE positioning | JQ, VA, QF | 2h15 | 89–119 | 120–190 | 200–380 | €73–116 | |

**Return legs price the same as outbound** (see [One-way pricing](#one-way-pricing)) — just double the one-way band, adjusting for the date's own seasonality.

---

## 3. PER↔east coast outside the Christmas peak

If the couple reroute (e.g. leave Perth in early December, or return west later), the transcon gets much cheaper:

- **Sale-fare floor** (Aug-2026 sale, travel Sep 26 – Jun 27): PER↔SYD **A$193 JQ / A$279 VA / A$299 QF**; PER↔MEL **A$183 / A$279 / A$299**; PER↔BNE **A$199 JQ**.
- **Jetstar's advantage is largest on transcon** — A$80–120 under Virgin and Qantas on east-coast↔Perth routes, versus A$20–40 on the short east-coast hops. On a 4-hour sector that matters both ways: it's the biggest saving *and* the least comfortable seat.
- **Cheapest months** on PER–SYD are May (A$479 avg return) and February (A$407–459); **February 2027 transcon is cheap** if any Perth backtrack lands then.
- **Early December is a genuine bargain window**: 3–5 Dec and 10–13 Dec were the cheapest 2025 dates nationally, with BNE→PER as low as **A$254** and MEL→PER **A$242** on the cheapest December days.
- No meaningful saving from routing PER→MEL→SYD instead of PER→SYD nonstop: the MEL–SYD leg adds A$110–180 typical and the transcon leg isn't discounted enough to cover it. Only worth it if Melbourne is a stop they want anyway.

---

## 4. Tasmania: flights vs the Spirit of Tasmania ferry

### Flying (the recommended option)

**Qantas, Jetstar and Virgin all fly Sydney and Melbourne nonstop to both Hobart and Launceston.** Rex does not — it grounded its 737s and cancelled Hobart services indefinitely; passengers were moved to Virgin, and the jet network has not returned.

| Route | Weekly nonstops | Time | Jan avg return A$ | Cheapest one-way A$ |
|---|---|---|---|---|
| SYD–HBA | QF 20, JQ 14, VA 14 | 1h50 | 215 | 89 |
| SYD–LST | JQ 7, QF 6, VA 5 | 1h47 | 173 | 78 |
| MEL–HBA | QF 27, JQ 26, VA 24 | 1h15 | 173 | 79 |
| MEL–LST | QF 24, VA 20, JQ 19 | 1h14 | 137 | 57 |

**Melbourne is materially cheaper than Sydney — about 20%** on both Tasmanian airports. **Launceston is cheaper than Hobart** from both origins. Neither gap is large enough to reroute the itinerary for, but if the Plan happens to pass through Melbourne, run the Tasmania Capsule from there.

**Watch the January split.** Aggregators report January as the "cheapest month" on these routes; that is an annual average blending an expensive first fortnight with a cheap last one, and **must not be shown as an early-January price**. Early January is Tasmania's hardest peak: summer school holidays, the Sydney–Hobart fleet in port, and the Cygnet Folk Festival. (An earlier draft also cited MONA FOMA and Falls Festival Marion Bay — both defunct: MONA FOMA ended Feb 2024, Falls left Tasmania in 2021; see `capsule-tasmania.md`.) Budget the **A$250–400 peak band for 2–12 Jan** and the A$130–220 typical band from about the third week.

**Cross-check on fare families** (Melbourne origin, *return* prices, Jul 2026): Jetstar Starter A$130–220 → Starter Plus A$180–310; Virgin Getaway A$200–340 → Choice A$240–400; Qantas Red e-Deal A$260–450 → Flex A$380–700. Note how much the bag-inclusive tier costs: **Starter → Starter Plus is +A$50–90 return**, which is the honest price of flying Jetstar with luggage. Book **3–8 weeks out**; on SYD–HBA, booking ~5 weeks ahead saves ~33% versus last-minute.

### The Spirit of Tasmania ferry (Geelong ↔ Devonport)

**Route and timing.** Sails from **136 Corio Quay Road, North Geelong** — *not* Melbourne; the service moved from Port Melbourne in late 2022. Crossing is **9.5–11.5 hours**, roughly **13 hours door to door**. Check-in opens 1.5–2.5h before departure and **closes strictly 45 minutes prior**.

**January 2027 schedule.** The new ships **Spirit of Tasmania IV and V enter service from late October 2026** (1,800 passengers, 4,000 m of vehicle lanes, 18 pet-friendly cabins each). Current indications are that **all summer 2026/27 sailings depart 18:45 in both directions, with no daytime alternative** — day sails may be added later if large-vehicle demand exceeds capacity. Historically the night sail departing 18:45 arrives 06:00 and a 22:00 departure arrives 08:30, with day sails running September–April only. *Treat the no-day-sail position as current-but-volatile — verify at booking.*

**Fares** (one-way, AUD; peak season adds **25–50%** over base):

| Item | One-way range | Notes |
|---|---|---|
| Adult passenger | A$69–289 | Peak = top of range. Pensioner A$59–224, child A$35–132 |
| Standard car (<6 m) | A$179–377 | Larger vehicles A$215–452 |
| Inside 4-berth cabin | A$159–179 | |
| Porthole 4-berth / twin | A$209–229 | |
| Deluxe queen | A$369–499 | |
| Recliner | **free** on overnight sailings | Charged on day sails |
| **Fuel surcharge** | **+15% of total booking** | Applied to all bookings made from 31 Mar 2026. Adds ~A$150–200 to a car crossing |
| Booking fee | A$0 online / A$10 pp each way by phone | Book online |

**Realistic peak totals:** foot passenger **return** A$300–400 pp; **2 adults + a small car + inside cabin, night sail, return: A$1,200–1,600** — plus the 15% fuel surcharge on top, so call it **A$1,400–1,850 (€855–1,130)** for the couple. RACV/RACT/NRMA/RACQ members get 10% off passenger fares. For scale, the off-peak floor is far below this: a Sep–Oct 2026 sale offered adult fares A$50, cabins A$125 and a car A$50 one-way.

**Booking pressure.** Peak is **mid-December to late January**. The booking window is 11 months rolling and peak school-holiday sailings fill fast even with the new ships' extra capacity. **For a January 2027 crossing with a vehicle, book by ~September–October 2026.**

**Getting to the terminal.** From Melbourne CBD it's ~70 km, **allow an hour or more** by car. Foot passengers: V/Line from Southern Cross to Geelong / North Geelong (~1h13m, A$4–7), then the MyBus shuttle to Spirit of Tasmania Quay (**A$25 pp one-way, minimum 3 passengers, book 48h ahead**). Undercover paid parking at the terminal.

### Verdict for this trip: fly

For a couple coming **from Sydney**, the ferry is not a real alternative:

| | Fly SYD↔HBA, hire a car in Tasmania | Ferry from Geelong |
|---|---|---|
| Transport cost, couple, return | **A$520–880** (€315–535) bag-inclusive | **A$1,400–1,850** (€855–1,130) incl. fuel surcharge |
| Time each way | ~1h50 in the air | ~13h door-to-door, **plus** getting from Sydney to Geelong first |
| Prerequisite | none | a car you already have on the mainland |

The ferry's whole economic case is bringing **your own vehicle**. This couple's mainland car is a borrowed family car in **Perth** — 3,400 km away and on the wrong side of the continent. Flying in and renting locally in Tasmania is cheaper, and saves roughly two days of travel time each way.

**Keep the ferry in the model as a togglable option only** for the scenario where the Plan already includes a Melbourne leg with a hire car, and the couple want a self-drive Tasmania Capsule without a second rental agreement. Otherwise: **fly to Hobart or Launceston, rent in Tasmania.**

---

## 5. Great Barrier Reef access

**Two gateways, materially different economics.**

**Cairns (CNS)** — the default. Qantas, Jetstar and Virgin all fly nonstop from Sydney, Melbourne and Brisbane on 737/A320-family metal. SYD–CNS runs ~29 flights a day across the three carriers.

**Whitsundays** — two airports:
- **Proserpine / Whitsunday Coast (PPP)** — Jetstar from SYD (~1/day) and MEL, Jetstar + Virgin from BNE (~4/day). Cheaper, more low-fare inventory, but you're then 40 min from Airlie Beach.
- **Hamilton Island (HTI)** — Qantas and Virgin (Jetstar on some rotations), ~42 flights/week. A duopoly, and it prices like one: **A$50–90 per person each way above PPP** on average. You land on the island itself.

**January is the *cheap* time to fly to Cairns, and this is the useful surprise of this research.** Far North Queensland's January is wet season and stinger season (box jellyfish and Irukandji, Oct–May — swimming only in netted enclosures or a full lycra stinger suit), which makes it the **low tourist season** despite being the middle of the school holidays. The fare data agrees: January is literally the cheapest month of the year on both SYD–CNS (A$265 avg return vs A$365 in December) and BNE–CNS (A$193 vs A$321).

**But the month splits in two.** Roughly 1–26 Jan is Australian summer school holidays; the first ~10 days carry New Year return traffic and price like peak (the A$280–400 band in the table). Fares fall sharply from about **the third week of January**. A reef Capsule placed **~12–24 Jan** is significantly cheaper than one placed 2–10 Jan — worth surfacing as a nudge in the itinerary UI.

**Routing note:** BNE→CNS is the cheapest reef leg on the board (A$110–160 typical, A$59 at sale). If the Plan already ends in Brisbane, the reef Capsule costs roughly half what it costs staged from Sydney.

---

## 6. Final departure city: SYD vs MEL vs BNE

**It does not materially change the Europe-bound fare. Pick the city on itinerary logic, not on airfare.**

February return economy averages, Australia → London (Aug 2026 aggregator data):

| From | Feb avg return A$ | Annual avg return A$ | December avg return A$ |
|---|---|---|---|
| Sydney | **1,531** | 1,810 | 2,466 |
| Melbourne | **1,495** | 1,724 | 2,317 |
| Brisbane | **1,564** | 1,804 | 2,465 |

**A$69 spread across the three cities on a return** — about A$35 one-way, or €21. To Madrid the ranking actually *flips* in Brisbane's favour (Feb: BNE A$952, SYD A$1,205, MEL A$1,348), which is noise from carrier promos rather than a structural gateway effect. Valencia is a 2–3-stop market (~39h) and runs roughly **A$100–250 above Madrid** from any Australian city.

**Late Jan – mid Feb is the annual low season for Australia→Europe** — February is the cheapest month from five of six city-pairs checked, running **35–40% below the December peak** (A$1,495–1,564 vs A$2,317–2,466). For contrast, a Dec 22 – Jan 5 Sydney–London return averaged **A$2,468**. The couple's late-Jan / mid-Feb return window is therefore about as cheap as Australia→Europe ever gets. This is worth stating on the site: leaving *after* Australia Day is a real saving over leaving in December, and stretching to February is better still.

**Carrier coverage:** Emirates (via DXB) 3× daily SYD, 3× MEL, 2× BNE; Qatar (DOH) daily SYD, 2× MEL, daily BNE; Etihad 2× daily SYD, daily MEL, **none from BNE** (route terminated); Singapore Airlines, Cathay (HKG), Qantas, BA and China Southern/Eastern all serve Brisbane, which has ~30 international carriers. **Brisbane is thinner on frequency, not on price.** For the **Comfort-first** criterion (A380s, Changi as the layover), Sydney and Melbourne have the deeper A380 and Singapore Airlines schedules — that, not the fare, is the reason to prefer them.

**Don't fly a positioning leg to chase a cheaper gateway.** A A$69–150 gateway saving is wiped out by a A$150–250 domestic positioning fare, plus baggage, plus an overnight, plus the missed-connection risk of a separate ticket. Only fly the domestic leg if it's already part of the itinerary — in which case depart from wherever the itinerary already ends.

---

## 7. How Australian domestic fares behave

### One-way pricing

**Australian domestic fares are one-way priced. A return is simply two one-way fares added together — there is no round-trip discount.** Point Hacks puts it plainly: "There's usually nothing to save by booking a round-trip domestic itinerary as opposed to two one-way flights." Return domestic fares as a fare product have not existed in Australia for years.

**Consequences for the site's cost model:**
- Model every domestic Leg **independently, one-way**. Never apply a return discount.
- Each Leg can freely use a different carrier — mix Jetstar out and Qantas back with no penalty.
- Date changes on one Leg don't reprice the other.
- The only real cost of splitting into two bookings is a doubled cancellation fee (Qantas 6,000 points *per booking*; Virgin 4,500 points or A$35 per reward booking) — immaterial at this scale.

### Fare classes and baggage (what to actually model)

The couple will have checked bags. Headline fares are almost always the no-bag fare, so **model bag-inclusive fares or the site will understate every Leg**.

| Carrier | Base fare | Checked bag | What to model |
|---|---|---|---|
| **Jetstar** | Starter — carry-on 7 kg only | **Not included.** ~**A$45 for 15 kg** prepaid online at booking; ~**A$120 for 20 kg** if added at the airport | Headline fare **+ A$45–70 pp per Leg**. |
| **Jetstar** | Starter Plus | 20 kg included | Often within A$10–20 of Starter + prepaid bag; simpler to model. |
| **Jetstar** | Starter Max | 30 kg included | Overkill for this trip. |
| **Virgin Australia** | Economy Lite | **Carry-on only** | Adding a bag costs from **A$67** online domestic — usually dearer than just buying Choice. |
| **Virgin Australia** | Economy Choice | **23 kg + seat selection included** | **The right Virgin fare to model.** |
| **Qantas** | Economy (base, domestic) | **23 kg included** | Model headline fare as-is. |

**Practical effect:** the Jetstar/Virgin gap narrows sharply once bags are in. On a short hop (SYD–MEL) a Jetstar Starter + bag lands within ~A$20 of a Virgin Choice, and Virgin/Qantas are the better buy. On a 4-hour transcon (PER–SYD) Jetstar still wins on price by A$60–100 even after bags — but on an overnight red-eye, the A$60 is worth spending on Virgin or Qantas.

**Rule for the site:** default all bands to bag-inclusive. Where a Jetstar Starter fare is quoted, add **A$45 pp per Leg** before display.

<a id="booking-curve"></a>
### The booking curve — fares ratchet up, they don't drop

Australian domestic pricing is **bucketed inventory, not a yield curve that softens**. Cheap buckets sell and the price steps up; it essentially never comes back down. There is **no late-drop pattern** to wait for, and inside ~2 weeks fares spike hard. This is the opposite of the intuition many European travellers have about last-minute deals.

| Travel period | Book | Notes |
|---|---|---|
| Off-peak (Feb–Mar, Nov) | 4–8 weeks out | 4–6 weeks is the observed sweet spot; saves ~A$40 vs booking 6 months out. |
| School holidays | **8–12 weeks out** | |
| **Christmas – New Year** | **September–October** | The stated window for A$250–450 returns. **This is now.** |
| Under 10 days out | — | Unpredictable, usually bad. |

Route-specific optimum on PER–SYD is quoted at **~57 days** (Cheapflights) or **~9 weeks** (Kayak, saving ~29% vs last-minute) — but that's tuned for ordinary weeks and should be ignored for the Christmas Leg.

### Sale windows

Major sales run several times a year and are the cheapest way to buy. A **three-airline sale ran 22–25 Aug 2026** (Jetstar "Get Onboard", Virgin "Getaway Sale", Qantas "Australia Red Tail Sale") with travel windows reaching **Sep 2026 – Jun 2027** (Qantas the longest, to Aug 2027). Jetstar was cheapest on every shared route.

Two things to know:
1. **Sale fares almost always blackout the Christmas–New Year peak.** A sale will not solve leg #1.
2. **Sale travel windows do cover January and February 2027**, so the Tasmania, reef and long-haul-positioning Legs *are* addressable by a sale. Watch for the next round — the recurring cheap-fare mechanics are Jetstar's Friday Frenzy (Friday afternoons), Virgin's Happy Hour, and Qantas Red e-Deal sale rounds. *(Sale cadence not independently source-verified in this pass — treat as directional.)*

### Day-of-week and time-of-day

- **Tuesday–Thursday departures run A$20–60 below Friday/Sunday.** Sunday and Monday are consistently the priciest days.
- Shifting a long-weekend trip by 1–2 days saves **A$60–120 per person**.
- **Early-morning and late-night/red-eye departures are consistently the cheapest slots**, on every route and in every dataset. On the transcon Legs this is the single biggest controllable saving.
- On PER–SYD specifically, Monday departures run ~6% below Friday, and morning departures have materially fewer delays than afternoon ones.

### Seasonality summary for this trip

| Window | Domestic fare level |
|---|---|
| Early Dec 2026 (1–15) | **Cheap** — nationally the best December dates |
| 20–22 Dec | Peak |
| **26–29 Dec** | **Worst of the year** |
| 30 Dec – 10 Jan | High (New Year return traffic) |
| ~12–24 Jan | **Falling** — best value inside the school holidays |
| 23–26 Jan (Australia Day) | Bumps up around the long weekend; Fri/Sun worst |
| Late Jan – Feb 2027 | **Cheap** — school holidays end, February is a cheapest-month nationally |

Model this as a per-date multiplier on the base band rather than as fixed prices — it's the shape the site needs, and it will still be right if the absolute levels drift.

---

## 8. What to seed the site with

1. **One-way Legs only.** No return discount anywhere in the domestic cost model.
2. **Bag-inclusive prices.** Add A$45 pp to any Jetstar Starter quote before display.
3. **A date multiplier** over the seasonality table above, applied to each Leg's typical band.
4. **A "book by" date per Leg** — 1 Oct 2026 for PER→SYD, ~8 weeks out for everything else — and a warning that Australian domestic fares only ever go up.
5. **A red-eye toggle** on the transcon Legs, worth roughly −A$80–150 pp.
6. **The Spirit of Tasmania as a non-default toggle** on the Tasmania Capsule — priced as a couple + car + cabin return with the 15% fuel surcharge, and carrying a 13h-each-way duration so the site shows the time cost honestly.
7. **Re-snapshot in late September 2026**, when live Christmas-week fares will be visible and the booking decision has to be made anyway.
8. **Convert at A$1 = €0.61**, stored as a single configurable rate so the whole model reprices when the rate moves.

---

## Sources

All accessed **26 August 2026**.

**Fare aggregators (route-level averages)**
- Cheapflights AU — [Perth→Sydney](https://www.cheapflights.com.au/flights-to-Sydney/Perth/), [Melbourne→Perth](https://www.cheapflights.com.au/flights-to-Perth/Melbourne/), [Sydney→Cairns](https://www.cheapflights.com.au/flights-to-Cairns/Sydney/), [Melbourne→Cairns](https://www.cheapflights.com.au/flights-to-Cairns/Melbourne/), [Brisbane→Cairns](https://www.cheapflights.com.au/flights-to-Cairns/Brisbane/), [Sydney→Hamilton Island](https://www.cheapflights.com.au/flights-to-Hamilton-Island/Sydney/), [Melbourne→Hamilton Island](https://www.cheapflights.com.au/flights-to-Hamilton-Island/Melbourne/), [Brisbane→Hamilton Island](https://www.cheapflights.com.au/flights-to-Hamilton-Island/Brisbane/), [Sydney→Proserpine](https://www.cheapflights.com.au/flights-to-Proserpine/Sydney/), [Brisbane→Proserpine](https://www.cheapflights.com.au/flights-to-Proserpine/Brisbane/), [Sydney→London](https://www.cheapflights.com.au/flights-to-London/Sydney/), [Melbourne→London](https://www.cheapflights.com.au/flights-to-London/Melbourne/), [Brisbane→London](https://www.cheapflights.com.au/flights-to-London/Brisbane/), [Sydney→Madrid](https://www.cheapflights.com.au/flights-to-Madrid/Sydney/), [Melbourne→Madrid](https://www.cheapflights.com.au/flights-to-Madrid/Melbourne/), [Brisbane→Madrid](https://www.cheapflights.com.au/flights-to-Madrid/Brisbane/), [Sydney→Valencia](https://www.cheapflights.com.au/flights-to-Valencia/Sydney/)
- Kayak — [Perth→Sydney](https://www.kayak.com/flight-routes/Perth-PER/Sydney-Kingsford-Smith-SYD), [Sydney→Hobart](https://www.kayak.com.au/flight-routes/Sydney-Kingsford-Smith-SYD/Hobart-HBA), [Sydney→Launceston](https://www.kayak.com.au/flight-routes/Sydney-Kingsford-Smith-SYD/Launceston-LST), [Melbourne→Hobart](https://www.kayak.com.au/flight-routes/Melbourne-MEL/Hobart-HBA), [Melbourne→Launceston](https://www.kayak.com.au/flight-routes/Melbourne-MEL/Launceston-LST)
- Trip.com AU — [Perth→Sydney fares & monthly averages](https://au.trip.com/flights/perth-to-sydney/airfares-per-syd/)

**Peak-period pricing data**
- Compare the Market — [Cheapest days to fly, Christmas & New Year 2025](https://www.comparethemarket.com.au/news/cheapest-days-to-fly-december-australia-2025/) (day-level Dec 2025 dataset)
- Time Out Australia — [Cheapest and most expensive days to fly over Christmas](https://www.timeout.com/australia/news/revealed-the-cheapest-and-most-expensive-days-for-aussies-to-fly-over-christmas-111324)
- Canberra Times — [When to fly for the cheapest Christmas, New Year airfares](https://www.canberratimes.com.au/story/9121464/when-to-fly-for-the-cheapest-christmas-new-year-airfares/) (the SYD→CNS A$104→A$455 peak-day figure)

**Live sale fares**
- OzBargain — [Three airline sales at once: Jetstar / Virgin / Qantas, 22–25 Aug 2026](https://www.ozbargain.com.au/node/972124)
- OzBargain — [1-way domestic fares: Qantas / Virgin / Jetstar](https://www.ozbargain.com.au/node/956707)

**Booking behaviour & fare mechanics**
- ShopBack — [Cheapest times to book domestic flights in Australia](https://www.shopback.com.au/blog/travel/cheapest-domestic-flights-australia) (route peak/off-peak bands, booking windows)
- Point Hacks — [Why I (almost) always book domestic flights as one-way tickets](https://www.pointhacks.com.au/domestic-one-way-flights-strategy/)

**Schedules & carriers**
- FlightConnections — [PER→SYD nonstop](https://www.flightconnections.com/flights-from-per-to-syd), [Hamilton Island](https://www.flightconnections.com/flights-from-hamilton-island-hti), [Proserpine](https://www.flightconnections.com/flights-to-proserpine-ppp)
- FlightsFrom — [MEL–CNS frequency](https://www.flightsfrom.com/MEL-CNS)
- ch-aviation — [Rex ends 737 ops, enters administration](https://www.ch-aviation.com/news/143124-australias-rex-ends-b737-ops-enters-administration)
- Pulse Tasmania — [Rex grounds 737 fleet, cancels Hobart–Melbourne flights indefinitely](https://pulsetasmania.com.au/news/rex-grounds-boeing-737-fleet-cancels-hobart-melbourne-flights-indefinitely/)
- Simple Flying — [Australia–Middle East routes, 23 daily flights, Apr 2026](https://simpleflying.com/australia-middle-east-routes-23-daily-flights-2026/)

**Baggage & fare classes**
- Jetstar — [Starter Plus bundle product guide](https://www.jetstar.com/au/en/help/starter-plus-bundle-product-guide)
- Virgin Australia — [Domestic fare types](https://www.virginaustralia.com/au/en/travel-info/flying-with-us/fare-types/domestic-fares/), [Checked baggage](https://www.virginaustralia.com/au/en/travel-info/baggage/checked-baggage/)
- Qantas — [Baggage allowances and fees](https://www.qantas.com/en-us/baggage/allowances-and-fees)
- ShopBack — [Melbourne to Tasmania, cheapest way 2026](https://www.shopback.com.au/blog/travel/melbourne-to-tasmania-cheapest-way-2026) (fare-family bands, ferry peak totals)

**Spirit of Tasmania**
- Spirit of Tasmania — [Pricing & offers](https://www.spiritoftasmania.com.au/pricing-offers/), [Fare structure](https://www.spiritoftasmania.com.au/pricing-offers/fare-structure/), [Fuel surcharge media release](https://www.spiritoftasmania.com.au/media-releases/fuel-surcharge-to-be-introduced-by-tt-line/)
- RACV — [Spirit of Tasmania guide 2026](https://www.racv.com.au/royalauto/travel/australia/spirit-of-tasmania-guide.html) (19 May 2026)
- Tasmania Trails — [Ferry to Tasmania 2026: costs, cabins, times](https://tasmaniatrails.com/ferry-to-tasmania-2/)
- Road Trip Nomads — [Spirit of Tasmania guide](https://roadtripnomads.au/spirit-of-tasmania-guide/) (updated 18 Aug 2026; live Jan-2027 quote, new-ship schedule)
- ABC News — [New Spirit of Tasmania fuel surcharge](https://www.abc.net.au/news/2026-03-30/new-spirit-of-tasmania-fuel-surcharge/106512786) (30 Mar 2026)
- OzBargain — [Spirit "End of an Era" sale: adult $50, cabin $125, car $50](https://www.ozbargain.com.au/node/969433) (off-peak floor benchmark)
- MyBus Geelong — [Spirit of Tasmania shuttle](https://www.mybusgeelong.com.au/services/shuttle)

**Destination seasonality**
- Virgin Australia — [Best time to visit Cairns](https://www.virginaustralia.com/au/en/destinations/cairns/best-time-to-visit-cairns/)
- Cairns Tours — [January in Cairns](https://cairns-tours.com/article/january-in-cairns)

**Currency**
- Exchange-Rates.org — [AUD→EUR history 2026](https://www.exchange-rates.org/exchange-rate-history/aud-eur-2026) (0.6136 on 25 Aug 2026)
