# Cost floors, recalibrated — cheap lodging, a camping tier, and re-derived Adventure ladders

Research for [issue #64](https://github.com/kilbot/holidays/issues/64). This document is the
**analysis**: the new constant values, the evidence behind each, and the re-derived cost ladder for
every deep Adventure. It changes no code. A builder wires it.

**Recalibrated:** 27 August 2026. New price checks carry their access date in [Sources](#sources).
**Currency:** AUD per couple unless marked. FX A$1 = €0.61 (`AUD_TO_EUR`, cost-baselines §6).

> **The directive being obeyed.** docs/CONTEXT.md, *Daily cap*: A$500/couple is **a ceiling, not a
> target** — "day-to-day the aim is cheapest possible (cheap Airbnb, motels, hostels — and a tent
> where it makes sense: *we'll camp if we have to*)". #64: *"plan-on = floor, always"*, and wiggle
> room lives in the contingency row and the worst-case band, never in inflated per-line estimates.

---

## 1. Headline: what moves

| Constant | Now | **Recalibrated** | Why |
|---|---|---|---|
| Sydney, cheap-room night | A$180 | **A$140** | suburb-on-a-train-line floor, not a CBD budget hotel |
| Melbourne, cheap-room night | A$150 | **A$120** | the capsule's own A$180 switching rule is a *ceiling* |
| Hobart / Tasmania, cheap-room night | A$150 | **A$120** | Hobart budget tier averages A$74; A$139 is its *high-season* budget figure |
| Cairns / Port Douglas, cheap-room night | A$120 | **A$100** | Port Douglas Motel from A$84; January is the low season |
| Regional (Margaret River, Byron), cheap-room night | A$150 | **A$120** | Surfpoint A$94, MR Motel A$129, Byron Feb from A$85 |
| **Camping tier (powered site, two people)** | *does not exist* | **A$45–55** | new `LodgingTier` — see §3 |
| Paid-market food, per day | A$110 | **A$80** | groceries-first with a kitchen or a camp stove — see §4 |
| Everything else (home-base rates, car floors, activities, peaks) | — | **unchanged** | already recalibrated on #10 / the §3.2 car correction |

Whole-Plan effect, default Scenario ("Fireworks NYE", 12 Dec – 22 Feb, all eight Adventures on):

| | Plan-on | With the 10% contingency row |
|---|---|---|
| Now | €22,310 | **€24,541** |
| Lodging floors only | €20,905 | €22,995 |
| Lodging + food floors | €19,770 | €21,747 |
| **+ re-derived event ladders (§6)** | **€18,270** | **€20,097** |

*(Recomputed by hand from `constants.ts`, `ledger.ts` and `rollup.ts` against the default Scenario's
scheduled placements; the ticket's "€24.3k" is the same figure within the rounding of two drive-fuel
Legs. Reconciliation tests should assert the engine's own number, not this one.)*

---

## 2. The budget-lodging floor, market by market

**What the tier means:** `airbnb` is the plan-on tier and the whole model's default. It is a
**private room or studio for two with a kitchen** — a cheap Airbnb, a motel, a caravan-park cabin.
Not a dorm, not a share house, not a "budget hotel" in the industry sense.

Plan-on figures are the **bottom of the observed range with a small peak/availability buffer**, and
the band's top is the research's own budget-band ceiling.

| Market | hostel (private twin) | **`airbnb` — plan-on** | **`camp` — new** | hotel (deliberate exception) |
|---|---|---|---|---|
| Sydney | A$110 [110–150] | **A$140** [140–200] | — (§3.4) | A$350 [300–400] |
| Melbourne | A$90 [90–130] | **A$120** [120–170] | A$55 [55–90] | A$280 [230–320] |
| Hobart / Tasmania | A$90 [90–130] | **A$120** [120–180] | A$45 [45–70] | A$250 [220–300] |
| Cairns / Port Douglas | A$80 [80–110] | **A$100** [100–150] | A$45 [45–65] | A$200 [180–240] |
| Regional (MR, Byron) | A$90 [90–130] | **A$120** [120–170] | A$50 [50–90] | A$250 [220–300] |
| Home base (Perth, farm) | A$0 | **A$0** | A$0 | A$0 |

### Evidence — spot checks, 27 August 2026

These are **live listing floors**, not dated Dec-26/Jan-27 quotes (booking engines still return
nothing for those dates — cost-baselines §7 item 2 stands). They are the sanity check on the bands,
not a replacement for the October re-snapshot.

| Market | What the listings show | Verdict on the floor |
|---|---|---|
| **Margaret River** | Surfpoint Resort from **A$94**/night (communal bathrooms); Margaret River Motel **A$129**; Margarets in Town **A$134** (18–19 Jan); Margaret River Tourist Park **A$127** (20–21 Jan) | A$120 is right — mid-week, January, private room. A$150 was a mid-tier figure wearing a budget label. |
| **Hobart** | budget tier averages **A$74**, median **A$73**, high-season budget ~**A$139**; all-tier January average **A$156**; cheap hotels listed from A$55 | A$120 is a *safe* January floor; A$100 would still be defensible. |
| **Port Douglas / Cairns** | Port Douglas Motel from **A$84** (queen); Cairns deals from **A$59–115**; PD motels average A$222 (skewed by resorts) | A$100 before the ×0.8 January multiplier ⇒ **A$80 effective**. Matches the motel floor. |
| **Byron Bay** | Discovery Parks from **A$81**; Bay Motel from **A$131**; hotels from **A$85**; February is the cheapest month of the year there | A$120 is right for 28 Jan – 1 Feb; the block sits *after* the 28 Jan cliff by design. |
| **Sydney (suburb)** | Parramatta whole guesthouse **A$82**; 2-bed North Parramatta **A$148** | A$140 carries the summer peak over an A$82–100 floor. The NYE multiplier is applied on top, not baked in. |

### What the floor does **not** buy

- A CBD address. Every figure above assumes a suburb, a train line, or a walk.
- A cancellation-friendly rate at NYE (cost-baselines §5: prepaid, non-refundable, 3-night minimum).
- A private bathroom at the very bottom of the range (Surfpoint's A$94 is communal).
- Any protection from the October re-snapshot moving it. Confidence: **medium**.

---

## 3. The camping tier

A fourth `LodgingTier`, `camp`, offered on road-trip-shaped blocks: **WA south-west, Tasmania, Far
North Queensland, and the Northern Rivers**. It is the tier the CONTEXT directive already names
("we'll camp if we have to") and the one the model has been missing.

### 3.1 Powered caravan-park site, two people, per night

| State / region | Observed | **Plan-on** | Notes |
|---|---|---|---|
| **WA — south-west** | Gracetown Caravan Park caravan sites **from A$35**; Summerstar Margaret River powered sites in the same band | **A$50** [50–90] | January is WA school holidays end to end — the buffer over A$35 is the peak, not the rate. |
| **TAS** | national average A$35–40; independents in the low A$40s | **A$45** [45–70] | Small island fleet of sites; the same supply problem as the hire car. |
| **QLD — FNQ** | Gold Coast park ~A$45/night powered for two; FNQ is in its low season in January | **A$45** [45–65] | Wet-season camping is a real trade — see caveats. |
| **NSW — Northern Rivers** | NSW powered sites average ~**A$44**; **Discovery Parks Byron Bay from A$81** in February | **A$50** [50–90] | Byron is the national outlier: budget A$80 there, A$50 elsewhere in the shire (Brunswick Heads, Suffolk Park). |
| Australia-wide sanity | A$35–40 average, A$25–90 range, premium coastal A$100–150 at peak | | |

### 3.2 National-park sites (cheaper still, fewer facilities)

| State | Fee | Per couple per night |
|---|---|---|
| **NSW** (from 1 Jul 2026) | six-tier, **free → A$89/site**, no per-person charge | typically **A$15–35** |
| **QLD** (from 1 Jul 2026) | **A$7.75 pp/night** | **A$15.50** |
| **WA (DBCA)** | **A$10–20 pp/night** by facility tier, plus park entry on day one | **A$20–40** |
| **TAS (PWS)** | Freycinet unpowered **A$13/site** (min 2 persons) + a parks pass | **A$13** + pass |

The Tasmania parks pass is already an Event line (`tas-parks`); correct it from A$90 to the
published **A$98.35** Holiday Vehicle Pass while the file is open.

### 3.3 Camping caveats — the honest ones

- **Freycinet camping is a ballot, not a booking**, and the ballot period is **18 December –
  10 February** — the whole trip. Applications close 31 July. For the 2027 trip that window has
  already shut, so **Tasmania's camping rung means caravan parks, not the national-park campground**.
- **Gear.** The WA blocks can use the family's gear and the borrowed car. Every east-coast camping
  night needs gear flown in (checked bags on Jetstar/Virgin, ~€30–60 a Leg) or hired. This is a real
  dependency on any camping rung outside WA and it should be a caveat on the tier, not a footnote.
- **Byron has no hire car in the Plan** (`needsCar: false`). A holiday park there is walkable-ish;
  a national-park site is not.
- **Wet-season camping in FNQ** is a genuinely different proposition: 320–345 mm across 15–19 rain
  days in January, plus the stinger and croc caveats the reef document already carries.
- **Nothing in a caravan park is quiet at Christmas–January.** The tier buys money, not calm.

### 3.4 Where the tier is *not* offered

Sydney and Melbourne. Metropolitan holiday parks exist and price at A$55–70, but they are an hour
from the things those two blocks are for, and the Sydney block is a date-locked anchor spent on foot
at the harbour. The hostel-twin tier is the cheap rung in those two markets.

---

## 4. The food floor, and why A$110 was a ceiling

cost-baselines §3.3's "budget" basket is A$110/day: self-catered breakfast (A$15), **two** cheap
lunches (A$40), a casual dinner out (A$50), coffees (A$12). That is eating out twice a day, every
day, for ten weeks. It is not a floor.

The floor, with a kitchen or a camp stove [derived from §2.1's measured inputs]:

```
groceries, two adults, A$200/week                    = A$29/day
coffees, two                                         = A$12/day
one casual meal out for two, every second day        = A$25/day (A$50 ÷ 2)
one pub/club meal for two, once a week               =  A$7/day
                                                       ---------
                                                       A$73/day  → plan on A$80
```

§3.3 already says this in one line — *"a kitchen moves a mid day down to roughly A$150"* — and calls
for it to be "wired as a per-Capsule flag". **Plan-on: A$80/day [80–220] in every paid market.** The
band's top is unchanged, because a week of restaurants is exactly what the band is for.

The home-base food figure (A$45/day, groceries at the family house) is unchanged and remains the
cheapest line in the model.

**Coupling to state:** the A$80 figure assumes the `airbnb` or `camp` tier. At the `hostel` or
`hotel` tier without a kitchen it should stay A$110. Either wire that coupling or state the
assumption in the drill-in note — silently charging A$80 for a hotel week would be the same sin as
charging A$110 for a caravan park.

---

## 5. Margaret River, in full arithmetic

The Adventure the ticket names, at the new floor, three nights, mid-week in early January (or the
Plan's own 12–14 December placement — both price at ×1.0).

```
Borrowed car, Perth ⇄ Margaret River
  232 km great-circle × 1.25 road factor  = 290 km each way
  580 km round trip × A$0.16/km                          A$   93
In-region driving (Wilyabrup loop, Boranup/Augusta loop)
  3 days × A$20/day                                      A$   60
Lodging, cheap motel / Airbnb, 3 nights × A$120          A$  360
Food, self-catered with a kitchen, 3 days × A$80         A$  240
Day-to-day activities (beaches, Boranup drive, market)
  3 days × A$40                                          A$  120
Wilyabrup wine day — 3 tastings, a shared platter,
  two bottles to take away                               A$  150
Jewel Cave, A$26 pp                                      A$   52
                                                         --------
                                                         A$1,075   ≈ €656
```

**Camping rung** — same three nights on a powered site at A$50: **A$865 ≈ €528**.
**Two-night rung** (the research's own minimum) in a motel: **A$763 ≈ €465**.

### Does it hit the A$800–900 sanity range? Partly — and here is the honest answer

**The camping version does (A$865). The two-night motel version does (A$763). Three nights in a
cheap motel does not: it lands at A$1,000–1,100.** The gap between the user's mental arithmetic and
this one is two lines: a blended day-activities line (A$120 over three days) and a food line at
A$80/day rather than groceries-only at A$50. Both are defensible, and the model should not pretend
otherwise — but the tent takes the Adventure straight into the range.

Against the card's current figure the movement is large either way:

| Version | Figure |
|---|---|
| `deep-capsules.ts` published ideal (mid-tier lodging ~A$241/night, four cellar doors, a hatted lunch, two caves, Busselton jetty) | **€1,375** |
| What the engine actually charges today | €888 |
| **New plan-on, cheap motel, 3 nights** | **€656** |
| New plan-on, camping, 3 nights | €528 |
| New minimum, motel, 2 nights | €465 |

---

## 6. Re-derived ladders — every deep Adventure

Costs are the **block's own Days** (lodging + food + local + activities + car) **plus its Event
lines**, at the block's scheduled dates in the default Scenario, so the peak multipliers are the
real ones. Inter-city Legs are excluded (they are their own line in the Plan).

| Adventure | Published `cost.ideal` | Engine, today | **New plan-on** | Camping rung | Minimum rung |
|---|---|---|---|---|---|
| **Margaret River**, 3 nights | €1,375 | €888 | **€656** | €528 | €465 (2 n) |
| **Rottnest Island**, 1 day | €215 | €260 | **€194** | — | — |
| **Sydney NYE**, 6 nights | €2,075 | €2,211 | **€1,682** · €1,535 reshaped (§7) | hostel twin €1,331 | €1,159 (4 n) |
| **Great Barrier Reef**, 5 nights | €2,560 | €1,802 | **€1,188** (one reef day) · €1,600 (two) | €1,053 | €857 (3 n) |
| **FNQ wildlife**, +1 day | €450 | €287 | **€204** | — | — |
| **Byron + Nimbin**, 5 nights | €1,070 | €1,188 | **€960** | €747 | €643 (3 n) |
| **Tasmania arc**, 9 nights | €4,430 | €3,045 | **€2,341** | €1,847 | €1,619 (6 n) |
| **Melbourne**, 4 nights | €1,040 | €1,098 | **€708** (no Laneway) · €952 (with) | — | €549 (3 n) |
| **Total, eight Adventures** | **€13,215** | **€10,779** | **€7,933** | | |

**Recommendation:** overwrite each `DeepCapsule.cost` with `{min: minimum-or-camping rung,
ideal: new plan-on, max: the current published ideal}`. That makes the card's own ladder read
floor → plan-on → ceiling, and stops the card and the ledger quoting two different numbers for the
same Adventure.

### The Event-line ladder behind those figures

| Adventure | Line | Now | **Floor** | What changes |
|---|---|---|---|---|
| Margaret River | Busselton Jetty & Observatory | A$76 | **A$0** | to the bench — it is a drive-in extra, not part of the Adventure |
| | Wilyabrup cellar doors & long lunch | A$300 | **A$150** | three tastings (often waived on a purchase) + a shared platter, not a hatted degustation |
| | Mammoth **and** Jewel Caves | A$120 | **A$52** | Jewel only — the doc's own pick; Mammoth duplicates its register |
| Rottnest | Ferry, bikes, snorkel gear | A$352 | **A$243** | itemised: SeaLink A$113 + bikes A$86 + snorkel A$44 |
| Sydney NYE | Opera House tour + Manly ferry | A$112 | **A$16** | the ferry is the best-value hour in Sydney; the A$96 tour is a splurge |
| | NYE vantage point & provisions | A$120 | **A$60** | the free ticketed sites cost a queue; the band's top keeps the NPWS option |
| Tasmania | Parks pass | A$90 | **A$98** | **correction upward** — the published Holiday Vehicle Pass is A$98.35 |
| | MONA + ferry | A$138 | **A$138** | unchanged; the ferry is half the experience |
| | Tasman Island cruise | A$300 | **A$0** | the capsule itself calls this "the first A$360 to cut if the Budget bites" |
| | Wineglass Bay cruise | A$320 | **A$51** | swapped for the Bruny Island ferry; Wineglass is a free 3–11 km walk |
| Reef | Reef day I | A$570 | **A$550** | Passions of Paradise ex-Cairns is the cheapest credible boat; Wavelength at A$636 is the upgrade rung |
| | Rainforest day | A$60 | **A$60** | unchanged |
| | Reef day II — Poseidon + intro dives | A$754 | **A$0** | the second reef day and the two intro dives become the upgrade rung |
| FNQ | Croc cruise + Wildlife Habitat | A$160 | **A$70** | Solar Whisper 1 h, timed to a low tide (the doc's own free lever) |
| Byron | Surf lesson | A$150 | **A$116** | Let's Go Surfing at A$58 pp |
| | Nimbin day | A$198 | **A$158** | Grasshoppers at ~A$79 pp with lunch, if trading |
| Melbourne | Laneway Festival | A$400 | **A$0** | St Kilda Festival and the NGV Triennial are free; Laneway is the upgrade rung |
| | Club night | A$120 | **A$120** | unchanged — this is what the thrift is *for* |
| **Total** | | **A$4,340 / €2,647** | **A$1,882 / €1,148** | |

Half of that table is an operator swap the research already recommends. The other half — the two
Pennicott cruises, reef day II, Laneway — is **the couple's call, not the model's**, and belongs in
the savings menu rather than in the constants. See `savings-menu-draft.md`.

---

## 7. Five modelling findings that fell out of the recalibration

1. **The old floors breached the Daily cap; the new ones do not.** The four NYE nights priced at
   A$602–615 of living cost (lodging A$450 + food A$132 + local A$20) against a A$500/couple cap —
   the only cap breach in the whole default Plan. At A$140/night they price at A$466–476. The
   recalibration removes the Plan's only Daily-cap Warning, which is the right outcome for a
   *ceiling* the Plan was never meant to touch.
2. **The NYE Event line lands on the wrong day.** `CapsuleEvent.dayOffset` is an offset into the
   block, and the Scheduler places the Sydney block on 28 December, so "New Year's Eve — vantage
   point and provisions" is charged to **30 December**. NYE is a *date*, not an offset. Either pin
   date-locked Events to a date or derive the offset from the placement.
3. **The blended activities line double-counts on Event days.** A day carrying a A$550 reef boat
   also carries A$40 of "day-to-day activities". Across the default Plan that is ~14 days and about
   **€214**. Suggested rule: A$40 on Buffer days, A$15 on days that already carry an Event line.
4. **Only 28 of the 39 Buffer days are paid-rate.** Eleven are Perth home-base days at A$75. Any
   savings arithmetic that prices all 39 at a paid-city rate is overstating the prize.
5. **"Every day moved to a Home base saves A$500 / €305" is a mid-tier figure.** At the new floor a
   Sydney Buffer day is A$308 (€188) and a Perth day is A$75 (€46) — the lever is **€142/day**, not
   €305. Still the biggest single lever in the model, and worth restating honestly on the site.

---

## 8. What a builder changes

1. `constants.ts` — the `lodging` figures in §2, the `food` figures in §4, `LodgingTier` gains
   `"camp"`, the camp rates in §3.1. `MARKETS.hobart` and `MARKETS.cairns` also want a short
   comment pointing at this document.
2. `ledger.ts` — `TIER_LABEL` gains `camp: "powered site"`; the lodging note for a camp night should
   cite §3.1 and carry the gear caveat from §3.3.
3. Wherever the lodging tier is chosen per block, `camp` is offered **only** on `regional`,
   `hobart` and `cairns` markets (§3.4).
4. `capsules.ts` — the Event ladder in §6.
5. `deep-capsules.ts` — the `cost` ladders in §6, and the `A$90 → A$98.35` parks-pass correction.
6. Reconciliation tests — the default Scenario's total drops from about €24.5k to about €20.1k with
   the floors and the floor Event ladder both in. Assert the engine's figure, not this document's.

---

## Sources

Prior research, unchanged and load-bearing: [`cost-baselines.md`](./cost-baselines.md) §1 (peak
multipliers), §2.1–2.2 (WA groceries and fuel), §3.1 (lodging bands), §3.2 (the corrected
budget-operator car floor), §3.3–3.4 (food and activity tiers), §5 (NYE and Christmas), §6 (FX); and
the seven `capsule-*.md` documents for every operator price quoted in §6.

New price checks, all accessed **27 August 2026**:

**Budget lodging**
- [KAYAK — Margaret River hotels](https://www.kayak.com/Margaret-River-Hotels.45785.hotel.ksp) — 3-star from A$94; Surfpoint Resort A$94, Margaret River Motel A$129
- [Cheap accommodation Margaret River — locals' guide](https://www.accommodationmargaretriver.com/cheap-accommodation-margaret-river/) — Higgins Lane Motel, Surfpoint (communal bathrooms, shared kitchen)
- [Travelocity — Margaret River lodging](https://www.travelocity.com/lp/b/tgp/lodging/theme/motels-with-hot-tubs/180754/margaret-river) — Margaret River Tourist Park A$127 (20–21 Jan), Margarets in Town A$134 (18–19 Jan)
- [Budget Your Trip — Hobart hotel prices](https://www.budgetyourtrip.com/hotels/australia/hobart-2163355) — budget average A$74, median A$73, high season ~A$139; January all-tier average A$156
- [Skyscanner — cheap Hobart hotels](https://www.skyscanner.com/hotels/australia/hobart-hotels/ci-27542001) — listings from A$55
- [KAYAK — Port Douglas motels](https://www.kayak.com.au/Port-Douglas-Hotels_Motel.Tmotel.47372.hotel.ksp) — Port Douglas Motel from A$84 queen; motel average A$222
- [Priceline — Cairns hotel deals](https://www.priceline.com/hotel-deals/en-us/P3000040003/hotels-in-cairns.ssp) — from A$64; [KAYAK Cairns](https://www.kayak.com/Cairns-Hotels.23637.hotel.ksp) from A$59
- [Travelocity — Byron Bay hotels](https://www.travelocity.com/Byron-Bay-Hotels.d6138873.Travel-Guide-Hotels) — from A$85; Discovery Parks A$81 (11–12 Feb), Bay Motel A$131, Byron Beachcomber A$160; February the cheapest month
- Airbnb Parramatta listings — whole guesthouse A$82/night, 2-bed North Parramatta A$148/night

**Camping and caravan parks**
- [Gracetown Caravan Park — caravan sites](https://www.gracetowncaravanpark.com.au/accommodation/caravan-sites/) — sites from A$35/night
- [Summerstar — Margaret River powered caravan sites](https://summerstar.com.au/caravan-parks/margaret-river/accommodation/powered-caravan-site)
- [Westview Caravan Park — average caravan park fees in Australia](https://westviewcaravanpark.com/average-caravan-park-fees-australia/) — A$35–40 typical powered site; QLD Gold Coast ~A$45 for two; NSW ~A$44
- [What's Up Down Under — caravan park rule changes 2026](https://whatsupdownunder.com.au/plan/buyers-guide/caravan-park-rule-changes-2026/) — A$25–90 range; premium coastal A$100–150 at peak
- [What's Up Down Under — NSW national park camping fees 2026](https://whatsupdownunder.com.au/research/news/nsw-national-parks-camping-fees-2026/) — six tiers from 1 Jul 2026, free to A$89/site, no per-person charge
- [Parks QLD — camping bookings and fees](https://parks.qld.gov.au/camping/bookings) — A$7.75 pp/night from 1 Jul 2026
- [Explore Parks WA — camping fees](https://exploreparks.dbca.wa.gov.au/camping-fees) — A$10–20 pp/night by facility tier; park entry charged on the first day only
- [Parks & Wildlife Tasmania — Freycinet camping](https://parks.tas.gov.au/Documents/Freycinet%20Ballot%20Application.pdf) — unpowered A$13/site (min 2 persons); **ballot 18 December – 10 February**, applications close 31 July
