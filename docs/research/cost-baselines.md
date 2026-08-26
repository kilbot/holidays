# Cost-of-travel baselines — a couple in Australia, Dec 2026 – Feb 2027

Research for [issue #5](https://github.com/kilbot/holidays/issues/5). Feeds the site's per-day cost parameters for **Home base** days and paid **Capsule** days.

**Researched:** 26 August 2026. Every source URL carries an access date in [Sources](#sources).
**Currency:** all figures are **AUD per couple per day** unless explicitly marked *pp* (per person) or *per night*.
**FX rate used: A$1 = €0.61**, matching [`domestic-flights.md`](./domestic-flights.md). See [§6](#6-fx-audeur).

> **Confidence.** Three tiers, marked throughout:
> - **[measured]** — published rate, official price list, or industry performance data (STR, FuelWatch, Numbeo, operator price pages). Use as-is.
> - **[derived]** — built from measured inputs by arithmetic stated in the text (e.g. groceries + one meal out + two coffees). Sound, but the basket is a judgement call.
> - **[estimate]** — a planning band with no single hard source. Treat as an envelope, widen it if the Plan is sensitive to it.
>
> No live Dec-2026/Jan-2027 quotes could be pulled — booking engines block dated automated searches and the trip is ~4 months out. **Re-snapshot lodging and car hire in late September / October 2026**, which is also when they should actually be booked.

---

## 1. Headline parameter table

The numbers the cost model should default to. Everything below this section is the derivation.

### Per-day, per couple, AUD — plan-on values

| Day type | Budget | **Mid (default)** | Nice |
|---|---|---|---|
| **Home-base day, city** (Perth family home) | **A$75** | **A$160** | **A$285** |
| **Home-base day, regional** (farm, day drives) | **A$95** | **A$195** | **A$330** |
| **Paid-city day, no car** (Syd/Melb/Hob) | **A$350** | **A$660** | **A$1,140** |
| **Paid-city day, no car** (Cairns, Jan) | **A$310** | **A$580** | **A$1,000** |
| **Car add-on**, per day held (mainland) | +A$90 | +A$110 | +A$140 |
| **Car add-on**, per day held (Tasmania, Jan) | +A$130 | +A$165 | +A$200 |

In EUR at €0.61: mid home-base day ≈ **€98**, mid paid-city day ≈ **€403**, mid paid-city day with car ≈ **€470**.

### Component breakdown (mid tier)

| Component | Home-base city | Home-base regional | Paid city |
|---|---|---|---|
| Lodging | A$0 | A$0 | A$320 |
| Food & drink | A$85 | A$85 | A$220 |
| Fuel / local transport | A$15 | A$50 | A$0 (car priced separately) / A$20 transit |
| Activities | A$60 | A$60 | A$120 |

### Peak multipliers (apply to the base day above)

| Window | Lodging | Food | Car/day | Notes |
|---|---|---|---|---|
| Ordinary summer day (mid-Jan) | ×1.0 | ×1.0 | ×1.0 | baseline |
| **24–26 Dec (Christmas)** | **×1.5–2.0** | ×1.10 | ×1.3–1.8 | public-holiday surcharge on 25 & 26 Dec |
| 27–30 Dec | ×1.4–1.8 | ×1.0 | ×1.3–1.8 | |
| **31 Dec, Sydney (NYE)** | **×2.5–3.0**, min 3 nights | ×1.2 | ×1.3–1.8 | see [§5](#5-the-nye-and-christmas-problem) — this is a block booking, not a night |
| 1–26 Jan (school holidays) | ×1.2–1.4 | ×1.0 | ×1.3–1.6 | |
| Late Jan – Feb (after school return) | ×1.0–1.1 | ×1.0 | ×1.0–1.2 | cheapest paid-city window of the trip |
| **Cairns, all of January** | **×0.8–0.9** | ×1.0 | ×1.0 | wet season = low season, runs counter to the rest of the country |

Public-holiday surcharge of **10–15% on the whole bill** applies in most Australian venues on 25 Dec, 26 Dec, 1 Jan and 26 Jan. [measured — industry-standard practice, permitted where disclosed]

---

## 2. Home-base days (WA — free lodging, borrowed car)

Only food, fuel and activities are payable. Lodging and vehicle cost A$0, but **fuel is not free** and is the single most under-modelled line for the WA leg.

### 2.1 Food

Measured inputs (Perth, Numbeo, 20 Aug 2026):

| Item | Perth | Sydney |
|---|---|---|
| Inexpensive restaurant meal, pp | A$30.00 | A$25.00 |
| Mid-range dinner for two, 3 courses, no drinks | A$125.00 | A$130.00 |
| McMeal | A$15.10 | A$16.50 |
| Domestic draught beer 0.5 L | A$12.00 | A$11.00 |
| Cappuccino | A$6.18 | A$5.58 |

Groceries: the average WA household spends **A$164/week** on groceries, against A$226 in NSW and a national household average of A$207 [measured — Finder Consumer Sentiment Tracker, 2026]. Two adults self-catering come in around **A$200/week ≈ A$29/day** [derived]. Guides put a two-adult food budget at A$160–280/week, which brackets that.

**Home-base food tiers, per couple per day** [derived]:

| Tier | Basket | A$/day |
|---|---|---|
| Budget | Groceries only, occasional coffee | **45** |
| **Mid** | Groceries + one casual meal out (~A$60 for two) or one café brunch, plus two coffees, ~4 days in 7 | **85** |
| Nice | A proper dinner out most days (A$125–150 for two with a drink), café breakfasts | **140** |

Reality check on the mid tier: a full day of eating out in Perth — two coffees (A$12), café brunch for two (A$50), pub lunch for two (A$60) — is already **A$122** before dinner. The A$85 mid figure assumes most breakfasts and roughly half of dinners happen at the family home. That assumption is worth surfacing in the UI, because it is where a WA week silently doubles.

### 2.2 Fuel

| Input | Value | Source quality |
|---|---|---|
| Perth ULP 91, 19 Aug 2026 | **206.7 c/L** (FuelWatch average) | [measured] |
| Perth ULP 91, 17 Aug 2026 | 193.7 c/L (500-site average; range 182.7–216.9) | [measured] |
| Perth, Numbeo Aug 2026 | 183 c/L | [measured] |
| **Regional WA median, 16 Aug 2026** | **209.8 c/L** — 15.9 c/L above Greater Perth's 193.9 c/L | [measured] |

Perth runs a weekly price cycle (Tuesday is the trough, Wednesday the peak — FuelWatch publishes tomorrow's prices, so the cycle is gameable). Regional WA does not cycle, sits **~16 c/L higher**, and individual outback sites go far higher (one WA station at 450 c/L on the 16 Aug snapshot).

**Model constants:**

- Perth fuel price: **A$2.00/L**; regional WA: **A$2.15/L** [derived from the above; deliberately mid-cycle, not trough]
- Consumption, typical borrowed family car: **8 L/100 km**
- ⇒ **A$0.16 per km in Perth, A$0.17 per km regional** [derived]

| Day pattern | km | A$/day |
|---|---|---|
| Pottering around Perth (beach, shops, family) | 40–60 | **10** |
| Farm / regional day, local driving | 150–250 | **30** |
| Big drive day (e.g. Perth ⇄ Margaret River, ~560 km round) | 300–600 | **60–95** |

### 2.3 Activities

WA home-base days skew free — beaches, Kings Park, the river, family time. Blended across a week [estimate]:

| Tier | A$/day per couple | What that buys across a week |
|---|---|---|
| Budget | **20** | Beach and park days, parking, one cheap entry |
| **Mid** | **60** | One paid thing every second or third day: gallery, winery tasting, brewery lunch |
| Nice | **120** | A paid activity most days, plus one big-ticket day per week |

Big-ticket WA reference prices [measured, Aug 2026]:

| Item | Price |
|---|---|
| Rottnest ferry, return, pp (Fremantle B-Shed) | A$48–70 (from A$36 Barrack St; dynamic pricing, up to A$238 for packages) |
| Rottnest Island admission | included in ferry fare |
| Rottnest bike hire, pp | ~A$35 |
| **Rottnest day, per couple, all-in** | **A$200–250** |

---

## 3. Paid-city days (Sydney, Melbourne, Hobart, Cairns)

### 3.1 Lodging — nightly, per couple, peak summer (excluding Christmas/NYE)

Annual-average tier bands [measured, Aug 2026 industry guide]:

| Tier | AUD/night, national |
|---|---|
| Hostel/basic | 40–100 |
| Budget hotel | 100–180 |
| 3-star | 150–250 |
| 4-star | 200–350 |
| 5-star | 350–700+ |

City bands, uplifted ~20–30% for the summer peak [derived from the annual bands plus the multipliers in §1]:

| City | Budget | **Mid (plan on)** | Nice |
|---|---|---|---|
| **Sydney** | 180–230 | **A$350** (300–400) | 450–700 |
| **Melbourne** | 150–200 | **A$280** (230–320) | 400–600 |
| **Hobart** | 150–200 | **A$250** (220–300) | 350–500 |
| **Cairns** (January) | 120–170 | **A$200** (180–240) | 300–450 |

Anchors for those bands:

- **Sydney, December 2025 actual market ADR: A$349.06**, occupancy 81.3%, RevPAR A$283.68 — the highest December RevPAR on record for the market. Sydney's full-year 2025 ADR was **A$334**. [measured — STR, reported Jan 2026]
- Sydney held occupancy above 70% on **all but five days** of December. Assume nothing is quietly available.
- **Hobart, January: ~A$156/night** average room rate, its dearest month, against ~A$92 in June [measured, hotel aggregator — sample skews cheap, hence the higher band above]. Hobart also leads the country on occupancy at 79.3%.
- National ADR 2025: **A$250.65**. A practical mid-range starting point published for 2026 is A$180–350/night.
- Sydney Airbnb 2026: private room A$80–180, whole 1-bed A$180–400, 2-bed A$280–700 [measured, STR-market guide]. NSW caps un-hosted Greater Sydney lettings at 180 days/year, which tightens summer supply.

**Airbnb vs hotel:** at the mid tier they land in the same band. Airbnb wins on a kitchen (drops the food line by A$60–90/day) and loses on cancellation risk — hosts cancelling in the weeks before NYE is a documented pattern. For the NYE anchor specifically, prefer a hotel.

### 3.2 Car rental

Aggregator headline rates for Australia, AUD, Aug 2026 [measured, but these are *teaser* rates — cheapest bucket, base rate only, no waiver, no airport fee]:

| Market | Annual avg | Dec | Jan | Peak note |
|---|---|---|---|---|
| Sydney | A$47/day | **A$74/day (+82%)** | ~9–18% below annual | small A$35–38, medium A$66–85, SUV A$72 |
| Melbourne (city) | — | **A$59/day (+37%)** | A$46/day at MEL airport | MEL airport Dec A$68 (+19%) |
| Cairns | A$157/day all-classes; from A$37 | — | medium ~A$80/day | small ~A$52, medium ~A$117, large ~A$163 |
| **Tasmania** | — | — | **A$98/day (+58% over annual)** | Hobart specifically quoted at **A$171/day in January** |

Add-ons that the teaser rate hides [measured]:

- **Excess reduction at the counter: A$30–45/day** (some quotes A$41.87–62.81/day), and it often only cuts the excess to A$300–1,000, not zero.
- **Third-party excess cover bought online beforehand: A$5–12/day**, or A$120–180 for annual cover. On a 20-day east-coast rental this saves **A$500–700**. Model it as the default.
- Standard excess if you decline cover: ~A$3,300 small hatch, ~A$5,500 SUV, A$8,000+ 4WD/luxury.
- Fuel on top at A$0.16/km.

**Model constants, per day held** [derived]:

| Market | Base rate, peak | + pre-bought excess cover | **All-in plan-on** |
|---|---|---|---|
| Sydney / Melbourne | A$70–95 | A$8 | **A$110** |
| Cairns | A$70–120 | A$8 | **A$120** |
| **Hobart / Tasmania, January** | A$100–170 | A$8 | **A$165** |

Add ~A$25–35/day if buying the waiver at the counter instead, and A$50–150 one-off for airport pickup fees and one-way drop fees.

> **Note on the tiers above:** the "budget" tier (A$90/day mainland, A$130/day Tasmania) reflects **major-brand** pricing (Avis/Budget/Hertz/Thrifty/Europcar/Sixt) as surfaced by aggregators. It is not the market floor. See below.

#### Budget-operator floor (added 2026-08-26 after user challenge)

**Pricing rule applied here:** the floor is the **bare base rate** for the cheapest credible operator, small car, booked ahead. Excess-reduction and third-party excess cover are **deliberately excluded** from the per-day figures — the travellers are relying on complimentary credit-card rental excess cover. The card-cover caveats are in "What the floor does not include" below and must be checked before the model is trusted.

**Independent operators — advertised base rates**

| Operator | Market | Small car, advertised base | Standard excess | Notes |
|---|---|---|---|---|
| **Bayswater / No Birds** | Sydney (Mascot, Woolloomooloo, Artarmon), Perth | **A$30/day** "Early Bird" small hatch (Kia Stonic / Suzuki Swift / Mazda CX-3); A$35/day small-medium hatch | **A$5,000** | Fleet under 3 years old. **No airport counter** — three suburban depots, shuttle from SYD instead, so no airport surcharge. No km cap on standard rentals (a separate "City Use" rate is capped at 100 km/day). Ages 21–84, P1/P2 and international licences accepted. Damage-reduction to A$0 is A$15/day if wanted. 5% off for prepay 48h ahead. |
| **Bargain Car Rentals** | Hobart city + Hobart Airport, Launceston Airport, Cairns, mainland capitals | **A$40/day** compact, Hobart, quoted for 29 Aug–3 Sep 2026 (off-peak); site banner "from A$35/day"; A$38.85/day seen as cheapest Hobart supplier in a 72-hour aggregator sample | **A$5,500** standard / A$6,500 commercial | Free additional driver, **free under-25 drivers**, no booking fee, free cancellation. Gold package drops excess to A$2,500, Platinum to nil. Min age 21 (25 luxury), 12 months' licence. Bond A$500 pre-auth. **Claims handling fee A$270 (single-vehicle/theft) to A$370 (multi-vehicle) on top of the excess.** 1.4% card surcharge. |
| **Lo-Cost Auto Rent** | Hobart city, Hobart Airport, Launceston Airport | Rates not published on-site (phone/booking-form only) | **A$990** (AU/NZ licence) / A$1,500 (overseas licence) | Family-run since 1984. **The lowest standard excess found anywhere in this research by a factor of five** — which matters more than the headline rate if card cover has gaps. Fleet is deliberately older, "average 3 to 7 years". Min age **19**, P-platers accepted with 2 years' licence. Covers exactly the Hobart-pickup / Launceston-drop pattern this trip needs. **Ring for a January quote — this is the single highest-value call to make.** |
| **East Coast Car Rentals** | Cairns, Sydney, Hobart, Launceston + 6 more airports | A$36.17/day seen in a 72-hour Cairns aggregator sample | not published | **Unlimited km on most rentals**, free airport shuttle at Cairns. Ran a 15% off all-inclusive/prepaid promo for Jan–Mar 2026 pickups; watch for the 2027 equivalent. |
| **Apex** | Hobart Airport + mainland | from A$55/day at HBA (aggregator) | **A$2,750** | Mid-pack on rate, but half the excess of the other budget operators. |
| **Redspot** | Hobart, Launceston | A$43/day economy (off-peak, VroomVroomVroom) | not published | Cheapest *listed* supplier on VVV's Hobart page. Does published Hobart↔Launceston one-way hire. |
| **Alpha Car Hire**, **Atlas**, **SafeDrive**, **YesDrive**, **Economy Rent a Car**, **Kangaroo** | various | A$31–37/day off-peak teasers (Kayak Hobart supplier list: SafeDrive A$31, Kangaroo A$33, YesDrive A$33, Economy A$37) | not published | Aggregator teasers only; treat as unverified until quoted with dates. |

**Jucy** is now effectively a campervan/motorhome brand in Australia (A$200+/day compact SUV, A$300+/day campervans) — **not a budget car option** for this trip. **"RediCar"** does not appear to exist as a Tasmanian operator; the likely intended name is **Redspot** (listed above).

**Turo / peer-to-peer:** Turo operates in Australia (it absorbed Car Next Door) with listings in Sydney, Hobart and Cairns, and hosts commonly discount 3+/7+/30+ day trips. **No verifiable dated January price could be pulled** — turo.com returns 403 to automated fetches and prices are per-host. More importantly, **Turo is the wrong tool for this trip's insurance strategy**: Turo's guest protection is provided by Turo Travels Mutual, a discretionary mutual, **not an insurance policy**; decline it and the guest is liable for damage or theft "up to A$200,000". Complimentary credit-card rental excess cover almost universally requires a *licensed/recognised hire company under a formal rental agreement* and that the rental company's own waiver be taken — a peer-to-peer trip will very likely fall outside it. **Do not model Turo as the floor.** Uber Carshare (ex-Car Next Door) is also a poor fit: it prices per-hour **plus per-km**, so multi-hundred-km Tasmania days blow out (reported A$102 for one day including distance).

**Corrected budget floor, per day held, base rate only**

| Market | Off-peak observed base | **January 2027 budget floor (plan on)** | Derivation |
|---|---|---|---|
| **Mainland cities (Sydney, Cairns)** | A$30–40/day | **A$45/day** | No Birds Sydney publishes A$30/day small hatch year-round from suburban depots; Cairns is in its **low** season in January (wet season), with East Coast/Atlas teasers at A$36/day. A$45 carries a modest peak/availability buffer over the published rate. Cairns late-January is the cheaper end of this. |
| **Tasmania (Hobart pickup, Jan)** | A$38–43/day | **A$85/day** | Budget operators sit at A$38–43/day off-peak. Hobart's January multiplier is real and large: VroomVroomVroom's Hobart average runs A$64/day in August vs **A$171/day in January** (×2.7); Kayak's Hobart average runs A$39/day in August vs A$116/day in December (×3.0). Those averages are all-classes and major-brand-weighted. Applying a conservative ~×2 to the *independent* small-car base gives **A$85/day**, well under the A$130 previously modelled but well over the off-peak rate. **Confidence: low-medium — this is the one number that most needs a real dated quote.** |

Net effect on the model: the mainland car add-on floor drops from A$90 to **A$45/day**, and Tasmania from A$130 to **A$85/day**. Over a 9-day Tasmania leg plus 3 Sydney days that is roughly **A$540** back into the A$500/couple/day cap.

**What the floor does not include — caveats, not dollars**

- **Credit-card excess cover has conditions that bite.** Typically: the trip must be paid on the card; **only the cardholder is covered to drive** (a second driver voids it); the hire must be from a licensed rental company with the company's own insurance/waiver in place; hire periods are usually capped at 30 days; and the standard exclusions are **windscreens, tyres, headlights, and overhead/underbody damage** — which are precisely the Tasmanian gravel-road failure modes. Unsealed-road driving is excluded under both most card policies and most rental agreements. **Confirm the specific card's PDS covers *domestic* Australian hire** — several issuers (CommBank, ING, BankVic, Qudos) restrict the benefit to overseas travel only. And note **cards are actively withdrawing this benefit: a range of cards stopped offering complimentary rental vehicle cover from 15 May 2026** (BOQ and NAB flagged) — re-verify the card is still covered before relying on it.
- **Excess sizes if the card cover fails:** No Birds A$5,000, Bargain A$5,500 (A$6,500 commercial), Apex A$2,750, **Lo-Cost A$990**. Lo-Cost's A$990 excess is small enough to self-insure, which is a genuinely different risk posture from the others.
- **Claims handling fees sit *on top* of the excess** and card policies generally reimburse the excess, not admin fees — Bargain charges A$270–370, plus an administration fee "up to A$65".
- **Airport vs suburban pickup:** an airport counter typically adds a **10–15% premium location surcharge**. No Birds sidesteps this entirely by being suburban-only with a shuttle; East Coast runs a free Cairns airport shuttle. Prefer city/suburban depots.
- **One-way Hobart → Launceston:** no operator publishes the fee. Budget/Sixt/Redspot/Bargain/Lo-Cost all support it; Lo-Cost and Bargain have Launceston Airport counters. Budget one-way fees in Australia generally run **A$50–150** one-off, and some operators fold relocation into the quoted rate. **Get this quoted rather than assumed.**
- **Fleet age:** No Birds is under 3 years; Lo-Cost is deliberately 3–7 years (that is the trade for the A$990 excess and the low rate).
- **Km limits:** unlimited km is standard at East Coast and on No Birds' standard rate. Verify per-quote — a capped "city use" rate is useless for a Tasmania loop.
- **Availability, not price, is the Tasmania constraint.** Independent Tasmanian fleets are small and sell out over the Christmas–January school holidays. The A$85 floor only exists if booked by **late September / early October 2026**.

**Action to close the remaining uncertainty:** phone **Lo-Cost Auto Rent (03) 6231 0550** and **Bargain Car Rentals (03) 6165 0910** for a dated January 2027 Hobart-pickup / Launceston-drop quote, and price No Birds Sydney directly on nobirds.com.au for the Sydney dates. Aggregator engines returned **0 results** for January 2027 dates as of 26 Aug 2026, so no live dated quote could be captured in this pass.

#### Peak availability warnings

1. **Tasmania in January is the real constraint, not the price.** January is Tasmania's dearest car-hire month by a wide margin, the island's fleet is small, and vehicles sell out over the Christmas–January school holidays. **Book Tasmania by late September / early October 2026.** If a Tasmania Capsule is toggled on, the site should say so.
2. **Don't rent in Sydney or Melbourne CBD at all.** Both have good transit; parking is A$50–80/day on top. Rent only for the days a Capsule needs a car (Great Ocean Road, Blue Mountains, Mornington), and price it per day held, not per day of the stay.
3. **Cairns is comfortable** — January is its low season and the fleet is sized for the dry-season peak.
4. Book everything by **late September / October 2026**. Australian peak rental inventory only ratchets up; there is no late-drop pattern.

### 3.3 Food

Measured inputs [Numbeo Sydney, 26 Aug 2026; Australian dining-cost surveys, 2026]:

| Item | Price |
|---|---|
| Inexpensive restaurant meal, pp | A$25 |
| Mid-range dinner for two, 3 courses, no drinks | A$130 |
| Pub main (parma / steak / fish) | A$22–32 |
| RSL / club members' special | A$15–22 |
| Café brunch dish | A$22–28 (A$35+ with coffee and juice) |
| Casual café lunch (sandwich, salad, burger) | A$16–25 |
| Cappuccino | A$5.58 |
| Draught beer 0.5 L | A$11 |
| Sydney transit single / monthly | A$5.30 / A$217 |

**Paid-city food tiers, per couple per day** [derived]:

| Tier | Basket | A$/day |
|---|---|---|
| Budget | Self-catered breakfast (A$15), two cheap lunches (A$40), casual dinner (A$50), coffees (A$12) | **110** |
| **Mid** | Café brunch (A$50), light lunch (A$40), mid-range dinner with a drink (A$130) | **220** |
| Nice | Café brunch, proper lunch, restaurant dinner with wine (A$200+) | **340** |

A kitchen (Airbnb, apartment hotel) moves a mid day down to roughly **A$150**. Worth wiring as a per-Capsule flag.

### 3.4 Activities

Reference prices, all [measured] Aug 2026, adult unless stated:

| Item | pp | Per couple |
|---|---|---|
| Sydney Opera House guided tour | A$48 | A$96 |
| Taronga Zoo, online | A$55 (A$65 with ferry combo) | A$110–130 |
| **Sydney BridgeClimb**, day climb | A$328–348 (twilight A$374–394) | **A$656–696** |
| MONA entry, Hobart | A$39 (concession A$33) | A$78 |
| MONA ferry, return | A$30 | A$60 |
| Great Ocean Road day tour from Melbourne | A$95–155 (small group A$154) | A$190–310 |
| **Great Barrier Reef outer-reef day trip from Cairns** | A$276–317 (Sunlover A$317, Great Adventures A$276, Silverswift A$296); band A$220–350 | **A$550–630** |
| Sydney transit, capped day for two | — | A$18–19 |

**Blended activity tiers, per couple per day** [estimate — a blend across days, since not every day has a paid attraction]:

| Tier | A$/day | Pattern |
|---|---|---|
| Budget | **40** | Walks, beaches, free galleries, transit; one paid entry per few days |
| **Mid** | **120** | One paid attraction most days (Opera House, Taronga, MONA class) |
| Nice | **250** | Paid attraction daily, one big-ticket per city |

**Model big-ticket items as Capsule line items, not as per-day activity spend.** A GBR day (A$550–630/couple) or a BridgeClimb (A$660–700/couple) is 5× a mid activity day and will distort any per-day average it is folded into.

---

## 4. Assembling a day

Mid tier, per couple, AUD:

```
Home-base city day    =  0 lodging +  85 food +  15 fuel +  60 activities  = 160
Home-base regional    =  0 lodging +  85 food +  50 fuel +  60 activities  = 195
Paid city, no car     = 320 lodging + 220 food +  20 transit + 120 acts     = 680  → plan 660
Paid city, with car   = 320 lodging + 220 food + 110 car    + 120 acts      = 770
Cairns January        = 200 lodging + 220 food +  20 transit + 120 acts     = 560  → plan 580
```

Sanity check against the [Budget](../CONTEXT.md) of €12,000–20,000 for the couple: at €0.61, a 60-day trip of 30 home-base mid days (A$4,800 ≈ €2,930) plus 30 paid-city mid days (A$19,800 ≈ €12,080) is **€15,000 in ground costs alone**, before any flights. The lever is obvious and should be the site's headline finding: **every day moved from the east coast to a WA Home base saves ≈ A$500 / €305.**

---

## 5. The NYE and Christmas problem

### Sydney NYE — what it actually costs

**Sydney's market-wide ADR on 31 December 2025 was A$1,009.10 at 95.4% occupancy, with RevPAR of A$962.95.** Both the highest on record for the market, and the first time Sydney ADR passed A$1,000. Against Sydney's 2025 annual ADR of A$334, that is **×3.0**; against the December 2025 ADR of A$349, **×2.9**. [measured — STR, reported January 2026]

For scale, Sydney's other big December demand nights were far tamer: Lady Gaga peaked at A$379.65, a Jimmy Barnes concert at A$326.09. NYE is in a category of its own.

> One widely-circulated 2026 hotel-price guide calls the same A$1,009.10 figure "approximately 5.8× normal rates". **That arithmetic is wrong** — A$1,009.10 ÷ A$334 = 3.0. Use ×3.

### The trap: it is not one night

Every NYE-adjacent quirk below is more expensive than the headline rate:

- **Minimum stays.** Three nights is the harbourside standard; some properties want five to ten. YHA Sydney Harbour ran a **seven-night** NYE package. City hotels without a view are shorter — sometimes one or two nights. [measured — Sydney travel press, Jul 2026]
- **Full prepayment, non-refundable.** The reference case (InterContinental Sydney) required 100% prepayment at booking with a 100% cancellation penalty, alongside a three-night minimum, at A$900/night for a standard city-side room. [measured — OzBargain forum thread; older data point, prices have risen since]
- **Airbnb hosts cancel.** Documented pattern of NYE cancellations in the weeks beforehand, presumably to relist higher. Do not put a hard anchor on an Airbnb.
- **View premium is separate from the peak premium.** Genuine unobstructed-fireworks rooms sell out first and price far above the market ADR.

**Model it as a block, not a night:**

| Option | Model as | Cost for the couple |
|---|---|---|
| Harbourside hotel, view | 3 nights × A$900–1,100, non-refundable | **A$2,700–3,300** |
| City hotel, no view | 3 nights × A$550–700 | **A$1,650–2,100** |
| **Suburb on a train line** (Parramatta, Hurstville, North Sydney) | 1–2 nights × A$300–450 | **A$300–900** |

The suburb option is the recommended default: 20–40 minutes by train, roughly ×1.3–1.6 on the normal rate rather than ×3, and short minimum stays. [derived]

### NYE itself

| Option | pp | Per couple |
|---|---|---|
| Free public vantage points (foreshore, parks) | A$0 | **A$0** — arrive very early |
| Ticketed vantage point (Barangaroo Reserve, NPWS harbour sites) | prices not yet released for 2026/27 — 2025/26 comparable was in the tens-to-low-hundreds pp | budget **A$100–300** |
| Dinner cruise | A$280–800 typical; premium A$450–2,500 | **A$560–5,000** |
| Named examples | Sydney Heritage Fleet *Waratah* from A$650 (BYO food/drink); Captain Cook 4-course from A$2,150, 5-course from A$2,350 (min 2 guests) | |

NSW National Parks had **not yet published** its 2026/27 ticketed vantage-point prices as of 26 Aug 2026 — the page says "check back later this year". **Set a reminder for October 2026.** Premium cruises for the 2026/27 season are already reported as selling out.

### Christmas week

- Christmas Day / Boxing Day hotel rates run at **150–200% of normal**. [measured — 2026 Australian travel-cost guide]
- Peak versus shoulder generally: **+30–50% on accommodation alone**. [measured, same]
- **10% public-holiday surcharge** on hospitality bills is standard on 25 Dec, 26 Dec, 1 Jan, 26 Jan; some venues charge 15%.
- The Australian summer school-holiday window is **over 40 days** (mid-December to late January) — the whole trip sits inside it except the tail. The demand cliff is at the school return, ~28 Jan, right after Australia Day.
- Christmas week in Perth is largely a non-issue for this Plan: the couple are at the family home, and WA is a net *exporter* of holiday demand over Christmas.

### Cairns runs backwards

January is Cairns' **wet season and its low season**. Accommodation, tours and flights are all at their annual cheapest; late January is cheaper than early January (which still carries New Year demand). Trade-offs: heavy afternoon rain, high humidity, and **stinger season** (Nov–May) — box jellyfish, so mainland swimming only inside stinger nets, and stinger suits on reef trips (operators supply them). Apply the **×0.8–0.9** lodging multiplier and put the Cairns Capsule at the *end* of the trip. [measured — Tourism Australia, Virgin Australia destination guides, regional operators]

---

## 6. FX: AUD→EUR

| | Rate | Date |
|---|---|---|
| Spot | **A$1 = €0.6136** | 25 Aug 2026 |
| Spot | A$1 = €0.61216 | 11 Aug 2026 |
| August 2026 average | €0.611 | — |
| 2026 average to date | €0.6001 | — |
| 2026 high | €0.6196 | — |
| Earlier in 2026 | ~€0.58 | — |

**Model rate: A$1 = €0.61.** Matches [`domestic-flights.md`](./domestic-flights.md); keep the two documents in step. A$100 ≈ €61; €100 ≈ A$164.

**Stress rate: A$1 = €0.65.** The 2026 trajectory has been AUD-strengthening (€0.58 → €0.62), and the trip is 4–6 months out. Budgeting at €0.65 covers a further ~6% AUD appreciation and keeps the EUR total from being understated. Where the site shows a single EUR number, use €0.61; where it shows a worst case, use €0.65.

Do not model below €0.60 — that is the 2026 average and the trend has been away from it.

---

## 7. Open items

1. **NSW National Parks NYE ticketed vantage-point prices** — not published as of 26 Aug 2026. Check October 2026.
2. **Re-snapshot lodging and car hire in late Sep / Oct 2026** with dated searches. Every band in §3 is annual or Aug-2026 data with a modelled peak uplift, not a Dec-2026/Jan-2027 quote.
3. **Book Tasmania car hire and NYE accommodation by early October 2026.** Both are supply-constrained rather than price-constrained.
4. **Hobart and Cairns hotel bands are the weakest numbers here** — both derived from aggregator averages with cheap-sample bias rather than STR city data. Worth a targeted re-check.

---

## Sources

All accessed **26 August 2026**.

**Hotel market performance (highest trust — STR industry data)**
- [New Year's Eve pushed Sydney room rates to record-high — Hospitality Net](https://www.hospitalitynet.org/news/4130439/new-years-eve-pushed-sydney-room-rates-to-record-high) — NYE ADR A$1,009.10, occupancy 95.4%, RevPAR A$962.95; December 2025 Sydney ADR A$349.06, occupancy 81.3%
- [Sydney's Hotel Room Rates Reached All-Time High on New Year's Eve — Hotel Online](https://www.hotel-online.com/news/sydneys-hotel-room-rates-reached-all-time-high-on-new-years-eve)
- [Sydney hotels hit high note on New Year's Eve — TTR Weekly](https://www.ttrweekly.com/site/2026/01/sydney-hotels-hit-high-note-on-new-years-eve/)
- [Australian hotel sector sees record growth — CBRE Australia](https://www.cbre.com.au/press-releases/australian-hotel-sector-sees-record-growth-across-performance-and-investment) — 403 to automated fetch; cited via secondary reporting for the 8%+ RevPAR growth across Sydney/Brisbane/Perth/Adelaide/Cairns/Hobart

**Prices and cost of living**
- [Numbeo — Cost of Living in Sydney, Aug 2026](https://www.numbeo.com/cost-of-living/in/Sydney) — updated 26 Aug 2026
- [Numbeo — Cost of Living in Perth, Aug 2026](https://www.numbeo.com/cost-of-living/in/Perth) — updated 20 Aug 2026
- [Finder — Average grocery bill Australia 2026](https://www.finder.com.au/budgeting/average-grocery-bill) — WA A$164/wk, NSW A$226/wk, national A$207/wk
- [Eating Out in Australia: How Much Does a Meal Really Cost — Expensive Australia](https://expensive.com.au/eating-out-costs-australia/) — pub mains A$22–32, brunch A$22–28, club specials A$15–22
- [Australia Hotel Price Range: What You'll Pay Per Night — GMTC](https://gmtc.com.au/blog/australia-hotel-price-range) — pub. 18 Aug 2026; tier and city bands. **Note: its "5.8× normal rates" NYE claim is an arithmetic error; the correct figure is ×3.0**

**Fuel**
- [FuelNow — Petrol prices in WA, Perth vs regional, tracked daily](https://www.fuelnow.com.au/petrol-prices/wa) — 16 Aug 2026: regional WA median 209.8 c/L vs Greater Perth 193.9 c/L
- [Government of WA — Alert to Perth motorists, fill up now](https://www.wa.gov.au/government/announcements/alert-perth-motorists-fill-now-beat-the-petrol-price-rise-104) — FuelWatch Perth ULP average 206.7 c/L, 19 Aug 2026
- [PetrolMate — Perth petrol prices](https://petrolmate.com.au/city/wa/perth) — 17 Aug 2026, 500 sites, 182.7–216.9 c/L

**Car rental**
- [KAYAK Australia — Sydney car rentals](https://www.kayak.com.au/Cheap-Sydney-Car-Rentals.2258.cars.ksp) — AUD; annual avg A$47/day, December A$74/day
- [VroomVroomVroom — Hobart car hire](https://www.vroomvroomvroom.com.au/locations/hobart/) — January A$171/day
- [KAYAK Australia — Cairns car hire](https://www.kayak.com.au/Cheap-Cairns-Car-Hire.23637.cars.ksp)
- [National Cover Insurance — Rental car excess reduction costs](https://nationalcover.com.au/rental-car-excess-reduction/) — counter waiver A$30–45/day, standard excess A$3,300–8,000+
- [RentalCover — Car rental insurance in Australia](https://rentalcover.com/en/rental-guides/car-rental-insurance-australia) — third-party cover A$5–12/day

**Car rental — budget operators (all accessed 26 Aug 2026)**
- [No Birds / Bayswater Car Rental — Sydney car hire](https://www.nobirds.com.au/sydney/car-hire) — small hatch A$30/day Early Bird, small-medium hatch A$35/day, small SUV A$40/day; excess A$5,000, damage reduction to A$0 A$15/day; ages 21–84; Mascot / Woolloomooloo / Artarmon depots, no airport counter; standard rentals uncapped km, "City Use" rate capped at 100 km/day
- [Bargain Car Rentals — Hobart](https://bargaincarrentals.com.au/locations/hobart/) — "expect to pay between A$35 and A$85 a day"; 173 Harrington St Hobart city + Hobart Airport; free additional driver, free under-25 drivers
- [Bargain Car Rentals — Terms & Conditions](https://bargaincarrentals.com.au/terms-and-conditions/) — excess A$5,500 standard / A$6,500 commercial, Gold A$2,500, Platinum nil; claims handling fee A$270–370; admin fee up to A$65; bond A$500; min age 21 (25 luxury), max 85; 1.4% card surcharge
- [Lo-Cost Auto Rent — Tasmania](https://www.locostautorent.com/) — Hobart city, Hobart Airport, Launceston Airport; excess **A$990** AU/NZ licence, A$1,500 overseas; fleet "average 3 to 7 years old"; min age 19, P-platers with 2 years' licence; operating since 1984; rates not published online, (03) 6231 0550
- [East Coast Car Rentals — Cairns Airport](https://www.eastcoastcarrentals.com.au/car-hire/cairns/) — unlimited km on most classes, free airport shuttle; rates quote-only
- [East Coast Car Rentals — 15% off Jan–Mar 2026 pickups](https://www.eastcoastcarrentals.com.au/15offny2026/) — promo pattern to watch for Jan 2027
- [Apex Car Rentals — excess reduction cover](https://www.carhireexcess.com.au/guides/apex-car-rental/) — standard excess A$2,750, reducible to A$500 or nil
- [VroomVroomVroom — Hobart car hire](https://www.vroomvroomvroom.com.au/locations/hobart/) — **January A$171/day vs August A$64/day (×2.7)**; Bargain compact A$40/day and Redspot economy A$43/day quoted for 29 Aug–3 Sep 2026
- [KAYAK Australia — Hobart car hire](https://www.kayak.com.au/Cheap-Hobart-Car-Hire.12823.cars.ksp) — **August A$39/day vs December A$116/day (×3.0)**; cheapest suppliers SafeDrive A$31, Kangaroo A$33, YesDrive A$33, Economy Rent a Car A$37
- [Road Genius — Hobart Airport car hire](https://roadgenius.com.au/cars/rental/australia/hobart/hba-airport/) — airport counters carry a 10–15% premium location surcharge vs off-airport
- KAYAK dated search, Hobart 10–17 Jan 2027 — **returned 0 results** on 26 Aug 2026; dated Jan-2027 aggregator quotes not yet obtainable

**Car rental — insurance and card cover (all accessed 26 Aug 2026)**
- [Finder — Cheap car hire excess insurance](https://www.finder.com.au/travel-insurance/car-rental-excess-insurance/cheap-car-hire-excess-insurance) — RACV A$6.31/day for A$4,000 cover, nil excess; Tripcover A$11.15/day, cover to A$100,000
- [Canstar — Credit cards with complimentary car rental excess insurance](https://www.canstar.com.au/credit-cards/credit-cards-included-rental-car-insurance/) — **from 15 May 2026 a range of cards no longer offer complimentary rental vehicle cover (BOQ, NAB flagged)**; CommBank, ING, BankVic, Qudos restrict cover to overseas travel only; ANZ, Bendigo, Heritage, HSBC, NAB, St.George, Westpac list domestic cover; requires charging travel costs to the card and taking the hire company's own insurance
- [CHOICE — Car hire excess and hidden fees](https://www.choice.com.au/travel/on-holidays/car-hire/articles/car-hire-excess-and-hidden-fees) — card policies typically exclude windscreens, tyres, headlights, overhead/underbody damage and unsealed-road use; only the cardholder is covered; hire period usually capped at 30 days
- [Turo Australia — choosing a protection plan (guests)](https://help.turo.com/en_us/choosing-a-protection-plan-au-guests-H1_MqEuSi) and [Turo Travels Mutual](https://turo.com/au/en/policies/turotravels) — protection is a discretionary mutual, **not insurance**; declining leaves the guest liable for damage/theft up to A$200,000

**NYE and peak season**
- [Where to Stay for Sydney NYE — Sydney Expert](https://sydneyexpert.com/where-to-stay-for-new-years-eve-in-sydney/) — pub. 25 Jul 2026; 3-night harbourside minimum, YHA 7-night package, Airbnb cancellation risk, suburb alternatives
- [Price for a Room with View of NYE Fireworks in Sydney — OzBargain forum](https://www.ozbargain.com.au/node/429249) — InterContinental A$900/night standard city-side, 3-night minimum, 100% prepay non-refundable (older data point)
- [Sydney Harbour NYE Cruises — Sydney Expert](https://sydneyexpert.com/new-years-eve-cruise/) — cruise bands A$450–2,500 pp
- [Captain Cook Cruises — Sydney New Year's Eve](https://www.captaincook.com.au/whats-on/sydney-new-years-eve/) — A$2,150 / A$2,350 pp
- [NSW National Parks — New Year's Eve in Sydney Harbour](https://www.nationalparks.nsw.gov.au/new-years-eve-sydney-harbour) — 2026/27 prices **not yet released**
- [Sydney New Year's Eve — vantage points map](https://www.sydneynewyearseve.com/vantage-points) — official free and ticketed sites
- [How to Plan an Australian Holiday on a Budget 2026 — Cooee Tours](https://www.cooeetours.com.au/australian-travelling/blogs/australia-holiday-budget-2026.html) — Christmas/Boxing Day 150–200% of normal, peak vs shoulder +30–50%, 10% public-holiday surcharge

**Cairns seasonality**
- [Best times to visit Cairns — Virgin Australia](https://www.virginaustralia.com/au/en/destinations/cairns/best-time-to-visit-cairns/)
- [Cairns weather — Tourism Australia](https://www.australia.com/en/facts-and-planning/weather-in-australia/cairns-weather.html)
- [The Cheapest Time To Visit Cairns — Cairns Tours](https://cairns-tours.com/article/the-cheapest-time-to-visit-cairns)

**Attraction prices**
- [Sunlover Reef Cruises — Moore Reef](https://sunlover.com.au/moore-reef/) — adult A$317
- [Mona — Museum entry](https://mona.net.au/museum-entry) — booking terms; adult A$39 / concession A$33 via listings
- [Taronga Zoo — Ticket prices](https://www.taronga.org.au/sydney-zoo/plan/visitor-information/ticket-prices) — adult from A$55
- [BridgeClimb Sydney](https://www.bridgeclimb.com/) — day climb A$328–348, twilight A$374–394
- [SeaLink Rottnest Island — ferry fares](https://www.sealink.com.au/rottnest-island/ferry-information/ferry-fares/) — return from A$49, dynamic pricing
- [Rottnest Express — ferry fares](https://rottnestexpress.com.au/ferry-information/fares/)
- [Great Ocean Road Melbourne Tours](https://greatoceanroadmelbournetours.com.au/) — day tours from A$95

**FX**
- [exchange-rates.org — AUD/EUR 2026 history](https://www.exchange-rates.org/exchange-rate-history/aud-eur-2026) — 0.6136 on 25 Aug 2026; 2026 average 0.6001, high 0.6196
- [Wise — AUD to EUR rate history](https://wise.com/gb/currency-converter/aud-to-eur-rate/history)
