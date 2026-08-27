export interface RouteGridEntry {
  from: string;
  to: string;
  dates: readonly string[];
  ttlSeconds: number;
  minEur: number;
  maxEur: number;
}

export const ROUTE_GRID = [
  { from: "VLC", to: "PER", dates: ["2026-12-10", "2026-12-20"], ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 },
  { from: "BCN", to: "PER", dates: ["2026-12-10", "2026-12-20"], ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 },
  { from: "MAD", to: "PER", dates: ["2026-12-10", "2026-12-20"], ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 },
  { from: "MXP", to: "PER", dates: ["2026-12-10", "2026-12-20"], ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 },
  { from: "SYD", to: "BCN", dates: ["2027-02-10", "2027-02-23"], ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 },
  { from: "MEL", to: "BCN", dates: ["2027-02-10", "2027-02-23"], ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 },
  { from: "BNE", to: "BCN", dates: ["2027-02-10", "2027-02-23"], ttlSeconds: 86_400, minEur: 400, maxEur: 3_500 },
  { from: "PER", to: "SYD", dates: ["2026-12-24", "2026-12-26", "2026-12-28"], ttlSeconds: 21_600, minEur: 80, maxEur: 900 },
  { from: "SYD", to: "CNS", dates: ["2027-01-16", "2027-01-20"], ttlSeconds: 21_600, minEur: 30, maxEur: 500 },
  { from: "OOL", to: "HBA", dates: ["2027-02-01", "2027-02-04"], ttlSeconds: 21_600, minEur: 30, maxEur: 500 },
  { from: "HBA", to: "MEL", dates: ["2027-02-08", "2027-02-12"], ttlSeconds: 21_600, minEur: 25, maxEur: 400 },
  { from: "PER", to: "MEL", dates: ["2026-12-24", "2026-12-26", "2026-12-28"], ttlSeconds: 21_600, minEur: 30, maxEur: 600 },
  { from: "SYD", to: "MEL", dates: ["2027-01-16", "2027-01-18", "2027-01-20"], ttlSeconds: 21_600, minEur: 30, maxEur: 600 },
] as const satisfies readonly RouteGridEntry[];
