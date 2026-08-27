/**
 * What the demo route's drawn Legs cost, per couple, in EUR.
 *
 * All that is left of the prototype's static Plan. The Plan's own totals, its
 * splits, its Budget band and its Daily cap moved into `lib/engine/` in #25 and
 * are computed from the Day ledger now; the eight Legs the globe draws are
 * still the demo route's (`lib/demo-route.ts`), which is a fixed illustration
 * rather than a Plan, so their estimates stay here until the globe reads the
 * engine's derived Legs too.
 *
 * A Leg popup labels these "estimate". The four Legs that are in
 * `lib/flights/grid.ts` fetch a real fare instead and say so.
 */

export const DEMO_LEG_FARES_EUR: Readonly<Record<string, number>> = {
  "VLC>BCN": 90,
  "BCN>SIN": 1_280,
  "SIN>PER": 860,
  "PER>SYD": 330,
  "SYD>CNS": 190,
  "CNS>OOL": 220,
  "OOL>HBA": 290,
  "HBA>MEL": 120,
};

/** The homeward long-haul, which the route ends before drawing. */
export const DEMO_RETURN_LEG_EUR = 1_960;
