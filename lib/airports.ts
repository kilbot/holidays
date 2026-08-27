/**
 * Airport coordinates, for putting Catalog ideas on the globe.
 *
 * A Catalog idea has no coordinates — the sweep recorded a `nearest_airport`
 * IATA code and nothing else, because at 415 entries a geocoding pass would
 * have been the expensive part of a cheap tier. That code is enough to plot a
 * dot: an idea shortlisted as *interested* shows up on the map at the airport
 * you would fly into for it, which is the honest resolution of what we know.
 *
 * The table below is every code the Catalog actually uses, derived from the
 * `nearest_airport` values in `catalog.json` rather than guessed at. Coordinates
 * are the airport's own [longitude, latitude] — the terminal, not the town it
 * serves, which for the remote ones (Ayers Rock, Kununurra) is the same place
 * anyway.
 *
 * Twelve of the 415 entries name no airport at all ("n/a", "varies",
 * "varies (Sydney/Melbourne + drive)") — the Big Lap and the other ideas that
 * are a route rather than a place. Those get no dot, deliberately: a dot for
 * "varies" would be a lie about where the thing is.
 */

/** [longitude, latitude]. */
export type Coordinates = [number, number];

export const AIRPORT_COORDINATES: Readonly<Record<string, Coordinates>> = {
  /* --- Capital cities and the majors --- */
  SYD: [151.1772, -33.9399], // Sydney Kingsford Smith
  MEL: [144.843, -37.669], // Melbourne Tullamarine
  BNE: [153.1175, -27.3842], // Brisbane
  PER: [115.9672, -31.9403], // Perth
  ADL: [138.5304, -34.945], // Adelaide
  HBA: [147.5102, -42.8361], // Hobart
  CBR: [149.195, -35.3069], // Canberra
  DRW: [130.8767, -12.4147], // Darwin
  AVV: [144.4694, -38.0394], // Avalon (Geelong)

  /* --- Queensland --- */
  CNS: [145.7551, -16.8858], // Cairns
  OOL: [153.5053, -28.1644], // Gold Coast, Coolangatta
  MCY: [153.0911, -26.6033], // Sunshine Coast, Maroochydore
  TSV: [146.7661, -19.2526], // Townsville
  MKY: [149.1797, -21.1717], // Mackay
  PPP: [148.5522, -20.495], // Whitsunday Coast, Proserpine
  ROK: [150.4753, -23.3819], // Rockhampton
  GLT: [151.2233, -23.8697], // Gladstone
  BDB: [152.3192, -24.9036], // Bundaberg
  HVB: [152.8853, -25.3188], // Hervey Bay
  WTB: [151.7933, -27.5583], // Toowoomba Wellcamp
  EMD: [148.1806, -23.5675], // Emerald
  LRE: [144.28, -23.4342], // Longreach
  ISA: [139.4886, -20.6639], // Mount Isa
  CTN: [145.1844, -15.4447], // Cooktown
  LDH: [159.0769, -31.5383], // Lord Howe Island (NSW, but its own dot)

  /* --- New South Wales & ACT --- */
  NTL: [151.834, -32.7949], // Newcastle, Williamtown
  CFS: [153.116, -30.3206], // Coffs Harbour
  BNK: [153.5622, -28.8339], // Ballina Byron
  PQQ: [152.8631, -31.4358], // Port Macquarie
  TMW: [150.8469, -31.0839], // Tamworth
  DGE: [149.6114, -32.5625], // Mudgee
  OAG: [149.1328, -33.3817], // Orange
  COJ: [149.267, -31.3325], // Coonabarabran
  LHG: [148.0128, -29.4567], // Lightning Ridge
  MRZ: [149.845, -29.4989], // Moree
  PKE: [148.2386, -33.1314], // Parkes
  BHQ: [141.4722, -32.0014], // Broken Hill
  MYA: [150.144, -35.8978], // Moruya, south coast
  MIM: [149.9014, -36.9086], // Merimbula
  OOM: [148.9736, -36.3006], // Cooma, Snowy Mountains
  ABX: [146.9581, -36.0678], // Albury

  /* --- Victoria & Tasmania --- */
  MQL: [142.0864, -34.2292], // Mildura
  LST: [147.214, -41.5453], // Launceston
  BWT: [145.7311, -40.9989], // Burnie Wynyard
  FLS: [147.9928, -40.0917], // Flinders Island
  KNS: [143.8781, -39.8775], // King Island

  /* --- South Australia --- */
  KGC: [137.5214, -35.7139], // Kingscote, Kangaroo Island
  PLO: [135.88, -34.6053], // Port Lincoln
  WYA: [137.5142, -33.0589], // Whyalla
  CED: [133.71, -32.1306], // Ceduna
  CPD: [134.7211, -29.04], // Coober Pedy
  MGB: [140.7847, -37.7456], // Mount Gambier

  /* --- Western Australia --- */
  BQB: [115.4017, -33.6884], // Busselton Margaret River
  ALH: [117.8093, -34.9433], // Albany
  EPR: [121.8228, -33.6844], // Esperance
  KGI: [121.4614, -30.7894], // Kalgoorlie-Boulder
  GET: [114.7076, -28.7961], // Geraldton
  MJK: [113.5772, -25.8939], // Shark Bay, Denham
  LEA: [114.0888, -22.2356], // Learmonth, Exmouth
  KTA: [116.7733, -20.7122], // Karratha
  PBO: [117.7453, -23.1711], // Paraburdoo, Karijini
  BME: [122.2322, -17.9447], // Broome
  KNX: [128.7078, -15.7781], // Kununurra

  /* --- Northern Territory --- */
  ASP: [133.9019, -23.8067], // Alice Springs
  AYQ: [130.9756, -25.1861], // Ayers Rock, Yulara
  KTR: [132.3803, -14.5211], // Katherine, Tindal
  TCA: [134.183, -19.6344], // Tennant Creek
  JAB: [132.8936, -12.6586], // Jabiru, Kakadu
};

/**
 * The IATA code at the head of a `nearest_airport` value, or null.
 *
 * The field is free text and about a fifth of it is compound — "BNK (Ballina)
 * / OOL", "SYD / MEL / BNE", "PPP (Whitsunday Coast/Proserpine)". The first
 * code is the nearest one in every case the sweep produced, so the leading
 * token is the answer; "n/a" and "varies" have no leading code and correctly
 * fall through to null.
 */
export function airportCodeOf(nearestAirport: string): string | null {
  const match = /^[A-Z]{3}\b/.exec(nearestAirport.trim());
  return match ? match[0] : null;
}

/** Where a Catalog idea's `nearest_airport` puts it, or null if unmappable. */
export function airportCoordinates(
  nearestAirport: string,
): Coordinates | null {
  const code = airportCodeOf(nearestAirport);
  return code ? (AIRPORT_COORDINATES[code] ?? null) : null;
}
