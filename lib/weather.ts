/**
 * The weather layer — Dec/Jan/Feb normals per base, plus this season's ENSO
 * tilt.
 *
 * `docs/research/weather-normals.json` is imported directly rather than copied
 * into `lib/`: it is the research deliverable from #21, it is already shaped
 * for the client, and a second copy would only give the two files a chance to
 * disagree. The one thing this module adds is a hand-written type — a JSON
 * import infers eleven slightly different location types, and the ENSO tilt
 * entries genuinely differ field by field (only some locations carry a temp or
 * fire tilt), so the shape has to be declared once here rather than inferred.
 *
 * Layer 1 of the research's three-layer model. Layer 2 is the tilt below,
 * re-checked monthly; layer 3 is a live forecast and only means anything
 * inside ten days, so it has no place on a strip that draws next December.
 */

import weatherFile from "@/docs/research/weather-normals.json";

export type MonthKey = "dec" | "jan" | "feb";

export interface MonthNormals {
  avg_high_c: number;
  avg_low_c: number;
  mean_rain_mm: number;
  /** What a typical month actually delivers — prefer this over the mean. */
  median_rain_mm: number;
  rain_days_ge_1mm: number;
  /** The "plans actually ruined" threshold. */
  rain_days_ge_10mm: number;
  days_ge_30c: number;
  days_ge_35c: number;
  rh_3pm_pct: number;
  humidity: "dry" | "moderate" | "humid" | "very humid" | "oppressive";
  /** Approximate regional climatology, ±1.5 °C — not station data. */
  sea_surface_temp_c: number;
}

export interface WeatherLocation {
  name: string;
  state: string;
  notes: string;
  flags: {
    stinger_season: boolean;
    cyclone_window: boolean;
    bushfire_months: string[];
  };
  months: Record<MonthKey, MonthNormals>;
}

export interface EnsoLocationTilt {
  rain: string;
  temp?: string;
  fire?: string;
  confidence: string;
  detail: string;
}

interface WeatherFile {
  enso_tilt: {
    as_at: string;
    state: string;
    caveat: string;
    apply_to_normals: Record<string, EnsoLocationTilt>;
  };
  locations: Record<string, WeatherLocation>;
}

const weather = weatherFile as unknown as WeatherFile;

export type WeatherLocationId = keyof typeof weatherFile.locations;

export const ENSO = weather.enso_tilt;

export function weatherLocation(id: WeatherLocationId): WeatherLocation {
  return weather.locations[id];
}

export function normalsFor(id: WeatherLocationId, month: MonthKey): MonthNormals {
  return weather.locations[id].months[month];
}

export function ensoTiltFor(id: WeatherLocationId): EnsoLocationTilt | undefined {
  return weather.enso_tilt.apply_to_normals[id];
}

/**
 * The tilt as one clause: "drier · hotter". The strip has room for a phrase,
 * not for the paragraph of analogue-summer evidence behind it — that goes in
 * the tooltip and the expanded week.
 */
export function tiltSummary(tilt: EnsoLocationTilt | undefined): string | null {
  if (!tilt) return null;
  const parts: string[] = [];
  if (tilt.rain && !tilt.rain.startsWith("no reliable")) parts.push(strip(tilt.rain));
  if (tilt.temp) parts.push(strip(tilt.temp));
  if (tilt.fire) parts.push(`fire ${tilt.fire}`);
  return parts.length > 0 ? parts.join(" · ") : "no reliable tilt";
}

/** "tilt drier, strongly in Dec-Jan" → "drier". */
function strip(phrase: string): string {
  return phrase.replace(/^tilt\s+/, "").split(/[,;]/)[0].trim();
}

/**
 * Where a day's heat sits on the strip's warm/cool ramp, 0–1.
 *
 * 14 °C is a cool Hobart morning's high, 36 °C is a Perth heat day; the ramp
 * only has to separate "beach" from "hide indoors", so a linear clamp between
 * those two is honest enough and needs no scale library.
 */
export function heatFraction(avgHighC: number): number {
  return Math.min(1, Math.max(0, (avgHighC - 14) / 22));
}

/** A wet-day probability for the month, 0–1 — rain days over days in month. */
export function wetDayFraction(normals: MonthNormals, month: MonthKey): number {
  const daysInMonth = month === "feb" ? 28 : 31;
  return Math.min(1, normals.rain_days_ge_1mm / daysInMonth);
}
