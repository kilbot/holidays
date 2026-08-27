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
down a 20-hour journey. Four explicit adjustments are then subtracted: **−1.0** for any Gulf hub
transit in this window, **−0.75** for unconfirmed metal (the BA retrofit coin-flip), **−0.25** per
sector beyond the second, and **−0.25** per sector of 6 hours or more flown on an aircraft
pressurised to ~8,000 ft cabin altitude — the last one added on 2026-08-27 by the evidence audit
below, and the only component of this formula with a controlled trial behind it.

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

## Evidence basis

Added 2026-08-27 for [issue #69](https://github.com/kilbot/holidays/issues/69), after the challenge:
*"is it empirical, or are you just pulling it out of your ass?"* This section audits every component
of the formula against the published literature. Each component is labelled:

- **measured** — a controlled study measured this effect and reported a direction and significance;
- **rated** — the input is a third-party rating or a published measurement, not a causal finding;
- **judgment** — no literature located; the number is a defensible guess and is presented as one.

**The one-line answer: partly.** The seat axis and one component the formula *didn't have* are
backed by experimental work. The airline/aircraft weight is bracketed by evidence pointing in both
directions and is a judgment call sitting inside that bracket. The three adjustments are judgment.
Nothing in the literature overturns the recommendation.

### What the literature actually establishes

**1. Seat width matters more than pitch, and the exchange rate has been measured.**
Anjani, Song, Hou, Ruiter & Vink (2021, *Int. J. Industrial Ergonomics* 82:103097) sat **311**
participants in 17"-wide and 18"-wide seats in a Boeing 737 fuselage: the 18" seat produced more
comfort and less discomfort in most body regions (all but lower back), and — the load-bearing
finding — *"an extra inch on the width is similar to four extra inches on the pitch regarding the
feeling of comfort while sitting."* Anjani, Song & Vink (2021, *Work* 68(s1):S7–S18) restate it as
an 18"×30" seat delivering *"nearly the same level of comfort as a 17"×34" seat"*.

This **supports** the dataset's central claim that width, not pitch, separates the good long-haul
economy cabins — and it supports treating 0.8" of width (A350 vs 787 at 9-abreast) as a large
effect. It also **partly contradicts the scale used here**. The config table implies a width:pitch
exchange rate of roughly **7.5:1** (18"/32" = 9.0 vs 17.2"/32" = 6.0 → 3.75 pts per width-inch;
18"/33" = 9.5 vs 18"/31" = 8.5 → 0.5 pts per pitch-inch). The measured rate is **~4:1**. The config
scores over-weight width relative to pitch by about a factor of two. Nothing in the top six moves
— rows 1, 2 and 3 are all 18"/32" — but Turkish's 18"/31" A350 (8.5) is the one clearly out of
line: on a 4:1 scale it should sit within ~0.3 of Singapore's 18"/32", not 0.5 below it.

**Honest limit:** exposure was **10 minutes**. Nobody has tested 17" vs 18" for thirteen hours. The
direction is measured; the persistence over a long-haul sector is an assumption.

**2. Pitch has a measured dose-response, and it saturates.**
Anjani, Li, Ruiter & Vink (2020, *Applied Ergonomics* 88:103132), **n=294** at 28/30/32/34":
significant relationship between pitch and both comfort and discomfort. Kremser, Guenzkofer,
Sedlmeier, Sabbah & Bengler (2012, *Work* 41(S1):4936–4942), **n=30** in a mock-up adjustable
28–43": well-being peaks at **34–40" depending on anthropometry** and *falls* beyond that. Liu,
Rotte, Anjani & Vink (2021, *Work* 68(s1)), **n=53**: 27" pitch rated *"unacceptably low"*, 29" and
31" acceptable.

Every pitch in this dataset is **31–33"** — below the measured optimum, above the unacceptable
floor, in the range where the dose-response is real but shallow. That **supports** the decision to
let pitch move config scores by only ~0.5–1.0 point.

**3. The middle seat and the adjacent passenger are measured effects.**
Anjani et al. (2020) found mean discomfort rank for the **middle seat higher than window and aisle**
at every pitch tested. Marazita & Parkinson (2026, *Ergonomics*, doi:10.1080/00140139.2026.2675534)
modelled seat width against anthropometry and found *"wider seats substantially improve
accommodation across all metrics, while higher load factors reduce comfort by limiting adjacent
empty seats"*, with **women disproportionately disaccommodated** because seated hip breadth is
larger. Liu et al. (2021) found *"very little complaints about space in lateral direction (elbow
and seat width)"* in a staggered layout — attributed to having *your own armrest*.

This is the strongest support in the whole audit for the **2-4-2 side-pair thesis**: a couple in a
side pair occupies zero middle seats, shares armrests with nobody, and has no third passenger. The
A380 upper-deck / A330neo premium was written as a structural argument; it is now a *rated* one
with three converging studies behind it. It also flags an omission: **the couple's own
anthropometry is a moderator** (Molenbroek, Albin & Vink 2017, *Applied Ergonomics* 65:130–138 —
seated hip breadth has grown over 30 years while buttock-knee length has not, so the modern fit
problem is width, not legroom), and this dataset scores a generic passenger.

**4. Cabin altitude is the best-evidenced factor in the entire literature — and the formula
didn't have it.**
Muhm, Rock, McMullin, Jones, Lu, Eilers, Space & McMullen (2007, *New England Journal of Medicine*
357(1):18–27) put **502 subjects** in a hypobaric chamber for a **20-hour** simulated flight at
650 / 4,000 / 6,000 / 7,000 / 8,000 ft equivalent. Reported discomfort rose with altitude and was
**greater at 7,000–8,000 ft than at all lower altitudes combined**, appearing **after 3–9 hours of
exposure**; SpO₂ fell up to 4.4 percentage points at 8,000 ft. Botonis, Toubekis, Hill & Mündel
(2025, *Experimental Physiology* 110:1584–1602) conclude that mild hypoxic exposure *"may explain,
at least partially, the fatigue usually observed after long-haul transmeridian flights, independent
of jet lag."*

**This directly contradicts a line in this document** — *"Lower cabin altitude and higher humidity
are real but don't recover width."* The comparison is unflattering: the width claim rests on
10-minute lab exposures; the cabin-altitude claim rests on a blinded 20-hour chamber trial with 502
subjects. Cabin altitude is better evidenced than anything else the formula scores, and it was
scored at zero.

**But "composite fuselage" is the wrong variable.** The 787 and A350 hold ~6,000 ft — and so does
the **A380** (aluminium) and the **777X**. The **A330-900neo is aluminium and sits at ~7,000–8,000
ft**, and the **777-300ER at 8,000 ft**. Aircraft generation, not material, predicts cabin
altitude. *(Aircraft cabin-altitude figures are manufacturer/secondary sourced, not peer-reviewed —
treat the A380's as low confidence.)*

**5. Low humidity: complaints are documented, benefit is not.**
Wang, You, Zhang & Chen (2022, *Indoor Air* 32(4)) reviewed two decades of cabin-environment
research: *"Low humidity is a major complaint from passengers and crew members"*, with no
significant air-quality problems otherwise identified. Bekö et al. (2015, *PLoS One*) measured
in-flight symptom prevalence: dry mouth/lips 26%, dry eyes 22%, nasal stuffiness 19%. What is
**missing** is an intervention trial showing that raising cabin humidity from ~10% to the ~15–25%
the composite aircraft claim actually improves passenger outcomes. Manufacturers' humidity claims
are marketing until someone runs that trial. **No humidity term is added.**

**6. Journey structure: the literature is thin, and it points somewhere else.**
No study was located that compares a single ultra-long sector against a split itinerary with a
stopover for passenger fatigue, sleep or comfort outcomes. What does exist:

- **Arrival timing has a modelled effect.** Huang, Bin, Caillaud & Postnova (2026, *Sleep*
  49(6):zsag063) simulated **55,296 flights**: for 1–9 hour zone shifts, jetlag is minimised when
  the flight departs or arrives near **habitual wake time** and maximised near habitual sleep
  onset; and *"when in-flight sleep was restricted"* — i.e. economy — the shortest jetlag came from
  **arrivals during the circadian day**. Europe→Perth is a 7-hour shift, squarely in that band.
- **Discomfort accumulates with time seated.** Lewis, McDonnell, Butlin et al. (2026, *Experimental
  Physiology*) found *"mood, pain and discomfort all worsened across the 6.5 h flight simulation
  (time, all P < 0.05)"*.
- **Immobility duration is the health hazard.** WHO's WRIGHT project (2007) found VTE risk roughly
  **doubles after ≥4 hours** of seated travel (absolute risk ~1 in 6,000, elevated ~4 weeks).
  Whether a mid-journey walk resets that clock has not been tested.
- **Recovery is slow and variable.** Botonis et al. (2025): 4–7 days at 6–8 time zones, up to 10–13
  days eastbound at 8+, and *"it is not yet possible to conclude that there is any particular
  amount of time needed to recover."*

Verdict: **block-hour weighting is supported in direction** (discomfort is time-dependent; so is the
cabin-altitude effect, with its 3–9 h onset) but **linearity is a judgment** — the evidence says
discomfort grows with time, not that it grows in a straight line. The **−0.25 per extra sector has
no evidential support in either direction** and stays labelled judgment. The real finding is an
**omission**: the formula scores no arrival or departure time, and that is the journey-structure
variable with actual modelling behind it.

**7. Airline vs aircraft: the evidence brackets the weight, it doesn't set it.**
This is the component the user challenged most directly, and the honest answer is that the
literature splits by *what outcome you measure*.

| Outcome measured | Study | What dominates |
|---|---|---|
| Physical (dis)comfort in-seat | Vink, Bazley, Kamp & Blok 2012, *Applied Ergonomics* 43(2):354–359 — 10,000+ trip reports + 153 interviews | **Legroom** is the top factor (**r = 0.718** with comfort), then hygiene, crew attention, seat/personal space |
| Overall satisfaction & recommendation | Ban & Kim 2019, *Sustainability* 11(15):4066 — **n = 9,632** Skytrax reviews, linear regression | **Value for money** (β = 0.603), then **staff** (β = 0.176), F&B (0.102), **seat comfort (0.080)**, ground service (0.042), IFE (−0.003, n.s.) |
| Recommendation only | Ban & Kim 2019, Table 7 | Value for money 0.577, **staff 0.197**, seat comfort **0.045** |
| Seat sub-dimensions only | Akan 2025, *Journal of Aviation* 9(3):676–683, n = 1,062 Skytrax reviews | Recline and aisle space strongest, then **width**, screen, legroom |

Read the comfort literature and the aircraft should carry **~70%**. Read the satisfaction
literature and grouping the airline-controlled factors (staff + F&B + ground = 0.320) against seat
comfort (0.080) gives **80/20 the other way**. Vink et al. 2012 also lands squarely on the
airline's side of the ledger on one point: *"rude flight attendants and bad hygiene reduce the
comfort experience drastically."* Ahmadpour, Robert & Lindgaard (2016, *Applied Ergonomics*
52:301–308) further show comfort and discomfort are **one spectrum, not two constructs**, so these
literatures are measuring the same axis at different points — they genuinely disagree.

Caveats that stop the Ban & Kim numbers from settling it: all sub-ratings are self-reported in one
sitting (common-method variance); the dominant variable, **value for money, is not in this formula
at all**; and the source, airlinequality.com, is the database that closed in Feb 2026 over fake
reviews.

**Conclusion: 0.55 / 0.45 is retained and relabelled `judgment`.** It sits inside a bracket of
roughly **0.30–0.70** that the evidence will support, and there is no principled basis in the
literature for picking a point inside it. What *can* be shown is that the choice doesn't matter for
the answer — see the sensitivity table below. This is also the strongest possible argument for
workstream B: the honest response to a contested weight is to expose it as a slider, not to defend
a decimal.

**8. Airline scores themselves are `rated`, and unvalidated.**
No published study was located that validates Skytrax star ratings, AirlineRatings placements or
APEX ratings against measured passenger comfort or wellbeing outcomes. They are expert/vote
aggregates being used as a proxy. Combined with the airlinequality.com closure already documented
above, the airline axis is the **weakest-evidenced axis in the model** — which is an uncomfortable
place for the axis carrying 55% of the weight.

### What changed

| Component | Before | After | Evidence |
|---|---|---|---|
| `airlineWeight` / `aircraftWeight` | 0.55 / 0.45 | **0.55 / 0.45 (unchanged)** | `judgment` — bracketed 0.30–0.70 by literature pointing both ways |
| Block-hour weighting | linear, block hours | **unchanged** | `rated` — time-dependence measured; linearity is judgment |
| `gulfHubReliability` | −1.0 | **unchanged** | `judgment` — operational risk, not comfort science; no literature |
| `metalUncertainty` | −0.75 | **unchanged** | `judgment` — expected-value arithmetic over this file's own scores |
| `extraSector` | −0.25 | **unchanged** | `judgment` — no evidence located in either direction |
| `cabinAltitude` | *absent* | **−0.25 per sector ≥ 6 h on an aircraft certified to ~8,000 ft cabin altitude** | `measured` (Muhm 2007) for direction and threshold; magnitude is judgment |

The 6-hour threshold is a judgment reading of Muhm's **measured 3–9 hour onset window**. Sensitivity:
at a 3-hour threshold, Malaysia's KUL–PER A330neo sector and Qantas' SIN–PER A330-300 sector would
also take −0.25, dropping row 4 to 7.2 and row 6 to 6.6 — still no reordering.

### Before / after on the published ranking, top 6

| # | Itinerary | Before | Cabin-alt. adj. | **After** | Order |
|---|---|---|---|---|---|
| 1 | SQ BCN → SIN → PER, A350/A350 | 9.3 | 0 (both ~6,000 ft) | **9.3** | unchanged |
| 2 | CX MAD → HKG → PER, A350/A350 | 9.0 | 0 | **9.0** | unchanged |
| 3= | SQ BCN → SIN → PER, 787-10 rotation | 9.0 | 0 (787 is ~6,000 ft) | **9.0** | unchanged |
| 3 | SQ MAD → BCN → SIN → PER | 8.9 | 0 | **8.9** | unchanged |
| 4 | MH LHR → KUL → PER | 7.5 | 0 (A330neo sector is 5h20, under threshold) | **7.5** | unchanged |
| 5 | QR MAD/BCN → DOH → PER | 7.1 | **−0.25** (777-300ER, ~11 h at 8,000 ft) | **6.9** | unchanged |

Also moved: **Emirates MAD → DXB → PER 6.4 → 6.2** (777-300ER, ~10h45 at 8,000 ft). **Qantas'
LHR → PER nonstop is unpenalised** — its 16h40 is flown at ~6,000 ft, which by Muhm 2007 is the one
genuine, evidence-backed thing the 787 gives back for its narrow seat. Nothing reorders.

### Weight sensitivity: the recommendation is invariant

Recomputed by hand at the two ends of the evidential bracket, with all adjustments applied
(adjustments are additive constants — they shift a row but cannot interact with the weight):

| Itinerary | Aircraft-heavy (0.30 / 0.70) | Published (0.55 / 0.45) | Airline-heavy (0.70 / 0.30) |
|---|---|---|---|
| **SQ BCN → SIN → PER** | **9.2** | **9.3** | **9.4** |
| CX MAD → HKG → PER | 9.0 | 9.0 | 9.0 |
| MH LHR → KUL → PER | **8.0** | 7.5 | 7.2 |
| QR via DOH *(incl. −1.25)* | 6.4 | 6.9 | **7.2** |
| BA+QF via LHR/SIN *(incl. −0.25)* | 7.1 | 6.9 | 6.7 |
| LH+TG via MUC/BKK *(incl. −0.25)* | 7.1 | 6.7 | 6.4 |

**Singapore Airlines wins at every weighting in the bracket**, because it leads on both axes. The
weight only rearranges the middle: at aircraft-heavy, Malaysia's A350 + 2-4-2 A330neo climbs to
third; at airline-heavy, Qatar does. That is precisely the trade the slider in workstream B should
let the couple make — and it is a genuinely honest thing to show them, because the choice between
those two mid-table options *is* a values question the science does not settle.

### Summary label per component

| Component | Label | Basis |
|---|---|---|
| Seat width in config scores | **measured** | Anjani et al. 2021 (n=311); Molenbroek et al. 2017 |
| Seat pitch in config scores | **measured** | Anjani et al. 2020 (n=294); Kremser et al. 2012 (n=30); Liu et al. 2021 (n=53) |
| Width : pitch exchange rate (7.5:1 as built) | **contradicted** | Measured rate is ~4:1 (Anjani et al. 2021) — over-weights width ~2× |
| 2-4-2 / side-pair premium | **rated** | Anjani et al. 2020 (middle-seat penalty); Marazita & Parkinson 2026; Liu et al. 2021 (own armrest) |
| Seat dimensions themselves (inches) | **measured** | aeroLOPA / carrier-published, per `carrierConfigs[].source` |
| Cabin altitude | **measured** | Muhm et al. 2007, NEJM, n=502, 20 h, blinded |
| Cabin humidity | **no evidence of benefit** | Complaints documented (Wang et al. 2022; Bekö et al. 2015); no intervention trial — not scored |
| Airline score | **rated** | Skytrax / AirlineRatings / APEX aggregates; no validation study located |
| Airline : aircraft weight | **judgment** | Evidence brackets 0.30–0.70 (Vink et al. 2012 vs Ban & Kim 2019); no basis to pick |
| Block-hour weighting | **rated** | Time-dependence measured (Lewis et al. 2026; Muhm et al. 2007); linear form is judgment |
| Gulf hub −1.0 | **judgment** | Operational/geopolitical risk; outside the comfort literature entirely |
| Unconfirmed metal −0.75 | **judgment** | Expected-value arithmetic over this file's own config scores |
| Extra sector −0.25 | **judgment** | No study located comparing split vs single-sector itineraries |
| Arrival / departure time | **missing** | Huang et al. 2026 models a real effect the formula does not score |
| Noise and vibration | **missing** | Vink et al. 2022 ranks them top discomfort drivers; not scored here |
| Passenger anthropometry | **missing** | Molenbroek et al. 2017; Marazita & Parkinson 2026 — effects are body-size dependent |

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
| 5 | Qatar Airways | MAD/BCN → DOH → PER | A350-1000 (18", 33") → **777-300ER (17.2", 3-4-3)** | 9.0 | 7.1 | **−1.25** | **6.9** *(8.1 raw)* | €1,150–1,700 |
| 5= | Malaysia Airlines | VLC → LHR → KUL → PER | + BA narrowbody positioning | 6.5 | 8.4 | −0.25 | **7.1** | €1,150–1,700 |
| 6 | British Airways + Qantas | VLC → LHR → SIN → PER | **A380 upper deck (17.6", 31", 2-4-2)** → QF A330-300 | 6.7 | 7.6 | −0.25 | **6.9** *best case* | €1,600–2,400 **+ £106 pp APD** |
| 7 | Lufthansa + Thai | VLC → MUC → BKK → PER | **A380 upper deck (18", 2-4-2)** → 787-8 | 6.3 | 7.8 | −0.25 | **6.7** | €1,150–1,700 |
| 7= | Qantas | VLC → LHR → **PER nonstop** | **787-9 (17.2", 16h40 unbroken)** | 7.4 | 5.9 | — | **6.7** | €1,800–2,600+ **+ £106 pp APD** |
| 8 | Emirates | MAD → DXB → PER | A380 (18") → **777-300ER (17.0")** | 8.0 | 6.7 | **−1.25** | **6.2** *(7.4 raw)* | €1,150–1,700 |
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
  Passenger Duty and an unprotected positioning leg into a UK hub in December. It is, however, the
  one row that *gains* from the 2026-08-27 cabin-altitude adjustment by not taking it: 16h40 at
  ~6,000 ft rather than 8,000 ft is the single evidence-backed thing the 787 gives back.
- **Rows 5 and 8 each moved −0.2 on 2026-08-27** when the cabin-altitude adjustment was added: both
  put a long sector on a 777-300ER at 8,000 ft. Neither changed rank. See *Evidence basis* above.

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
| **787-8 / -9 / -10 (3-3-3)** | **6.5** | The 787 tube is ~5–6" narrower than the A350's; at 9-abreast that's ~17.0–17.2". **That 0.8" is the whole difference between the good and bad long-haul economy cabins.** A stretch adds length, not width. **Revised 2026-08-27:** the old line here — *"lower cabin altitude and higher humidity are real but don't recover width"* — was wrong on the first half. Cabin altitude is the best-evidenced comfort variable in the literature (Muhm et al. 2007, NEJM, n=502) and is now scored as an explicit adjustment; the 787's ~6,000 ft is worth −0.25 *avoided* on every long sector against an 8,000 ft type. Humidity stands: complaints are documented, benefit is not. |
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
7. **Cabin-altitude figures.** `aircraft[].cabinAltitudeFt` drives the new −0.25 adjustment and is
   manufacturer/secondary sourced, not peer-reviewed. The A380's (~6,000 ft) is the lowest-confidence
   entry and is the one that would matter if the BA A380 routing goes live. The A330-900neo at
   ~7,000–8,000 ft is the counter-intuitive one worth double-checking — it is aluminium, not composite,
   despite the neo branding.

---

## Sources

### Peer-reviewed literature (evidence basis, added 2026-08-27)

Seat geometry and comfort:

1. Anjani, S., Song, Y., Hou, T., Ruiter, I. A., & Vink, P. (2021). *The effect of 17-inch-wide and
   18-inch-wide airplane passenger seats on comfort.* **International Journal of Industrial
   Ergonomics, 82, 103097.** n=311. One extra inch of width ≈ four extra inches of pitch.
   [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0169814121000159) ·
   [TU Delft record](https://research.tudelft.nl/en/publications/the-effect-of-17-inch-wide-and-18-inch-wide-airplane-passenger-se/)
2. Anjani, S., Li, W., Ruiter, I. A., & Vink, P. (2020). *The effect of aircraft seat pitch on
   comfort.* **Applied Ergonomics, 88, 103132.** n=294 at 28/30/32/34"; middle seat worse than
   window/aisle. doi:10.1016/j.apergo.2020.103132
3. Kremser, F., Guenzkofer, F., Sedlmeier, C., Sabbah, O., & Bengler, K. (2012). *Aircraft seating
   comfort: the influence of seat pitch on passengers' well-being.* **Work, 41(Suppl 1), 4936–4942.**
   Well-being peaks at 34–40" and declines beyond. [doi:10.3233/WOR-2012-0789-4936](https://doi.org/10.3233/WOR-2012-0789-4936)
4. Liu, Z., Rotte, T., Anjani, S., & Vink, P. (2021). *Seat pitch and comfort of a staggered seat
   configuration.* **Work, 68(s1).** n=53; 27" unacceptable; own armrest removes lateral complaints.
   [SAGE](https://journals.sagepub.com/doi/10.3233/WOR-208014)
5. Anjani, S., Song, Y., & Vink, P. (2021). *Designing a floor plan using aircraft seat comfort
   knowledge by aircraft interior experts.* **Work, 68(s1), S7–S18.** 18"×30" ≈ 17"×34" for comfort.
   [SAGE](https://journals.sagepub.com/doi/10.3233/WOR-208001)
6. Molenbroek, J. F. M., Albin, T. J., & Vink, P. (2017). *Thirty years of anthropometric changes
   relevant to the width and depth of transportation seating spaces, present and future.*
   **Applied Ergonomics, 65, 130–138.** Seated hip breadth grew; buttock-knee length did not.
   [TU Delft repository](https://repository.tudelft.nl/islandora/object/uuid:c95c6482-e10e-4a1a-8b4c-bf70009855eb)
7. Marazita, Z. V., & Parkinson, M. B. (2026). *The effects of aeroplane seat width, load factor and
   demographics on the spatial sufficiency, acceptability and comfort of passengers.* **Ergonomics.**
   [doi:10.1080/00140139.2026.2675534](https://doi.org/10.1080/00140139.2026.2675534)

Comfort constructs and passenger priorities:

8. Vink, P., Bazley, C., Kamp, I., & Blok, M. (2012). *Possibilities to improve the aircraft interior
   comfort experience.* **Applied Ergonomics, 43(2), 354–359.** 10,000+ trip reports, 153 interviews;
   legroom r=0.718. [PubMed 21803331](https://pubmed.ncbi.nlm.nih.gov/21803331/)
9. Ahmadpour, N., Robert, J.-M., & Lindgaard, G. (2016). *Aircraft passenger comfort experience:
   underlying factors and differentiation from discomfort.* **Applied Ergonomics, 52, 301–308.**
   Comfort and discomfort are one spectrum. doi:10.1016/j.apergo.2015.07.029
10. Vink, P., Vledder, G., Song, Y., Herbig, B., Reichherzer, A., & Mansfield, N. (2022). *Aircraft
    interior and seat design: priorities based on passengers' opinions.* **International Journal of
    Aviation, Aeronautics, and Aerospace, 9(1).** Noise and vibration top the discomfort drivers.
    [ERAU Commons](https://commons.erau.edu/ijaaa/vol9/iss1/3/)

Service vs hard product:

11. Ban, H.-J., & Kim, H.-S. (2019). *Understanding customer experience and satisfaction through
    airline passengers' online review.* **Sustainability, 11(15), 4066.** n=9,632 Skytrax reviews;
    standardised β: value for money 0.603, staff 0.176, F&B 0.102, seat comfort 0.080.
    [doi:10.3390/su11154066](https://doi.org/10.3390/su11154066)
12. Akan, Ş. (2025). *Multidimensional seat comfort and its influence on passenger recommendation
    behavior: insights from Skytrax reviews.* **Journal of Aviation, 9(3), 676–683.**
    [doi:10.30518/jav.1773181](https://doi.org/10.30518/jav.1773181)

Cabin environment, fatigue and journey structure:

13. Muhm, J. M., Rock, P. B., McMullin, D. L., Jones, S. P., Lu, I. L., Eilers, K. D., Space, D. R.,
    & McMullen, A. (2007). *Effect of aircraft-cabin altitude on passenger discomfort.* **New England
    Journal of Medicine, 357(1), 18–27.** n=502, 20-hour blinded hypobaric chamber trial.
    [doi:10.1056/NEJMoa062770](https://www.nejm.org/doi/full/10.1056/NEJMoa062770)
14. Huang, S., Bin, Y. S., Caillaud, C., & Postnova, S. (2026). *Modeling the effects of flight
    itinerary on jetlag duration.* **Sleep, 49(6), zsag063.** 55,296 simulated flights.
    [doi:10.1093/sleep/zsag063](https://doi.org/10.1093/sleep/zsag063)
15. Botonis, P. G., Toubekis, A. G., Hill, D. W., & Mündel, T. (2025). *Impact of long-haul airline
    travel on athletic performance and recovery: a critical review of the literature.* **Experimental
    Physiology, 110, 1584–1602.** [PMC12576017](https://pmc.ncbi.nlm.nih.gov/articles/PMC12576017/)
16. Lewis, J., McDonnell, B. J., Butlin, M., et al. (2026). *The impact of healthy motion seating on
    lower-limb blood flow and blood pressure response to simulated long-haul air travel.*
    **Experimental Physiology.** Discomfort worsened across 6.5 h (P < 0.05).
17. Wang, F., You, R., Zhang, T., & Chen, Q. (2022). *Recent progress on studies of airborne
    infectious disease transmission, air quality, and thermal comfort in the airliner cabin.*
    **Indoor Air, 32(4).** "Low humidity is a major complaint."
18. Bekö, G., Allen, J. G., Weschler, C. J., Vallarino, J., & Spengler, J. D. (2015). *Impact of
    cabin ozone concentrations on passenger reported symptoms in commercial aircraft.* **PLoS ONE.**
    Dry mouth/lips 26%, dry eyes 22%, nasal stuffiness 19%.
19. World Health Organization (2007). *WRIGHT project phase I — study results released on travel and
    blood clots.* VTE risk roughly doubles after ≥4 h seated travel; absolute risk ~1 in 6,000.
    [WHO](https://www.who.int/news/item/29-06-2007-study-results-released-on-travel-and-blood-clots)

**Not found, despite looking:** no study comparing a single ultra-long sector against a split
itinerary with a stopover on passenger comfort, fatigue or sleep outcomes; no intervention trial
showing raised cabin humidity improves passenger outcomes; no validation of airline star ratings
against measured passenger comfort. Those three gaps are why three of the four adjustments in this
formula are labelled `judgment`.

### Ratings and seat-geometry sources

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
