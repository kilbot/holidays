# Savings menu — draft, with the arithmetic

Draft for [issue #65](https://github.com/kilbot/holidays/issues/65): cut **at least A$10,000
(≈€6,100)** from the default Plan. This is the **analysis** — the levers, priced against the current
engine, ranked by euro-saved per unit of pain. It changes no code and seeds no Scenario; a builder
does that. The floor recalibration it leans on is
[`cost-floors-recalibrated.md`](./cost-floors-recalibrated.md) (issue #64).

**Priced:** 27 August 2026. All figures **EUR, per couple, on the Plan total including the 10%
contingency row** — that is the number the HUD shows and the number the €6,100 target is measured
against. FX A$1 = €0.61.

**Baseline:** the default Scenario "Fireworks NYE" — 12 Dec 2026 – 22 Feb 2027, 73 days, all eight
researched Adventures on, 39 Buffer days.

| | Plan-on | + contingency |
|---|---|---|
| **Baseline** | €22,310 | **€24,541** |
| Target | | **≤ €18,441** (−€6,100) |
| **Comfortable path** (§5) | €16,286 | **€17,914** — −€6,627 |
| **Aggressive path** (§6) | €14,118 | **€15,530** — −€9,011 |

---

## 1. Three facts that reshape the ranking

**a. Only 28 of the 39 Buffer days are paid-rate.** Eleven are Perth home-base days at A$75/day
(€46). The Buffer bill is €6,392 today, and it is concentrated in exactly two places:

| Buffer stretch | Days | Rate/day, now | Rate/day, at the #64 floor | Cost, now |
|---|---|---|---|---|
| Perth, 17–27 Dec | 11 | A$75 · €46 | unchanged | €520 |
| **Sydney, 3–12 Jan** | **10** | A$386 · €235 | A$308 · €188 | **€2,355** |
| **Byron, 2–17 Feb** | **16** | A$320 · €195 | A$260 · €159 (camping €116) | **€3,123** |
| Margaret River / Melbourne singles | 2 | A$320 · €195 | A$260 · €159 | €390 |

**b. "Every day moved to a Home base saves €305" is a mid-tier figure and it is wrong at the floor.**
The real lever after #64 is **€142/day** (Sydney Buffer €188 → Perth €46). Still the largest single
per-day lever in the model — but the menu must not promise €305.

**c. Trimming an Adventure inside a fixed trip range barely saves anything.** A Day that stops
belonging to a block becomes a Buffer day *in the same market* — same lodging, same food, same
local transport. Cutting the reef from 5 nights to 4 saves the hire-car line and nothing else:
**€27**. Cutting Tasmania 9 → 7 saves **€135** of car. The savings in a duration trim live almost
entirely in the **Event lines** it drops and in the **trip length** it enables. Rank the levers
accordingly: *rates*, *days of trip*, *event lines*, *re-homing* — in that order.

---

## 2. The menu

Each row is measured **standalone**, applied to the stated base. They interact (camping the Byron
Buffer is worth less once the trip ends earlier), so §5 and §6 give the honest cumulative
waterfalls.

### Tier 1 — no pain at all: rate corrections (#64)

| # | Lever | Saves | Pain | What is given up | Apply |
|---|---|---|---|---|---|
| 1 | **Budget-lodging floors** — Sydney A$180→140, Melbourne/Hobart/regional A$150→120, Cairns A$120→100 | **€1,546** | **none** | Nothing. It is a mis-set constant, not a downgrade — the listings floor is lower than the model's. | **mechanical** |
| 2 | **Self-catered food floor** — A$110 → A$80/day in paid markets | **€1,248** | **none–low** | Eating out twice a day becomes once every second day, in rooms that have a kitchen. The band's top still carries a restaurant week. | **mechanical** (assumes the `airbnb`/`camp` tier — see #64 §4) |
| 3 | **Event-line corrections** — Rottnest itemised A$352→243, Nimbin A$198→158, surf A$150→116, croc A$160→70, caves A$120→52, Busselton A$76→bench, wine day A$300→150, Opera House tour A$112→16, NYE vantage A$120→60, parks pass A$90→**98** | **€480** | **none–low** | Operator swaps the research documents themselves recommend, plus one upward correction. | **mechanical** |
| 4 | **NYE block reshape** — 28 Dec–2 Jan → **30 Dec–4 Jan** | **€424** | **none** | Two nights in Sydney before NYE, bought back as two nights after 1 January when the rate collapses from ×2.5 to ×1.2. The research's own rule, finally obeyed. | **mechanical** — a `placementOverrides` entry (**and fix the Event-day bug, §7**) |
| | **Tier 1 subtotal** | **≈ €3,700** | | | |

### Tier 2 — low pain: the couple probably says yes

| # | Lever | Saves | Pain | What is given up | Apply |
|---|---|---|---|---|---|
| 5 | **Re-home the post-NYE gap to Perth** — the 8–10 idle Sydney days become home-base days, at the cost of SYD→PER (€610) and PER→HBA (€180) instead of SYD→HBA (€160) | **€870** standalone · **€558** after lever 4 | **low** | Two extra flights and a re-cut of the January calendar. Gains 8–10 more days with family. **Buffers move; they do not vanish.** | **couple's choice** (calendar), then mechanical |
| 6 | **Drop reef day II** (Poseidon + two intro dives, A$754) | **€506** | **low–medium** | The second boat and the intro dives. The research's own duration note says the fifth night buys *another chance at a reef day*, not a second guaranteed one — one boat day plus two weather-buffer days is the honest floor. | **couple's choice** |
| 7 | **Drop the Tasman Island cruise** (A$300) | **€201** | **low** | Three hours along the tallest sea cliffs in the Southern Hemisphere. `capsule-tasmania.md` names it "the first A$360 to cut if the Budget bites". | **couple's choice** |
| 8 | **Swap the Wineglass Bay cruise (A$320) for the Bruny Island ferry (A$51)** | **€181** | **low** | A boat around the bay. Wineglass Bay is a free 3–11 km walk and the doc calls the cruise "the alternative to the walk, not an addition". | **couple's choice** |
| 9 | **Camp on Margaret River & Tasmania** (powered sites, A$50/A$45 vs A$120) | **€731** | **medium** | A tent on 12 nights of the trip's two road-trip blocks. WA is easy (family gear, borrowed car); Tasmania needs gear flown down. | **couple's choice** |

### Tier 3 — medium/high pain: real trade-offs

| # | Lever | Saves | Pain | What is given up | Apply |
|---|---|---|---|---|---|
| 10 | **End 14 Feb instead of 22 Feb** | **€1,395** | **medium** | Eight days, **and both Melbourne festivals** — Laneway (Fri 19 Feb) and the free St Kilda Festival (20–21 Feb) are date-locked. The Melbourne block falls back to 11–14 Feb, which `capsule-melbourne.md` already prices as the fallback. | **couple's choice** — a hard date decision |
| 11 | **End 8 Feb instead of 22 Feb** | **€2,442** | **high** | Fourteen days, both festivals, and most of the February slack the Byron block was built to enjoy. | **couple's choice** |
| 12 | **Camp the 16-night Byron Buffer** | **€752** | **medium** | Sixteen February nights in a Northern Rivers holiday park instead of a room. Arguably the nicest version of those days — but it needs gear on the east coast. | **couple's choice** |
| 13 | **Camping tier everywhere eligible** (WA, Tasmania, FNQ, Northern Rivers, blocks *and* buffers) | **€1,895** | **medium–high** | Roughly 40 nights under canvas in the wet-season tropics and a Tasmanian January. | **couple's choice** |
| 14 | **Drop Laneway Festival** (A$400) | **€268** | **medium** | The Friday headline of the Melbourne weekend. St Kilda Festival (free, two days) and the NGV Triennial (free) survive; the club nights survive. | **couple's choice** |
| 15 | **Sydney at the hostel-twin tier** (6 block + 8–10 buffer nights) | **€417–495** | **medium** | A private twin with shared facilities instead of a suburban studio, across the trip's most expensive fortnight. | **couple's choice** |

### Tier 4 — free, but not bankable

| # | Lever | Saves | Pain | Notes |
|---|---|---|---|---|
| 16 | **House-sitting applications** (east-coast blocks) | **€0 planned**, €500–2,000 upside | none | Applications cost nothing; a hit on the Byron or Melbourne block would remove 5–16 paid lodging nights. **Upside, never plan.** Do not put it in the Frugal Scenario — put it in the burn-down as an upside note. |
| 17 | **Fix the Event-day double count** (§7) | ~€214 | none | A modelling correction, not a saving the couple feels. Worth doing; do not count it toward the target. |

### Levers that look bigger than they are

| Lever | Actual saving | Why it disappoints |
|---|---|---|
| Reef 5 nights → 4 (range fixed) | **€27** | The freed day becomes a Port Douglas Buffer day. Only the hire-car line goes. |
| Reef 5 → 3 (range fixed) | **€54** | Same. |
| Tasmania 9 nights → 7 (range fixed) | **€135** | Two days of hire car at A$110. Everything else is still paid, in Tasmania, as a Buffer. |
| Start on 19 Dec instead of 12 Dec | **€330** | Those seven days are Perth home-base days at €46 — the cheapest in the Plan. Cutting them costs family time and saves the least. |
| Trimming any block *and* shortening the trip by the same days | the trimmed block's Event lines **+ €159–188/day** | This is the version that works — see levers 10 and 11. |

---

## 3. What the whole thing is made of, after #64

For orientation while choosing. Default Scenario, at the recalibrated floors and the floor Event
ladder (€20,097 total):

| Block | Days | Cost | Notes |
|---|---|---|---|
| Long-haul + domestic Legs | — | €5,141 | VLC→PER €3,800 of it; the return rides on the same ticket |
| Sydney NYE block + its 10-day gap | 16 | €3,561 | the reshape and the re-home both attack this |
| **Byron Buffer, 2–17 Feb** | **16** | **€2,538** | the single largest re-homeable stretch |
| Tasmania | 9 | €2,341 | the most expensive block per day (hire car) |
| GBR + FNQ | 6 | €1,392 | |
| Byron block | 5 | €960 | |
| Melbourne + its Buffer | 5 | €867 | |
| Margaret River + Rottnest + WA Buffer | 16 | €1,472 | 11 of these days cost €46 each |
| Contingency row (10%) | — | €1,827 | scales with everything above |

---

## 4. What a Scenario can and cannot express

`PlanInput` (`lib/engine/types.ts`) holds: `startDate`, `endDate`, `toggled`,
`placementOverrides`, `legModeOverrides`, `lodgingTiers`, `carOverrides`, `fxStress`,
`contingency`, `fareOverrides`. So a saved "Frugal" Scenario **can** express levers 4, 5, 9–13 and
15, and **cannot** express levers 1, 2, 3, 6, 7, 8 or 14 — **Event lines and market rates are
baked constants, not Scenario state.**

Two consequences the builder must decide on before seeding anything:

1. **The #64 rate floors and the mechanical Event corrections apply to *every* Scenario,** including
   "Fireworks NYE". That is correct — they are corrections, not a frugal choice — but it means the
   side-by-side comparison will show "Fireworks NYE" dropping too, and the PR should say so.
2. **The discretionary Event cuts (levers 6, 7, 8, 14) cannot live in a Scenario today.** Either
   they go into `capsules.ts` as the plan-on figure with the ideal version as the band's top (the
   ceilings-not-targets reading, and the one this menu assumes), or `PlanInput` grows an
   `eventOverrides: Record<string, boolean | number>` so a Scenario can switch a boat day off.
   **This is a design decision, not a mechanical edit — it should be its own ticket.**

Useful detail for the seed: `ledger.ts` keys the lodging tier by **capsule id on Adventure days and
by location id on Buffer days** (`tierKey = capsule ? capsule.id : locationId`). So camping the
Byron block is `lodgingTiers["byron-nimbin"] = "camp"` and camping the Byron *Buffer* is
`lodgingTiers["byron"] = "camp"`. Both are needed for lever 12 + 13.

---

## 5. The comfortable path — **−€6,627**

Keeps all 73 days, all eight Adventures at their ideal length, **both Melbourne festivals**, both
reef weather-buffer days, and the whole WA family stretch. Pays for it with rates, calendar shape,
three boat lines, and a tent on the two road-trip blocks plus the long February Buffer.

| Step | Total | Saved |
|---|---|---|
| Baseline | €24,541 | — |
| 1 · Budget-lodging floors | €22,995 | −€1,546 |
| 2 · Self-catered food floor | €21,747 | −€1,248 |
| 3 · Event-line corrections | €21,267 | −€480 |
| 6·7·8 · Drop reef day II, the Tasman cruise; Wineglass → Bruny | €20,379 | −€888 |
| 4 · NYE reshape to 30 Dec – 4 Jan | €19,955 | −€424 |
| 5 · Re-home the post-NYE gap to Perth | €19,397 | −€558 |
| 9 · Camp on Margaret River & Tasmania | €18,666 | −€731 |
| 12 · Camp the 16-night Byron Buffer | **€17,914** | −€752 |
| | | **−€6,627** |

**Kept:** Laneway, St Kilda Festival, 22 February departure, one reef day + rainforest day + two
weather buffers, MONA, Salamanca, Port Arthur, Bruny, the Nimbin day, the surf lesson, Rottnest,
the Wilyabrup wine day, Jewel Cave, all 39 Buffer days.
**Given up:** two Pennicott cruises, the second reef boat and the intro dives, Busselton Jetty, the
Opera House tour, a hatted lunch, and ~28 nights under canvas.
**Depends on:** camping gear reaching Tasmania and the Northern Rivers (#64 §3.3).

**Camping-free variant, same target:** swap levers 9 and 12 for lever 11 (end 8 Feb) and lever 14
(drop Laneway) — €24,541 → **€17,231, −€7,310**, no tents at all, at the cost of fourteen days and
the Melbourne festival weekend.

---

## 6. The aggressive path — **−€9,011**

| Step | Total | Saved |
|---|---|---|
| Baseline | €24,541 | — |
| 1+2 · #64 rate floors | €21,747 | −€2,794 |
| 3+6+7+8+14 · Full Event triage, Laneway included | €20,097 | −€1,649 |
| 4 · NYE reshape | €19,673 | −€424 |
| 11 · End 8 Feb instead of 22 Feb | €17,231 | −€2,442 |
| 13 · Camping tier on every eligible block | €15,946 | −€1,284 |
| 15 · Sydney at the hostel-twin tier | **€15,530** | −€417 |
| | | **−€9,011** |

59 days instead of 73. No Melbourne festivals, no second reef day, no cruises, camping throughout
the road-trip blocks, a hostel twin across the Sydney fortnight. Every hard Anchor survives:
Christmas in Perth, NYE on the harbour, all eight Adventures still on the Plan at or above their
researched minimum. **This is the floor of the floor — it is not a recommendation.**

---

## 7. Two engine defects the audit turned up

1. **The NYE Event line is charged to 30 December.** `CapsuleEvent.dayOffset` counts into the block,
   and the Scheduler places the Sydney block on 28 December, so `nye-night` lands on the 30th and
   `nye-harbour` on the 29th. Reshaping the block (lever 4) moves them again, to 1 and 2 January.
   NYE is a date. Pin date-locked Events to a date, or derive the offset from the placement — and do
   it **before** shipping lever 4, or the Frugal Scenario will look right and be wrong.
2. **The blended activities line double-counts on Event days** — a day carrying a A$550 reef boat
   also carries A$40 of "day-to-day activities". About €214 across the default Plan. Suggested rule:
   A$40 on Buffer days, A$15 on days that already carry an Event line.

---

## 8. Where the wiggle room lives — unchanged

The contingency row and the worst-case band, exactly as #10 decided. Nothing in this menu inflates a
per-line estimate to create slack: the comfortable path's €17,914 already **includes** its €1,628
contingency row, and its worst case (band top at the €0.65 stress rate) is the honest upper number
to quote beside it. Plan-on is the floor; the ceiling is where the room is.

---

## Sources

Cost inputs and every operator price: [`cost-floors-recalibrated.md`](./cost-floors-recalibrated.md)
(and its dated price checks, 27 Aug 2026), [`cost-baselines.md`](./cost-baselines.md), and the seven
`capsule-*.md` documents. Trip shape, Buffer counts, placements and every euro figure above are
recomputed from `lib/engine/constants.ts`, `ledger.ts`, `rollup.ts`, `scheduler.ts`, `legs.ts` and
`lib/deep-capsules.ts` as they stood on 27 August 2026; the engine's own reconciliation tests are
the authority once the constants land.
