export interface FareSnapshot {
  priceEur: number;
  carrier: string;
  fetchedAt: "2026-08-27";
  source: "research-estimate";
}

const estimate = (priceEur: number, carrier: string): FareSnapshot => ({
  priceEur,
  carrier,
  fetchedAt: "2026-08-27",
  source: "research-estimate",
});

export const FARE_SNAPSHOTS: Record<string, FareSnapshot> = {
  "VLC-PER": estimate(1_900, "Multiple carriers"),
  "BCN-PER": estimate(1_900, "Multiple carriers"),
  "MAD-PER": estimate(1_900, "Multiple carriers"),
  "MXP-PER": estimate(1_900, "Multiple carriers"),
  "SYD-BCN": estimate(1_500, "Multiple carriers"),
  "MEL-BCN": estimate(1_500, "Multiple carriers"),
  "BNE-BCN": estimate(1_500, "Multiple carriers"),
  "PER-SYD": estimate(305, "Virgin Australia"),
  "SYD-CNS": estimate(120, "Jetstar"),
  "OOL-HBA": estimate(140, "Jetstar"),
  "HBA-MEL": estimate(65, "Jetstar"),
  "PER-MEL": estimate(330, "Virgin Australia"),
  "SYD-MEL": estimate(60, "Jetstar"),
};
