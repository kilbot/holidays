# Comfort ratings: which airline + aircraft combination actually wins Europe → Perth, December 2026

Research for [issue #49](https://github.com/kilbot/holidays/issues/49). Researched 2026-08-27.
Dataset: [`comfort-ratings.json`](./comfort-ratings.json). Seat geometry, route confirmations and
price bands are reused from [`longhaul-comfort.md`](./longhaul-comfort.md) (researched 2026-08-26)
rather than re-derived.

## The answer

**Singapore Airlines on the A350-900, Barcelona → Singapore → Perth. Score 9.3 / 10 — and it wins
precisely because it is *not* an A380.** The question assumed you could have both; you can't.
Singapore Airlines has **no economy on its A380 upper deck** (the old layout with 88 upper-deck
economy seats is retired, all 12 aircraft are on the 2017 layout) and **flies no A380 to Perth at
all**. Every A380 that still has a 2-4-2 economy upper deck belongs to a 4-star airline — British
Airways or Lufthansa, both scoring 6.5 against Singapore's 9.5 — and none of them fly a sector
that reaches Australia. So the real choice is *Singapore's A350 seat* versus *someone else's A380
seat*, and the A350 at ~18" wide and 32" pitch gives up almost nothing: it is the **same width as
an Emirates A380 main deck**, half an inch narrower than a Singapore A380, and a full inch wider
than the 787s and 10-abreast 777s that dominate this route. The runners-up are **Cathay Pacific
MAD → HKG → PER at 9.0** — A350 on both sectors, on the airline that holds Skytrax's *World's Best
Economy Class 2025* — and **Singapore ex-Madrid at 8.9**, identical hardware with one extra ground
stop. Both sit in the **€1,500–2,300 pp** premium-comfort band (Cathay nearer €1,300–1,900, the
cheapest hub in the aggregator data); the €900–1,300 value band means China Southern via Guangzhou,
which scores 5.5.

**And then the A380 instinct gets paid off anyway — on the way home, for free.** Singapore flies
**SIN–SYD twice daily and SIN–MEL daily on the A380 through late March 2027**, and its main-deck
economy is **18.5" at 32" pitch — the widest economy seat in this entire dataset, wider than its own
A350**. Book the open-jaw (Perth in, east coast out) and the couple gets the #1 airline *and* the
A380, in the direction where they'll want to sleep. Aim for the rear taper rows, where the side
blocks drop from three seats to two.

**The one thing an A380 gives that nothing else does — and what it costs.** On a 2-4-2 upper deck a
couple books a side pair and has *no third passenger in the row*. That is the only structural, non-
subjective comfort advantage in this research. The best version of it is **Lufthansa's A380 upper
deck, MUC → BKK: 18" at 2-4-2 in a 35-seat mini-cabin, config score 9.5, the best economy seat
reachable on this trip** — and it survives Lufthansa's 2026 retrofit, which touches Business only.
It still finishes **6.7 overall**, 2.6 points behind Singapore, because that seat is bolted to a 6.5
airline, a 6.0 second carrier (Thai), a third sector, and Bangkok instead of Changi. If a private
pair is the priority and the upper deck is unreachable, the quiet answer is **Malaysia Airlines'
A330-900neo on KUL–PER — also 2-4-2, no retrofit gamble, widely available**.

---

## How the score is built

```
comfortScore = 0.55 × airlineScore + 0.45 × seatScore
```

Both scores are 0–10 and rounded to halves. For a multi-sector itinerary each score is **weighted by
block hours**, so a 13-hour A350 counts more than a 5-hour 787 and a 2h20 positioning hop can't drag
down a 20-hour journey. Three explicit adjustments are then subtracted: **−1.0** for any Gulf hub
transit in this window, **−0.75** for unconfirmed metal (the BA retrofit coin-flip), **−0.25** per
sector beyond the second.

**Why 0.55 / 0.45.** Near-even, tilted slightly to the airline, for three reasons:

1. **The axes have the same spread.** Across the realistic Europe→Perth set both airline scores and
   seat scores span 5.5–9.5. A near-even weighting is the only one where neither axis silently
   decides every ranking. At 60% aircraft, Lufthansa's one good seat starts beating Singapore
   Airlines outright; at 70% airline, Qatar's 3-4-3 777 to Perth stops mattering. Both are wrong.
2. **The airline covers more of the 24 hours.** Seat geometry is the biggest lever *within* the
   flight — that finding stands. But the airline determines crew, catering, IFE, the hub they sit in
   for hours, and how they're treated when something breaks on a sold-out December date.
3. **The airline is the part that's actually guaranteed.** This is decisive. At booking, the carrier
   is contractual; the aircraft is a schedule intention. This research alone documents Qatar
   reversing the A380 on Perth, Emirates pulling the A380 off DXB–PER and back *and* cutting
   frequency, Emirates downgrading Barcelona from A380 to 777, and BA mid-retrofit on the exact
   aircraft the upper-deck play depends on. Weighting the more volatile variable higher would make
   the ranking less stable than the world it describes.

**Where the truth lives: the config, not the type.** A 3-4-3 787 is not a 3-3-3 A350 and a 2-4-2 787
is not a 3-3-3 787. Japan Airlines has held the *best economy seat* title six years running flying
the **same airframe** everyone else scores 6.5 on — the entire difference is one seat per row. The
Flights page should always resolve to a `carrierConfigs` entry and fall back to the type score only
with a low-confidence flag.

---

## Ranking: actual December 2026 Europe → Perth itineraries

Scores are shown to one decimal, but **differences below ~0.3 are noise** — treat 9.3 / 9.0 / 8.9 as
a three-way photo finish on hardware, separated by hub quality and stop count rather than by seat.

| # | Carrier | Routing (via) | Metal, long sector → short sector | Airline | Seat | Adj. | **Score** | Price band pp |
|---|---|---|---|---|---|---|---|---|
| **1** | **Singapore Airlines** | **BCN → SIN → PER** | **A350-900 (18", 32") → A350-900** | 9.5 | 9.0 | — | **9.3** | €1,500–2,300 |
| 2 | Cathay Pacific | MAD → HKG → PER | A350-900 (18", 32") → A350-900 | 9.0 | 9.0 | — | **9.0** | €1,300–1,900 |
| 3 | Singapore Airlines | MAD → *BCN* → SIN → PER | A350-900 → A350-900 | 9.5 | 8.8 | −0.25 | **8.9** | €1,500–2,300 |
| 3= | Singapore Airlines | BCN → SIN → PER (787-10 rotation) | A350-900 → **787-10 (17.5")** | 9.5 | 8.4 | — | **9.0** | €1,500–2,300 |
| 4 | Malaysia Airlines | *LHR* → KUL → PER | A350-900 (18") → **A330-900neo, 2-4-2** | 6.5 | 8.7 | — | **7.5** | €1,150–1,700 |
| 5 | Qatar Airways | MAD/BCN → DOH → PER | A350-1000 (18", 33") → **777-300ER (17.2", 3-4-3)** | 9.0 | 7.1 | **−1.0** | **7.1** *(8.1 raw)* | €1,150–1,700 |
| 5= | Malaysia Airlines | VLC → LHR → KUL → PER | + BA narrowbody positioning | 6.5 | 8.4 | −0.25 | **7.1** | €1,150–1,700 |
| 6 | British Airways + Qantas | VLC → LHR → SIN → PER | **A380 upper deck (17.6", 31", 2-4-2)** → QF A330-300 | 6.7 | 7.6 | −0.25 | **6.9** *best case* | €1,600–2,400 **+ £106 pp APD** |
| 7 | Lufthansa + Thai | VLC → MUC → BKK → PER | **A380 upper deck (18", 2-4-2)** → 787-8 | 6.3 | 7.8 | −0.25 | **6.7** | €1,150–1,700 |
| 7= | Qantas | VLC → LHR → **PER nonstop** | **787-9 (17.2", 16h40 unbroken)** | 7.4 | 5.9 | — | **6.7** | €1,800–2,600+ **+ £106 pp APD** |
| 8 | Emirates | MAD → DXB → PER | A380 (18") → **777-300ER (17.0")** | 8.0 | 6.7 | **−1.0** | **6.4** *(7.4 raw)* | €1,150–1,700 |
| 9 | British Airways + Qantas | VLC → LHR → SIN → PER | **refurbished A380 — no upper-deck economy** | 6.7 | 7.6 | −1.0 | **6.1** *expected* | as #6 |
| 10 | China Southern | MAD → CAN → PER | 787-9 (17.2", 31") → 787-9 | 5.5 | 5.5 | — | **5.5** | €900–1,300 |

**Return leg, for completeness** — Singapore Airlines SYD/MEL → SIN on the **A380 (18.5", the widest
seat in the dataset)** then SIN → BCN on the A350 also scores **9.3**. Turkish Airlines
VLC ↔ IST ↔ SIN ↔ SYD/MEL, all-A350 and the only single ticket that starts and ends at Valencia
airport with no train, scores **7.7**.

### Reading the table

- **Rows 1–3 are the whole recommendation.** Three itineraries, two airlines, one aircraft family.
  Everything above 8.5 on this list is an A350 at 18" and 32".
- **Row 5 is the most instructive failure.** Qatar has the **highest single config score in the
  entire dataset** — its A350-1000 at 18" and 33" pitch scores 9.5 — and the second-highest airline
  score. Then it puts the *longer* leg (~11h to Perth) on its *narrowest* aircraft and routes it
  through restricted airspace. Best airline in the world by two of three rankings, wrong metal on
  the one sector that matters.
- **Rows 6, 7 and 9 are the direct answer to "the A380 is well-rated".** All three carry a genuinely
  better *seat* than the winner. All three lose by 2.4–3.2 points. Row 9 is row 6 after the coin
  flip goes the wrong way.
- **Row 7= is the option most people reach for first.** The famous Perth nonstop is the *narrowest
  seat in the dataset* on the *longest unbroken sit* — 17.2" for 16h40 — plus £106 pp of UK Air
  Passenger Duty and an unprotected positioning leg into a UK hub in December.

---

## Airline scores

Economy-weighted, 0–10, rounded to halves. As of 2026-08-27.

| IATA | Airline | Skytrax ★ | Skytrax WAA 2025 rank | AirlineRatings 2026 | APEX 2026 | **Score** |
|---|---|---|---|---|---|---|
| **SQ** | Singapore Airlines | **5** | 2 | #3 overall, **#1 long-haul (36.95)**, **#1 Preferred Economy** | — | **9.5** |
| **QR** | Qatar Airways | **5** | **1** | **#1 overall**, #2 long-haul (36.24) | — | **9.0** |
| **CX** | Cathay Pacific | **5** | 3, **World's Best Economy Class** | #2 overall, #3 long-haul (33.41) | ★★★★★ | **9.0** |
| NH | ANA | **5** | 5 | #15 | — | 8.5 |
| JL | Japan Airlines | **5** | 9 | #6, *best economy seat 6 yrs* | — | 8.5 |
| KE | Korean Air | **5** | 7 | #4 | ★★★★★ | 8.5 |
| EK | Emirates | 4 | 4 | #8, **#2 Preferred Economy** | — | 8.0 |
| EY | Etihad | 4 | 26 | #10 | ★★★★★ | 7.5 |
| QF | Qantas | **4** *(cut from 5 in Mar 2026)* | 14 | #12 | ★★★★★ | 7.5 |
| TK | Turkish Airlines | 4 | 6 | #7 | — | 7.5 |
| OZ | Asiana | **5** | 41 | — | — | 7.5 *(low confidence)* |
| AF | Air France | 4 | 8 | #19 | ★★★★★ | 7.0 |
| KL | KLM | 4 | 21 | #18 | ★★★★★ | 7.0 |
| BA | British Airways | 4 | 13 | *absent from top 25*, **#1 Europe (vote)** | ★★★★ | 6.5 |
| LH | Lufthansa | 4 | 15 | *absent from top 25*, #2 Europe (vote) | ★★★★ | 6.5 |
| MH | Malaysia Airlines | 4 | 27 | #20 | ★★★★ | 6.5 |
| CI | China Airlines | 4 | 37 | — | ★★★★★ | 6.5 |
| TG | Thai Airways | 4 | 29 | #21 | — | 6.0 |
| VN | Vietnam Airlines | 4 | 62 | #16 | — | 6.0 |
| CZ | China Southern | 4 | 33 | — | — | 5.5 |
| MU | China Eastern | 3 | 98 | — | — | 4.0 |

### Where the sources disagree — and it's a lot

- **The single biggest data-quality event: Skytrax's passenger-review site, airlinequality.com,
  closed in February 2026.** Skytrax's stated reason was that generative AI had pushed suspected-fake
  reviews to roughly 30% of submissions — including inside its own "Trip Verified" tier, where staff
  inspected e-tickets and boarding passes. **The largest source of numeric airline review scores no
  longer exists and cannot be refreshed.** Any "Skytrax review score /10" published after Feb 2026 is
  a cached scrape of a dead dataset. This research deliberately uses none. The `reviewScore` field in
  the JSON is therefore a composite of the surviving dated signals, not a scraped star-average.
- **Who is #1 depends entirely on who you ask.** Skytrax's 2025 passenger vote says **Qatar**;
  AirlineRatings' 2026 editorial list says **Qatar**, then Cathay, then Singapore; AirlineRatings'
  2026 *long-haul* assessment says **Singapore** (36.95) ahead of Qatar (36.24); AirlineRatings'
  August 2026 passenger-voted Flyers' Choice says **Singapore** for Preferred Economy, and made it
  the most-decorated airline of the year with four titles; Skytrax's 2025 *Best Economy Class*
  category went to **Cathay**. Singapore is scored highest here because the two *economy-specific*
  measures both put it first — but SQ 9.5 / QR 9.0 / CX 9.0 is a hair's breadth, not a verdict.
- **The 2026 Skytrax World Airline Awards are not out yet** — the ceremony is 18 September 2026, three
  weeks after this research. Ranks above are the 2025 vintage and should be refreshed after that date.
- **Qantas was demoted from 5-star to 4-star by Skytrax in March 2026.** A real, dated change.
  Skytrax's own A-Z index page still returned "5 stars" for Qantas when fetched on 2026-08-27, while
  its dedicated Qantas page and its 10-airline 5-star list both say 4. Skytrax contradicts itself;
  the dedicated page is treated as authoritative.
- **APEX's absences are not scores.** Singapore, Qatar, Emirates and Turkish appear in neither the
  APEX Five Star nor Four Star 2026 list. That is a coverage artifact of APEX's TripIt-based
  sampling, not a low rating, and is recorded as `null` in the JSON — never as zero.
- **Audit vs. vote splits are systematic.** Emirates is 4-star by audit but 4th in the world by
  passenger vote and 2nd for economy specifically. Asiana is 5-star by audit but 41st by vote —
  the widest audit/vote gap in the set, which is why its 7.5 is flagged low-confidence. Vietnam
  Airlines is #62 on Skytrax and #16 on AirlineRatings, a 46-place gap.
- **No European carrier holds Skytrax 5-star in 2026.** Only ten airlines worldwide do, and nine are
  Asian plus Qatar. That is the structural reason the A380 upper-deck plays cap out around 6.5 on the
  airline axis — the only carriers still flying that cabin out of Europe are European.

---

## Aircraft scores

Base score is the **fallback when the carrier's specific config is unknown**. Always prefer the
config table below it.

| Type | Base | Why |
|---|---|---|
| **A380 upper deck (2-4-2)** | **9.5** | The only *structural* comfort advantage in this research: a couple books a side pair with **no third passenger in the row**. ~104-seat mini-cabin vs ~199 below, less galley/lavatory traffic, side storage bins under the windows unique to the A380 upper deck. Held below 10 because every surviving operator pairs it with 31" pitch. |
| **A350-900 / -1000** | **9.0** | Airbus sized the fuselage specifically to fit an 18" seat at 9-abreast and operators have held that line. Best geometry a couple can *reliably* book Europe↔Australia in 2026. |
| **787 at 2-4-2 (JAL)** | **9.0** | The exception that proves the rule — same airframe as the 6.5 rows below, one fewer seat per row, six consecutive best-economy-seat titles. |
| **A380 (main deck, 3-4-3)** | **8.5** | Wide enough that even 10-abreast holds 18–18.5", where a 777 at the same 3-4-3 drops to 17.0". |
| **A330-900neo (2-4-2)** | **8.5** | Beats the 787 despite a narrower tube, because operators fly it 8-abreast. Side-pair advantage without the A380's scarcity. Typically 17.5"/32". |
| **777-300ER at 3-3-3 (rare)** | **8.5** | ~18.5"/34" — widest single seat here, but effectively extinct on this route. |
| **A330-300 (2-4-2)** | **8.0** | Same side-pair win, usually 31" pitch and an older cabin. |
| **787-8 / -9 / -10 (3-3-3)** | **6.5** | The 787 tube is ~5–6" narrower than the A350's; at 9-abreast that's ~17.0–17.2". **That 0.8" is the whole difference between the good and bad long-haul economy cabins.** Lower cabin altitude and higher humidity are real but don't recover width. A stretch adds length, not width. |
| **747-400 / -8 (3-4-3)** | **6.5** | Included because the issue asked. **Not bookable on any Europe↔Perth itinerary in Dec 2026.** Its upper deck is business class on every remaining operator, so there is no economy equivalent to the A380's. |
| **777-300ER (3-4-3)** | **6.0** | Lowest widebody, and it's measured not felt: Emirates flies the A380 at 18.0" and the 777-300ER at **17.0" at the identical 32" pitch**. A clean one-inch type penalty. |
| A320 / A321 (positioning) | 5.5 | Short enough that block-hour weighting keeps it from mattering. Its real cost is the missed connection, not the seat. |

### Carrier configs — the table that actually decides the ranking

| Carrier | Type | Route | Width | Pitch | Layout | **Config** |
|---|---|---|---|---|---|---|
| **LH** | A380 **upper deck** | MUC–BKK | **18.0"** | 31.5" | **2-4-2** | **9.5** |
| **QR** | A350-1000 | MAD/BCN–DOH | 18.0" | **33"** | 3-3-3 | **9.5** |
| **SQ** | A350-900 Long Haul | **BCN–SIN** | 18.0" | 32" | 3-3-3 | **9.0** |
| **SQ** | A350-900 Medium Haul | SIN–PER | 18.0" | 32" | 3-3-3 | **9.0** |
| **SQ** | **A380 main deck** | SIN–SYD / SIN–MEL *(return)* | **18.5"** | 32" | 3-4-3 | **9.0** |
| **CX** | A350-900 | MAD–HKG **and** HKG–PER | 18.0" | 32" | 3-3-3 | **9.0** |
| MH | A350-900 | LHR–KUL | 18.0" | 32" | 3-3-3 | 9.0 |
| EK | A380 main deck | MAD–DXB | 18.0" | 32" | 3-4-3 | 8.5 |
| TK | A350-900 | VLC–IST–SIN–SYD *(return)* | 18.0" | **31"** | 3-3-3 | 8.5 |
| OZ | A380 upper deck | ICN–SYD *(to 31 Dec 2026 only)* | 17.7" | 32" | 2-4-2 | 8.5 |
| **BA** | A380 upper deck — **unrefurbished** | LHR–SIN | 17.6" | 31" | **2-4-2** | **8.0** |
| **MH** | **A330-900neo** | KUL–PER | 17.5" | 32" | **2-4-2** | **8.0** |
| QF | A330-300 | SIN–PER | 17.5" | 31" | 2-4-2 | 7.5 |
| SQ | **787-10** | SIN–PER | *17.5"* | 32" | 3-3-3 | 7.0 |
| **BA** | A380 — **refurbished** | LHR–SIN | 17.5" | 31" | **3-4-3, no UD economy** | **6.5** |
| QF | A380 main deck | SYD–SIN–LHR *(return)* | 17.5" | 31" | 3-4-3 | 6.5 |
| QF | 787-9 | **LHR–PER nonstop** | 17.2" | 32" | 3-3-3 | 6.0 |
| QR | **777-300ER** | **DOH–PER** | 17.2" | 32" | 3-4-3 | 5.5 |
| EK | **777-300ER** | **DXB–PER** | **17.0"** | 32" | 3-4-3 | 5.5 |
| EY | 787-9 | Europe–AUH *(return)* | 17.2" | 31" | 3-3-3 | 5.5 |
| CZ | 787-9 | MAD–CAN, CAN–PER | 17.2" | 31" | 3-3-3 | 5.5 *(low conf.)* |

### Config caveats worth knowing

- **The one genuine measurement conflict: Singapore's 787-10.** SQ publishes **18"** for that seat and
  third-party guides repeat it. That figure cannot be reconciled with the 787 fuselage, which gives
  ~17.0–17.2" at 9-abreast for every other operator — the A350 gets 18" because its cabin is 5–6"
  wider. **17.5"** is recorded as the generous end of the independently supportable range. If SQ's
  18" is literally true, it is measured differently (armrest outer edges), not a wider seat.
  Practically: SIN–PER runs a **mix** of A350-900 and 787-10 across 28 weekly nonstops. Request the
  A350 rotation — but at a 5-hour sector the whole cost of drawing the 787 is **0.3 points**. Worth
  asking for; not worth restructuring the trip for.
- **Qatar's Perth sector is settled and it's the bad one.** Qatar explicitly *reversed* its plan to
  put the A380 on Perth and confirmed the **777-300ER** for northern winter 2026/27. The Qatar A380
  returns to Australia on **Sydney only, from March 2027** — after this trip's return window.
- **Do not assume an A380 on DXB–PER.** Emirates suspended it after 14 March 2026, substituted a
  777-300ER, planned an A380 return for 1 July 2026, and cut Perth from twice-daily to daily.
  Barcelona was separately downgraded A380 → 777 in July 2026.
- **The BA upper deck is a coin flip.** The refit began June 2026; the new 421-seat layout puts 110
  Club Suites across the **entire** upper deck and moves all economy downstairs. First refurbished
  frame due back late 2026, fleet complete end-2027. **Only book this if the seat map at the moment
  of booking shows 2-4-2 in rows 70–83.** Book 70A/70K or 80A/80K; avoid exit rows, which have no
  windows at all; main-deck fallback is 25D.
- **Lufthansa's upper deck survives its retrofit.** The 2026 VantageXL programme touches Business
  only — First, Premium Economy and Economy are untouched, so the 35 upper-deck economy seats stay.
  Pick **95E, 96A or 96C**; rows 96–98 A/K have the side storage; avoid 95A/95K (no window).
- **Wikipedia's A380 seat-configuration page is unreliable** — it still shows Singapore's retired V1
  layout and miscodes Qantas premium economy as economy. Use aeroLOPA.

---

## What to re-check before this dataset is trusted at booking

1. **Skytrax World Airline Awards 2026, announced 18 September 2026.** Every Skytrax rank in the
   airline table is 2025 vintage and will move.
2. **Gulf airspace status.** The −1.0 adjustment exists because EASA conflict-zone guidance for the
   Persian Gulf was extended to at least 31 August 2026. If it lifts, Qatar's raw 8.1 becomes its
   real score and it moves to 4th; if it doesn't, keep the penalty.
3. **The specific BA A380 airframe**, if that routing is live at all.
4. **Whether SIN–PER is filed as A350 or 787-10** on the chosen date.
5. **SQ's BCN frequency** — sources split between 5x weekly (SIA press release) and daily.
6. **Emirates and Qatar metal on the Perth sector**, both of which have moved more than once in 2026.

---

## Sources

Airline ratings: [Skytrax 5-Star Airlines](https://skytraxratings.com/the-worlds-5-star-airlines) ·
[Skytrax A-Z of Airline Ratings](https://skytraxratings.com/a-z-of-airline-ratings) ·
[Skytrax Qantas rating](https://skytraxratings.com/airlines/qantas-rating) ·
[Skytrax Emirates rating](https://skytraxratings.com/airlines/emirates-rating) ·
[Skytrax Etihad rating](https://skytraxratings.com/airlines/etihad-airways-rating) ·
[Skytrax China Airlines rating](https://skytraxratings.com/airlines/china-airlines-rating) ·
[World's Top 100 Airlines 2025](https://www.worldairlineawards.com/worlds-top-100-airlines-2025/) ·
[2026 World Airline Awards date](https://skytraxratings.com/2026-world-airline-awards-ceremony-to-take-place-in-london-in-september) ·
[AirlineRatings World's Best Airlines 2026](https://www.airlineratings.com/articles/worlds-best-airlines-for-2026-by-airline-ratings) ·
[AirlineRatings Flyers' Choice Awards 2026](https://www.airlineratings.com/articles/flyers-choice-awards-2026) ·
[APEX Four and Five Star recipients 2026](https://apex.aero/awards/apex-five-star-and-apex-four-star-airline-awards/current-apex-four-and-five-star/) ·
[No European carrier in the 2026 five-star list (Euronews)](https://www.euronews.com/travel/2026/05/15/the-world-has-10-five-star-airlines-and-none-are-european) ·
[AirHelp Score](https://www.airhelp.com/en/airhelp-score/) ·
[airlinequality.com closure discussion (PPRuNe)](https://www.pprune.org/passengers-slf-self-loading-freight/673270-airlinequality-com-skytrax-reviews-website-closed.html)

Seat geometry: [`longhaul-comfort.md`](./longhaul-comfort.md) (aeroLOPA-verified A380 seat maps,
Emirates A380/777 width measurements, route and metal confirmations) ·
[A350 vs 787 cabin width (Simple Flying)](https://simpleflying.com/how-much-wider-airbus-a350-cabin-boeing-787-dreamliner/) ·
[Singapore Airlines A380 economy review (Business Traveller)](https://www.businesstraveller.com/news/airlines/flight-review-singapore-airlines-a380-economy-class/) ·
[SIA A380 V3 fleet (Mainly Miles)](https://mainlymiles.com/fleet-a380v3/) ·
[Malaysia Airlines A330neo economy review (Australian Frequent Flyer)](https://www.australianfrequentflyer.com.au/malaysia-airlines-a330neo-economy-review/) ·
[Qatar 777-300ER seat guide](https://cabin.coach/aircraft/qatar-airways-boeing-777-300er-seat-guide) ·
[Cathay A350-900 seat guide](https://cabin.coach/aircraft-reviews/cathay-pacific-airbus-a350-900-seat-guide) ·
[Turkish A350-900 seat guide](https://cabin.coach/aircraft/turkish-airlines-airbus-a350-900-seat-guide) ·
[Singapore 787-10 seat guide](https://cabin.coach/aircraft-reviews/singapore-airlines-787-10-seat-guide) ·
[China Southern 787-9 (aeroLOPA)](https://www.aerolopa.com/cz-78w)
