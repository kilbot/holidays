import type { FareBasis } from "@/lib/engine/types";

export interface FareSnapshot {
  priceEur: number;
  carrier: string;
  fetchedAt: "2026-08-27";
  source: "research-estimate";
  /**
   * Whether this figure buys one crossing or two.
   *
   * Stated on the datum rather than inferred from the route, because inferring
   * it is exactly what went wrong: the long-haul estimates below are the
   * premium-comfort row of `docs/research/longhaul-comfort.md`, whose table is
   * headed *"Bands, per person, **return**"*, while every domestic row and
   * every live SearchAPI quote is a one-way. Nothing downstream can tell those
   * apart by looking at them, so the number says which it is.
   */
  basis: Exclude<FareBasis, "return-share">;
}

const estimate = (
  priceEur: number,
  carrier: string,
  basis: FareSnapshot["basis"] = "one-way",
): FareSnapshot => ({
  priceEur,
  carrier,
  fetchedAt: "2026-08-27",
  source: "research-estimate",
  basis,
});

export const FARE_SNAPSHOTS: Record<string, FareSnapshot> = {
  // The crossings. €1,900 and €1,500 are points inside longhaul-comfort.md's
  // premium-comfort band, and that band is quoted per person **return** — so
  // each of these pays for the journey out *and* the journey home.
  "VLC-PER": estimate(1_900, "Multiple carriers", "return"),
  "BCN-PER": estimate(1_900, "Multiple carriers", "return"),
  "MAD-PER": estimate(1_900, "Multiple carriers", "return"),
  "MXP-PER": estimate(1_900, "Multiple carriers", "return"),
  "SYD-BCN": estimate(1_500, "Multiple carriers", "return"),
  "MEL-BCN": estimate(1_500, "Multiple carriers", "return"),
  "BNE-BCN": estimate(1_500, "Multiple carriers", "return"),
  // The domestic hops, one-way, from domestic-flights.md §2.
  "PER-SYD": estimate(305, "Virgin Australia"),
  "SYD-CNS": estimate(120, "Jetstar"),
  "OOL-HBA": estimate(140, "Jetstar"),
  "HBA-MEL": estimate(65, "Jetstar"),
  "PER-MEL": estimate(330, "Virgin Australia"),
  "SYD-MEL": estimate(60, "Jetstar"),
};
