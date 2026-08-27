/**
 * The practical layer of the research, as a directory (#67).
 *
 * Every other page in the site turns research into a *number* — a Day's cost, a
 * fare band, a burn-down against the ceiling. This file holds the residue that
 * has no number: the boards you watch, the memberships you buy, the documents
 * you carry, the pages you re-check. It is the "so we don't lose it" layer.
 *
 * Three rules keep it from silting up into a bookmarks folder:
 *
 * 1. **One line of why, or it doesn't go in.** If the reason to open a link
 *    can't be said in a sentence, the entry belongs in a research doc instead.
 * 2. **One figure that matters.** The membership price, the excess, the lead
 *    time, the day it goes on sale. A link with no number is a link nobody
 *    clicks twice.
 * 3. **Every claim carries its source.** `source` names the doc and section the
 *    figure came from, so a stale number can be traced and re-checked rather
 *    than quietly believed.
 *
 * Currency follows the research: AUD unless marked, converted at A$1 = €0.61
 * (`docs/research/cost-baselines.md` §6).
 */

/** The five shelves. Order here is the order on the page. */
export const RESOURCE_GROUPS = [
  "Getting around cheap",
  "Staying free",
  "Booking",
  "Documents & money",
  "Weather & season",
] as const;

export type ResourceGroup = (typeof RESOURCE_GROUPS)[number];

/**
 * A date this entry is running out of, if it has one.
 *
 * `kind` is the verb — "book by", "on sale", "re-check" — so the countdown chip
 * reads as an instruction ("34d · book by") rather than a bare number. Split
 * from `date` because the page sorts and counts on the date and prints the
 * verb.
 */
export interface ResourceDeadline {
  /** ISO day, UTC-safe like every other date in the site. */
  date: string;
  kind: "book by" | "join by" | "on sale" | "re-check" | "before departure";
}

export interface Resource {
  /** Stable across edits — it is the anchor a link into the page uses. */
  id: string;
  group: ResourceGroup;
  name: string;
  /** The reason to open it. One sentence, no semicolon-chains. */
  whyOneLine: string;
  /** The number that matters. Short enough to sit on one line beside the name. */
  keyFigure: string;
  url: string;
  deadline?: ResourceDeadline;
  /** Doc and section the claim came from. */
  source: string;
}

/** Where an entry's own words are the best link available. */
const DOC = "https://github.com/kilbot/holidays/blob/main/docs/research";

export const RESOURCES: readonly Resource[] = [
  /* ---------------------------------------------------------------- */
  /* Getting around cheap                                              */
  /* ---------------------------------------------------------------- */
  {
    id: "imoova",
    group: "Getting around cheap",
    name: "imoova",
    whyOneLine:
      "The largest relocation board in Australia, and the only one with a waitlist that will wake you by SMS when your corridor appears.",
    keyFigure: "A$1/day · listings surface 2–4 weeks out",
    url: "https://www.imoova.com/relocations/australia",
    source: "relocation-transport-hacks.md §2",
  },
  {
    id: "transfercar",
    group: "Getting around cheap",
    name: "Transfercar",
    whyOneLine:
      "The other big board, overlapping imoova heavily but publishing each operator's own terms per listing — and it blocks scripted access, so it needs a real browser and a real login.",
    keyFigure: "A$350 against fuel receipts, or a ferry spot",
    url: "https://www.transfercar.com.au/",
    source: "relocation-transport-hacks.md §2",
  },
  {
    id: "coseats-relocation",
    group: "Getting around cheap",
    name: "Coseats relocations",
    whyOneLine:
      "Smaller inventory than the other two, but it charges no booking fee and it is the same login as the carpool board.",
    keyFigure: "No booking fee",
    url: "https://app.coseats.com/campervan-relocation",
    source: "relocation-transport-hacks.md §2",
  },
  {
    id: "thl-direct",
    group: "Getting around cheap",
    name: "Britz / maui / Apollo / Mighty — direct",
    whyOneLine:
      "The dominant Australian fleet does not publish its routes on any board; you join the operator's own driver database by email, and it predates the aggregators.",
    keyFigure: "aurelocsonline@thlonline.com",
    url: "https://www.britz.com/au/en/campervan-hire-deals/campervan-relocations",
    source: "relocation-transport-hacks.md §2",
  },
  {
    id: "wicked-relocation",
    group: "Getting around cheap",
    name: "Wicked Campers relocations",
    whyOneLine:
      "Backpacker fleet, operator direct, no published routes — phone or email only, and worth one call because nobody else is watching it.",
    keyFigure: "A$1/day",
    url: "https://www.wickedcampers.com.au/relocation",
    source: "relocation-transport-hacks.md §2",
  },
  {
    id: "thl-relocation-terms",
    group: "Getting around cheap",
    name: "THL relocation terms (PDF)",
    whyOneLine:
      "The single best primary source on the whole topic: km allowances, minimum and maximum days per city pair, the bond, the excess-reduction tiers, and the night-driving ban that quietly governs the drive.",
    keyFigure: "PER→SYD: 4,550 km, min 8 days, max 9",
    url: "https://www.drivenow.com.au/webdata/terms/australia-thl-campervan-relocation-terms.pdf",
    source: "relocation-transport-hacks.md §1, §4.2",
  },
  {
    id: "pounce-playbook",
    group: "Getting around cheap",
    name: "The how-to-pounce playbook",
    whyOneLine:
      "A relocation is a watch-and-strike instrument, not a booking: set every waitlist now, decide in minutes rather than evenings, and carry the five questions to ask at the counter before signing.",
    keyFigure: "First-come, first-served · supplier confirms in ≤48 h",
    url: `${DOC}/relocation-transport-hacks.md#10-the-how-to-pounce-playbook`,
    source: "relocation-transport-hacks.md §10",
  },
  {
    id: "driveaway-dead",
    group: "Getting around cheap",
    name: "Private driveaway — the verdict is dead",
    whyOneLine:
      "Person-to-person “drive my car across the country” is not a functioning market here any more: Uber shut the Car Next Door operation, DriveMyCar has no driveaway product, and Turo Australia forbids one-way hires outright.",
    keyFigure: "Uber Carshare closed 12 Sep 2024",
    url: "https://en.wikipedia.org/wiki/Uber_Carshare",
    source: "relocation-transport-hacks.md §6",
  },
  {
    id: "coseats-carpool",
    group: "Getting around cheap",
    name: "Coseats carpool",
    whyOneLine:
      "Not a plan — a failure-mode absorber: if a relocation lands that only fits one of you, this is a live board of people already driving the same road.",
    keyFigure: "A$230–330 each, Nullarbor, fuel split three ways",
    url: "https://coseats.com/",
    source: "relocation-transport-hacks.md §8.2",
  },
  {
    id: "indian-pacific",
    group: "Getting around cheap",
    name: "Indian Pacific, Perth→Sydney",
    whyOneLine:
      "The romance option, priced honestly: it departs every Saturday and 26 December 2026 is a Saturday, arriving Sydney midday on the 30th — a perfect fit for the window and the most expensive way to answer the question.",
    keyFigure: "A$6,800–10,200/couple Gold Twin — 7–10× the flight",
    url: "https://www.journeybeyondrail.com.au/guest-information/timetables/the-indian-pacific-2026-timetable/",
    source: "relocation-transport-hacks.md §7",
  },

  /* ---------------------------------------------------------------- */
  /* Staying free                                                      */
  /* ---------------------------------------------------------------- */
  {
    id: "aussie-house-sitters",
    group: "Staying free",
    name: "Aussie House Sitters",
    whyOneLine:
      "The largest Australian pool by a distance and the clear buy for a couple doing one or two sits — Sydney assignments covering the whole NYE block were already listed four months out.",
    keyFigure: "A$89/yr · 1,000–1,500+ AU listings · no booking fee",
    url: "https://www.housesitters.com.au/",
    deadline: { date: "2026-09-30", kind: "join by" },
    source: "relocation-transport-hacks.md §8.1",
  },
  {
    id: "trusted-housesitters",
    group: "Staying free",
    name: "TrustedHousesitters",
    whyOneLine:
      "A global product priced for people who sit six-plus times a year, and a couple needs two memberships plus the Duo add-on — worth it only for the reviews it can earn you in Spain before December.",
    keyFigure: "US$129–259/yr + ~US$45 Duo · ~600 AU listings",
    url: "https://www.trustedhousesitters.com/",
    source: "relocation-transport-hacks.md §8.1",
  },
  {
    id: "mindahome",
    group: "Staying free",
    name: "Mindahome",
    whyOneLine:
      "The cheap third membership: two-thirds of Aussie House Sitters' inventory for two-thirds of the price, and the overlap is not total.",
    keyFigure: "A$59–69/yr · ~940 AU listings",
    url: "https://mindahome.com.au/",
    source: "relocation-transport-hacks.md §8.1",
  },
  {
    id: "sit-lottery",
    group: "Staying free",
    name: "Read the lottery framing first",
    whyOneLine:
      "An inner-Sydney NYE sit is the largest single lever in the whole research and you are the worst-positioned entrants for it — sits draw 10–20 applications within hours, so treat a win as a bonus and never as the lodging plan.",
    keyFigure: "A$5,000–9,000 of lodging, at low odds",
    url: `${DOC}/relocation-transport-hacks.md#81-house-sitting-for-east-coast-lodging`,
    source: "relocation-transport-hacks.md §8.1",
  },

  /* ---------------------------------------------------------------- */
  /* Booking                                                           */
  /* ---------------------------------------------------------------- */
  {
    id: "per-syd-flight",
    group: "Booking",
    name: "PER→SYD flight, 26 Dec",
    whyOneLine:
      "The critical Leg, and the one date here that cannot slip — a 26 Dec relocation will not surface until early December, long after this fare has gone, so buy the flight and treat any relocation as a bonus you would walk away from.",
    keyFigure: "A$400–700 pp early against A$800–1,200 late",
    url: "https://www.google.com/travel/flights",
    deadline: { date: "2026-10-01", kind: "book by" },
    source: "domestic-flights.md §7",
  },
  {
    id: "tasmania-car",
    group: "Booking",
    name: "Tasmania hire car",
    whyOneLine:
      "The binding constraint of the entire Tasmania block: the island's fleet is small and it sells out over the Christmas–January holidays, so the failure mode is “there are no cars” rather than “the cars are expensive”.",
    keyFigure: "A$98/day January average, +58% · Hobart quoted at A$171",
    url: "https://www.locostautorent.com/",
    deadline: { date: "2026-10-01", kind: "book by" },
    source: "capsule-tasmania.md §7 · cost-baselines.md §4",
  },
  {
    id: "nye-lodging",
    group: "Booking",
    name: "Sydney NYE lodging block",
    whyOneLine:
      "Supply-constrained rather than price-constrained, and the harbourside norm is three nights minimum, fully prepaid, fully non-refundable — the largest irreversible exposure in the Plan.",
    keyFigure: "Rates run ×2.5–3.0 across 29 Dec – 1 Jan",
    url: `${DOC}/capsule-sydney-nye.md#10-what-to-re-check-before-booking`,
    deadline: { date: "2026-10-01", kind: "book by" },
    source: "capsule-sydney-nye.md §10 · cost-baselines.md §7",
  },
  {
    id: "spirit-of-tasmania",
    group: "Booking",
    name: "Spirit of Tasmania",
    whyOneLine:
      "Only if the car crosses with you: the booking window is eleven months rolling and peak school-holiday sailings fill fast even with the new ships' extra capacity.",
    keyFigure: "A$1,400–1,850/couple with car and cabin, incl. 15% fuel surcharge",
    url: "https://www.spiritoftasmania.com.au/",
    deadline: { date: "2026-10-01", kind: "book by" },
    source: "domestic-flights.md §6",
  },
  {
    id: "pitp-tickets",
    group: "Booking",
    name: "Party In The Paddock",
    whyOneLine:
      "The headline sway-event of the window and the only in-window camping festival that does not fight a hard anchor — lineup lands around late October, tickets follow in early November.",
    keyFigure: "≈A$700–1,000/couple · 4–7 Feb, Carrick TAS",
    url: "https://www.partyinthepaddockfestival.com.au/",
    deadline: { date: "2026-11-01", kind: "on sale" },
    source: "events-dec-feb.md",
  },
  {
    id: "nsw-parks-nye",
    group: "Booking",
    name: "NSW National Parks NYE tickets",
    whyOneLine:
      "Bradleys Head, North Head, Strickland Estate and the harbour islands go on sale through Moshtix around November and the islands sell out in minutes — set an alarm rather than a reminder.",
    keyFigure: "Free tickets; islands charge ~A$43.63 pp ferry",
    url: "https://www.moshtix.com.au/",
    deadline: { date: "2026-11-01", kind: "on sale" },
    source: "capsule-sydney-nye.md §10",
  },
  {
    id: "opera-house-forecourt",
    group: "Booking",
    name: "Opera House Forecourt tickets, 10:00 AEDT",
    whyOneLine:
      "6,000 free tickets released on the morning of the PER→SYD flight: whoever is not driving to the airport books it from a phone with the page already open, and it is the highest-value ten minutes in the whole trip.",
    keyFigure: "10:00 AEDT = 07:00 AWST · max 6 per booking",
    url: "https://www.sydneynewyearseve.com/",
    deadline: { date: "2026-12-26", kind: "on sale" },
    source: "capsule-sydney-nye.md §10",
  },
  {
    id: "woodford",
    group: "Booking",
    name: "Woodford Folk Festival",
    whyOneLine:
      "On pure taste the best-fitting event of the entire trip, and a head-on collision with the Sydney NYE anchor — on sale now, so the decision is the constraint, not the ticket.",
    keyFigure: "≈A$1,100–1,500/couple · 27 Dec – 1 Jan",
    url: "https://woodfordfolkfestival.com/tickets/",
    source: "events-dec-feb.md",
  },
  {
    id: "lost-paradise",
    group: "Booking",
    name: "Lost Paradise",
    whyOneLine:
      "The sharpest anchor conflict in the calendar: the only NYE option that serves her taste, an hour north of Sydney, and mutually exclusive with the harbour.",
    keyFigure: "≈A$1,250–1,600/couple · on sale since 5 Aug 2026",
    url: "https://www.lostparadise.com.au/",
    source: "events-dec-feb.md",
  },
  {
    id: "fare-resnapshot",
    group: "Booking",
    name: "Re-snapshot the fare bands",
    whyOneLine:
      "Every domestic band in the research is modelled from route averages rather than quoted, and late September is both when live Christmas-week fares first appear and when the booking decision has to be made anyway.",
    keyFigure: "Christmas–New Year books Sep–Oct; no late-drop pattern exists",
    url: `${DOC}/domestic-flights.md#booking-curve`,
    deadline: { date: "2026-09-30", kind: "re-check" },
    source: "domestic-flights.md §7",
  },
  {
    id: "google-flights",
    group: "Booking",
    name: "Google Flights",
    whyOneLine:
      "Book on the proper site, not from this one: live pricing earns its keep on the domestic Legs, but the long-haul choice is comfort-first — aircraft, seat, layover — and none of that is in any price feed.",
    keyFigure: "Free · the long-haul choice wants a human here",
    url: "https://www.google.com/travel/flights",
    source: "flight-data-live-pricing.md",
  },
  {
    id: "skyscanner",
    group: "Booking",
    name: "Skyscanner",
    whyOneLine:
      "The second opinion, and the better whole-month view when the question is which date rather than which flight.",
    keyFigure: "Free · month view beats a dated search when dates are soft",
    url: "https://www.skyscanner.net/",
    source: "flight-data-live-pricing.md",
  },

  /* ---------------------------------------------------------------- */
  /* Documents & money                                                 */
  /* ---------------------------------------------------------------- */
  {
    id: "french-licence-translation",
    group: "Documents & money",
    name: "French licence: IDP or NAATI translation",
    whyOneLine:
      "Paul drives on his Australian licence, nothing needed — but a French licence isn't in English, so Australian states want an IDP or certified translation for the second driver; a French IDP must be issued BY FRANCE and processing runs months, so the fallback is a NAATI-certified translation (~A$60–90, days) once in Australia.",
    keyFigure: "French IDP: free but slow (apply now) · NAATI translation: ~A$60–90, fast",
    url: "https://permisdeconduire.ants.gouv.fr/demarches-en-ligne/permis-international",
    deadline: { date: "2026-12-01", kind: "before departure" },
    source: "relocation-transport-hacks.md §10",
  },
  {
    id: "card-excess-verify",
    group: "Documents & money",
    name: "Verify the card's rental-excess cover",
    whyOneLine:
      "A range of Australian cards withdrew complimentary rental cover in May 2026, several issuers restrict it to overseas travel only, and a second driver voids it on most policies — read the PDS, never the marketing page.",
    keyFigure: "Cover withdrawn on a range of cards from 15 May 2026",
    url: "https://www.canstar.com.au/credit-cards/credit-cards-included-rental-car-insurance/",
    deadline: { date: "2026-11-01", kind: "re-check" },
    source: "cost-baselines.md §4 · relocation-transport-hacks.md §9.2",
  },
  {
    id: "westpac-policy-wording",
    group: "Documents & money",
    name: "Westpac / Allianz policy wording (PDF)",
    whyOneLine:
      "The representative wording, and the sentence that decides it: campervans under 4.5 t are in, and the definition closes hard enough that the dual-cab utes actually listing out of Perth are doubtful.",
    keyFigure: "Benefit to A$5,500 · A$300 claim excess",
    url: "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/pb/credit-cards/WBC_Consumer_Credit_Card_Comp_Insurance_Allianz.pdf",
    source: "relocation-transport-hacks.md §9.2",
  },
  {
    id: "counter-card-gotchas",
    group: "Documents & money",
    name: "The card gotchas at the counter",
    whyOneLine:
      "Visa or Mastercard, credit or debit, in the primary driver's name — no Amex, no partner's card, and a physical licence because digital ones are refused at relocation counters.",
    keyFigure: "A$1,000 bond held live, plus a 2–3.1% surcharge",
    url: `${DOC}/relocation-transport-hacks.md#9-insurance-bond-and-excess--the-gotchas-plainly`,
    source: "relocation-transport-hacks.md §9, §10",
  },
  {
    id: "excess-cover-online",
    group: "Documents & money",
    name: "Buy excess cover online, not at the counter",
    whyOneLine:
      "The counter waiver is the single most expensive habit in car hire, and the same cover bought beforehand costs a quarter as much — check it covers single-vehicle, unsealed-road and windscreen damage, which are the claims that actually happen here.",
    keyFigure: "A$5–12/day online against A$30–45/day at the counter",
    url: "https://www.finder.com.au/travel-insurance/car-rental-excess-insurance/cheap-car-hire-excess-insurance",
    source: "cost-baselines.md §4 · capsule-tasmania.md §9",
  },
  {
    id: "fx-framing",
    group: "Documents & money",
    name: "AUD→EUR framing",
    whyOneLine:
      "Show one number at the model rate and the worst case at the stress rate; the 2026 trajectory has been AUD-strengthening, so budgeting below €0.60 is budgeting against the trend.",
    keyFigure: "Model A$1 = €0.61 · stress €0.65 · never below €0.60",
    url: "https://wise.com/gb/currency-converter/aud-to-eur-rate/history",
    source: "cost-baselines.md §6",
  },

  /* ---------------------------------------------------------------- */
  /* Weather & season                                                  */
  /* ---------------------------------------------------------------- */
  {
    id: "bom-enso",
    group: "Weather & season",
    name: "BOM ENSO Wrap-Up",
    whyOneLine:
      "The official Australian position on the event the whole seasonal bet rests on — check monthly whether it is still intensifying, whether the IOD has gone positive, and whether coastal SSTs are still running hot.",
    keyFigure: "Niño3.4 +2.20 °C, SOI −25.6 (9 Aug 2026)",
    url: "http://www.bom.gov.au/climate/enso/",
    deadline: { date: "2026-09-11", kind: "re-check" },
    source: "climate-outlook.md §2, §7",
  },
  {
    id: "bom-outlooks",
    group: "Weather & season",
    name: "BOM long-range forecast",
    whyOneLine:
      "The critical one: ACCESS-S runs four months ahead, so the first outlook that actually covers the trip window does not exist until mid-November — nothing before that is a forecast for these dates.",
    keyFigure: "First Dec–Feb outlook ≈ mid-November 2026",
    url: "http://www.bom.gov.au/climate/ahead/outlooks/",
    deadline: { date: "2026-11-15", kind: "re-check" },
    source: "climate-outlook.md §3, §7",
  },
  {
    id: "bom-rainfall-onset",
    group: "Weather & season",
    name: "BOM Northern Rainfall Onset",
    whyOneLine:
      "The strongest forecast support for the January reef bet, and from October the real-time test is actual rainfall accumulation across Cape York rather than the outlook itself.",
    keyFigure: "55–80% chance of a later-than-normal onset",
    url: "http://www.bom.gov.au/climate/rainfall-onset/",
    source: "climate-outlook.md §3, §7",
  },
  {
    id: "bom-cyclones",
    group: "Weather & season",
    name: "BOM tropical cyclone season outlook",
    whyOneLine:
      "Issued around October, and it confirms or refutes the reduced-cyclone expectation that makes a January reef window a better logistics bet than its reputation.",
    keyFigure: "El Niño roughly halves Queensland coastal crossings",
    url: "http://www.bom.gov.au/climate/cyclones/",
    deadline: { date: "2026-10-31", kind: "re-check" },
    source: "climate-outlook.md §5, §7",
  },
  {
    id: "afac-bushfire",
    group: "Weather & season",
    name: "AFAC Seasonal Bushfire Outlook",
    whyOneLine:
      "The go/no-go input for the Tasmania block: the summer issue lands in late November, and the spring one has already flagged north-east and eastern Tasmania.",
    keyFigure: "Hobart DJF 27% below median in 7 of 9 strong El Niño summers",
    url: "https://www.afac.com.au/public-resources",
    deadline: { date: "2026-11-30", kind: "re-check" },
    source: "climate-outlook.md §5, §7",
  },
  {
    id: "coral-reef-watch",
    group: "Weather & season",
    name: "NOAA Coral Reef Watch",
    whyOneLine:
      "The one way the January bet can be right about the weather and still lose: heat stress and the four-month bleaching outlook are the reef-quality check, as distinct from the reef-weather one.",
    keyFigure: "Re-check November and December",
    url: "https://coralreefwatch.noaa.gov/product/5km/index.php",
    deadline: { date: "2026-11-30", kind: "re-check" },
    source: "climate-outlook.md §5, §7",
  },
  {
    id: "gbrmpa-reef-health",
    group: "Weather & season",
    name: "GBRMPA reef health updates",
    whyOneLine:
      "Observed condition rather than modelled risk, published through the summer — the last word before a reef day is paid for.",
    keyFigure: "Re-check December and January",
    url: "https://www.gbrmpa.gov.au/learn/reef-health/reef-health-updates",
    source: "climate-outlook.md §7",
  },
  {
    id: "noaa-cpc",
    group: "Weather & season",
    name: "NOAA CPC ENSO diagnostic",
    whyOneLine:
      "The American cross-check on BOM, issued on the second Thursday of each month, and currently the least hedged of the three agencies.",
    keyFigure: ">90% chance of a very strong event through winter 2026-27",
    url: "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml",
    source: "climate-outlook.md §2, §7",
  },
  {
    id: "iri-quick-look",
    group: "Weather & season",
    name: "IRI ENSO Quick Look",
    whyOneLine:
      "The third independent read, published around the 19th — three agencies with no disagreement is what makes the phase, as opposed to the impact, close to certain.",
    keyFigure: "100% El Niño probability for NDJ, DJF and JFM",
    url: "https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/",
    source: "climate-outlook.md §2, §7",
  },
  {
    id: "tasalert",
    group: "Weather & season",
    name: "TasALERT / Tasmania Fire Service",
    whyOneLine:
      "The in-trip check: live fire and park closures, read before committing to any walk rather than after driving to the trailhead.",
    keyFigure: "Check in January, on the ground",
    url: "https://www.tasalert.com",
    source: "climate-outlook.md §7",
  },
];

/** The entries on one shelf, in file order. */
export function resourcesIn(group: ResourceGroup): Resource[] {
  return RESOURCES.filter((resource) => resource.group === group);
}

/** A `Resource` narrowed to the ones that are running out of time. */
export type DatedResource = Resource & { deadline: ResourceDeadline };

function isDated(resource: Resource): resource is DatedResource {
  return resource.deadline !== undefined;
}

/**
 * Every dated entry, soonest first.
 *
 * The page's masthead counts these, and the sort is what makes "the next one
 * bites in N days" a single array read rather than a scan.
 */
export function datedResources(): DatedResource[] {
  return RESOURCES.filter(isDated).sort((a, b) =>
    a.deadline.date.localeCompare(b.deadline.date),
  );
}
