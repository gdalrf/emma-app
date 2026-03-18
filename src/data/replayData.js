/**
 * Intraday replay data generator for Emissions Replay screen.
 * Pollutants: NO2, NO (measured); NOx (derived = NO + NO2); PM2.5, PM10 (measured);
 *             SO2 (modelled estimate — not directly measured at Plymouth sensors).
 */

import { sensors } from './mockData.js';

export const REPLAY_POLLUTANTS = ['NO2', 'NO', 'NOx', 'PM2.5', 'PM10', 'SO2'];

// Thresholds used for heatmap intensity + colour coding (not all are UK legal limits)
// NO2: EU 1-hr limit 200 µg/m³ (note UK annual mean limit is 40 µg/m³)
// PM2.5: WHO 24-hr guideline 25 µg/m³
// PM10: EU 24-hr limit 50 µg/m³
// SO2: display threshold for low-level modelled estimates
export const REPLAY_THRESHOLDS = {
  NO2:     200,
  NO:      100,
  NOx:     300,
  'PM2.5':  35,
  PM10:     50,
  SO2:      20,
};

export const REPLAY_COLORS = {
  NO2:     '#f59e0b',  // amber/orange — measured
  NO:      '#8b5cf6',  // purple — measured
  NOx:     '#ef4444',  // red — derived
  'PM2.5': '#a78bfa',  // grey-purple — measured
  PM10:    '#6366f1',  // indigo — measured
  SO2:     '#60a5fa',  // blue-grey — modelled
};

export const STEPS_PER_HOUR = 12; // 5-minute steps

// ── Hourly emission envelope ──────────────────────────────────────────────────
const HOURLY_ENVELOPE = [
  0.25, 0.20, 0.18, 0.18, 0.22, 0.40, // 00–05
  0.65, 0.95, 1.00, 0.85, 0.70, 0.60, // 06–11
  0.55, 0.58, 0.62, 0.68, 0.90, 1.00, // 12–17
  0.80, 0.60, 0.45, 0.38, 0.30, 0.27, // 18–23
];

// ── Hourly wind data for Plymouth ─────────────────────────────────────────────
// dir = degrees the wind comes FROM (meteorological convention); speed = knots
// NE periods at hours 10–11 (midday sea breeze) and hour 20 (evening E shift)
// → these trigger amber "limited coverage" reliability badges in the UI
export const HOURLY_WIND = [
  { dir: 262, speed:  8 }, // 00 — calm W overnight
  { dir: 258, speed:  7 }, // 01
  { dir: 255, speed:  7 }, // 02
  { dir: 250, speed:  6 }, // 03
  { dir: 245, speed:  7 }, // 04
  { dir: 240, speed:  9 }, // 05 — wind picking up
  { dir: 235, speed: 13 }, // 06 — backing toward SW
  { dir: 230, speed: 15 }, // 07 — morning peak, SW
  { dir: 228, speed: 17 }, // 08 — strongest of morning
  { dir: 225, speed: 16 }, // 09 — true SW
  { dir:  52, speed:  7 }, // 10 — NE sea breeze develops (⚠ limited sensor coverage)
  { dir:  45, speed:  8 }, // 11 — NE sea breeze peak (⚠ limited sensor coverage)
  { dir: 210, speed: 12 }, // 12 — sea breeze collapses, SSW returns
  { dir: 205, speed: 11 }, // 13
  { dir: 202, speed: 11 }, // 14
  { dir: 205, speed: 12 }, // 15
  { dir: 212, speed: 14 }, // 16
  { dir: 222, speed: 18 }, // 17 — evening, backing to SW, gusty
  { dir: 238, speed: 20 }, // 18 — strongest of evening
  { dir: 250, speed: 18 }, // 19
  { dir:  95, speed:  5 }, // 20 — E/ESE evening offshore shift (⚠ partial coverage)
  { dir: 265, speed: 13 }, // 21 — W returns overnight
  { dir: 268, speed: 10 }, // 22
  { dir: 265, speed:  9 }, // 23
];

// ── Wind reliability ──────────────────────────────────────────────────────────
/**
 * Returns reliability status based on wind direction.
 *
 * Sensor placement at Plymouth is optimised for prevailing SW winds.
 * NE / E winds reduce coverage accuracy and require gap-filling from
 * atmospheric dispersion modelling.
 *
 * @param {number} dir - Wind direction in degrees (FROM)
 * @returns {{ status: 'reliable'|'limited'|'partial', label: string, color: string }}
 */
export function windReliability(dir) {
  const d = ((dir % 360) + 360) % 360;
  // NE quadrant 20°–80°
  if (d >= 20 && d <= 80) {
    return {
      status: 'limited',
      label: 'NE wind — limited sensor coverage · gap-filled with modelled data',
      color: '#f59e0b',
    };
  }
  // N / NW or ENE: 280°–360°, 0°–20°, and 80°–115°
  if (d >= 280 || d <= 20 || (d > 80 && d <= 115)) {
    return {
      status: 'partial',
      label: 'Partial coverage — some modelled data included',
      color: '#f59e0b',
    };
  }
  // Prevailing SW / W / SSW — sensors optimised for this
  return {
    status: 'reliable',
    label: 'SW wind — measured data · reliable',
    color: '#10b981',
  };
}

// ── Beaufort scale ────────────────────────────────────────────────────────────
export function beaufort(kn) {
  if (kn < 1)  return { n: 0, label: 'Calm' };
  if (kn < 4)  return { n: 1, label: 'Light air' };
  if (kn < 7)  return { n: 2, label: 'Light breeze' };
  if (kn < 11) return { n: 3, label: 'Gentle breeze' };
  if (kn < 17) return { n: 4, label: 'Moderate' };
  if (kn < 22) return { n: 5, label: 'Fresh breeze' };
  if (kn < 28) return { n: 6, label: 'Strong breeze' };
  return       { n: 7, label: 'Near gale' };
}

// ── Compass bearing label ─────────────────────────────────────────────────────
export function compassLabel(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) + 360) / 22.5) % 16];
}

// ── Sensor intraday base levels (µg/m³, at peak hour envelope) ────────────────
// Measured pollutants only; NOx is derived; SO2 is modelled
const SENSOR_BASE = {
  S01: { NO2: 75, NO: 40, 'PM2.5': 13, PM10: 24, SO2:  7 }, // Devonport — industrial/naval
  S02: { NO2: 55, NO: 28, 'PM2.5': 10, PM10: 18, SO2:  6 }, // Millbay — commercial/ferry
  S03: { NO2: 32, NO: 16, 'PM2.5':  7, PM10: 13, SO2:  3 }, // QAB Marina
  S04: { NO2: 40, NO: 20, 'PM2.5':  9, PM10: 16, SO2:  4 }, // Sutton Harbour
  S05: { NO2: 58, NO: 30, 'PM2.5': 11, PM10: 20, SO2:  5 }, // Cattewater
  S06: { NO2: 68, NO: 35, 'PM2.5': 12, PM10: 22, SO2:  6 }, // Turnchapel
  S07: { NO2: 20, NO: 10, 'PM2.5':  5, PM10:  9, SO2:  2 }, // Sound Buoy — offshore
  S08: { NO2: 48, NO: 24, 'PM2.5':  9, PM10: 16, SO2:  5 }, // Torpoint
};

// Wind transport lag (steps) — sensors further from main vessel traffic respond later
const WIND_LAG = { S07: 0, S02: 0, S01: 1, S08: 1, S03: 2, S04: 2, S05: 3, S06: 3 };

// Measured pollutants to generate (NOx is derived from NO + NO2)
const MEASURED = ['NO2', 'NO', 'PM2.5', 'PM10', 'SO2'];

function noise(s) {
  return (Math.abs(Math.sin(s * 127.1 + 311.7) * 43758.5) % 1) * 2 - 1;
}

// ── Wind interpolation ────────────────────────────────────────────────────────
function interpWind(hour, step) {
  const w0 = HOURLY_WIND[hour];
  const w1 = HOURLY_WIND[(hour + 1) % 24];
  const t  = step / STEPS_PER_HOUR;

  // Shortest-path direction interpolation
  let dDir = w1.dir - w0.dir;
  if (dDir >  180) dDir -= 360;
  if (dDir < -180) dDir += 360;
  const dir   = ((w0.dir + dDir * t) + 360) % 360;
  const speed = w0.speed * (1 - t) + w1.speed * t;

  // ±20% gust variation
  const gustN = noise(step * 11 + hour * 37 + 5);
  const gust  = +(speed * (1 + gustN * 0.20)).toFixed(1);

  return { dir: +dir.toFixed(1), speed: +speed.toFixed(1), gust: Math.max(speed, gust) };
}

// ── Per-step readings for one hour ────────────────────────────────────────────
export function generateHourReadings(hour, dateStr = '2025-01-14') {
  const envelope = HOURLY_ENVELOPE[hour] ?? 0.5;
  const nextEnv  = HOURLY_ENVELOPE[(hour + 1) % 24] ?? 0.5;

  return Array.from({ length: STEPS_PER_HOUR }, (_, step) => {
    const t    = step / STEPS_PER_HOUR;
    const wind = interpWind(hour, step);

    const sensorReadings = {};
    sensors.forEach(s => {
      const base  = SENSOR_BASE[s.id];
      const lag   = WIND_LAG[s.id] ?? 0;
      const lagT  = Math.max(0, t - lag / STEPS_PER_HOUR);
      const lagEnv = envelope * (1 - lagT) + nextEnv * lagT;

      const reading = {};
      MEASURED.forEach(p => {
        const n = noise(s.id.charCodeAt(1) + step * 7 + p.charCodeAt(0) * 3 + hour * 97);
        reading[p] = Math.max(0, +(base[p] * lagEnv * (1 + n * 0.18)).toFixed(1));
      });
      // NOx derived
      reading['NOx'] = +(reading.NO2 + reading.NO).toFixed(1);
      sensorReadings[s.id] = reading;
    });

    return { step, minute: step * 5, hour, dateStr, wind, sensorReadings };
  });
}

export function generateDayData(dateStr = '2025-01-14') {
  return Array.from({ length: 24 }, (_, h) => generateHourReadings(h, dateStr));
}

// ── Colour + intensity for heatmap / markers ──────────────────────────────────
export function readingColor(value, pollutant) {
  const ratio = value / (REPLAY_THRESHOLDS[pollutant] ?? 100);
  if (ratio < 0.45) return '#10b981';
  if (ratio < 0.75) return '#f59e0b';
  return '#ef4444';
}

export function readingIntensity(value, pollutant) {
  return Math.min(1, value / (REPLAY_THRESHOLDS[pollutant] ?? 100));
}

// ── Replay dates ──────────────────────────────────────────────────────────────
export const REPLAY_DATES = [
  { label: 'Tue 14 Jan 2025', value: '2025-01-14' },
  { label: 'Wed 15 Jan 2025', value: '2025-01-15' },
  { label: 'Thu 16 Jan 2025', value: '2025-01-16' },
  { label: 'Fri 17 Jan 2025', value: '2025-01-17' },
  { label: 'Sat 18 Jan 2025', value: '2025-01-18' },
  { label: 'Sun 19 Jan 2025', value: '2025-01-19' },
  { label: 'Mon 20 Jan 2025', value: '2025-01-20' },
];
