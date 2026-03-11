/**
 * Intraday replay data generator for Emissions Replay screen.
 * Includes realistic Plymouth wind patterns with per-step interpolation.
 */

import { sensors } from './mockData.js';

export const REPLAY_POLLUTANTS = ['NO2', 'PM2.5', 'NOx'];
export const REPLAY_THRESHOLDS = { NO2: 200, 'PM2.5': 25, NOx: 400 };
export const REPLAY_COLORS     = { NO2: '#f59e0b', 'PM2.5': '#06b6d4', NOx: '#ec4899' };
export const STEPS_PER_HOUR   = 12; // 5-minute steps

// ── Hourly emission envelope ──────────────────────────────────────────────────
const HOURLY_ENVELOPE = [
  0.25,0.20,0.18,0.18,0.22,0.40, // 00–05
  0.65,0.95,1.00,0.85,0.70,0.60, // 06–11
  0.55,0.58,0.62,0.68,0.90,1.00, // 12–17
  0.80,0.60,0.45,0.38,0.30,0.27, // 18–23
];

// ── Hourly wind data for Plymouth ─────────────────────────────────────────────
// dir = degrees the wind comes FROM (met convention); speed = knots (mean)
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
  { dir: 220, speed: 14 }, // 10 — backing to SSW
  { dir: 215, speed: 13 }, // 11
  { dir: 210, speed: 12 }, // 12 — SSW, quieter midday
  { dir: 205, speed: 11 }, // 13
  { dir: 202, speed: 11 }, // 14
  { dir: 205, speed: 12 }, // 15
  { dir: 212, speed: 14 }, // 16
  { dir: 222, speed: 18 }, // 17 — evening, backing to SW, gusty
  { dir: 238, speed: 20 }, // 18 — strongest of evening
  { dir: 250, speed: 18 }, // 19
  { dir: 258, speed: 16 }, // 20 — veering to W
  { dir: 265, speed: 13 }, // 21
  { dir: 268, speed: 10 }, // 22
  { dir: 265, speed:  9 }, // 23
];

// ── Beaufort scale ────────────────────────────────────────────────────────────
export function beaufort(kn) {
  if (kn < 1)  return { n: 0, label: 'Calm' };
  if (kn < 4)  return { n: 1, label: 'Light air' };
  if (kn < 7)  return { n: 2, label: 'Light breeze' };
  if (kn < 11) return { n: 3, label: 'Gentle breeze' };
  if (kn < 17) return { n: 4, label: 'Moderate' };
  if (kn < 22) return { n: 5, label: 'Fresh breeze' };
  if (kn < 28) return { n: 6, label: 'Strong breeze' };
  return      { n: 7, label: 'Near gale' };
}

// ── Compass bearing label ─────────────────────────────────────────────────────
export function compassLabel(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg % 360) + 360) / 22.5) % 16];
}

// ── Sensor base levels & lag ──────────────────────────────────────────────────
const SENSOR_BASE = {
  S01: { NO2: 95,  'PM2.5': 14, NOx: 210 },
  S02: { NO2: 80,  'PM2.5': 11, NOx: 175 },
  S03: { NO2: 55,  'PM2.5':  8, NOx: 120 },
  S04: { NO2: 65,  'PM2.5': 10, NOx: 145 },
  S05: { NO2: 78,  'PM2.5': 12, NOx: 168 },
  S06: { NO2: 88,  'PM2.5': 13, NOx: 195 },
  S07: { NO2: 35,  'PM2.5':  5, NOx:  80 },
  S08: { NO2: 72,  'PM2.5': 10, NOx: 160 },
};

const WIND_LAG = { S07: 0, S02: 0, S01: 1, S08: 1, S03: 2, S04: 2, S05: 3, S06: 3 };

function noise(seed) {
  return (Math.abs(Math.sin(seed * 127.1 + 311.7) * 43758.5) % 1) * 2 - 1;
}

// ── Interpolate wind between two hourly values ────────────────────────────────
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

  // Add small deterministic gust variation (±20%)
  const gustN = noise(step * 11 + hour * 37 + 5);
  const gust  = +(speed * (1 + gustN * 0.20)).toFixed(1);

  return { dir: +dir.toFixed(1), speed: +speed.toFixed(1), gust: Math.max(speed, gust) };
}

// ── Generate per-step readings for one hour ───────────────────────────────────
export function generateHourReadings(hour, dateStr = '2025-01-14') {
  const envelope  = HOURLY_ENVELOPE[hour] ?? 0.5;
  const nextEnv   = HOURLY_ENVELOPE[(hour + 1) % 24] ?? 0.5;

  return Array.from({ length: STEPS_PER_HOUR }, (_, step) => {
    const t   = step / STEPS_PER_HOUR;
    const env = envelope * (1 - t) + nextEnv * t;
    const wind = interpWind(hour, step);

    const sensorReadings = {};
    sensors.forEach(s => {
      const base  = SENSOR_BASE[s.id];
      const lag   = WIND_LAG[s.id] ?? 0;
      const lagT  = Math.max(0, t - lag / STEPS_PER_HOUR);
      const lagEnv = envelope * (1 - lagT) + nextEnv * lagT;

      const reading = {};
      REPLAY_POLLUTANTS.forEach(p => {
        const n = noise(s.id.charCodeAt(1) + step * 7 + p.charCodeAt(0) * 3 + hour * 97);
        reading[p] = Math.max(0, +(base[p] * lagEnv * (1 + n * 0.18)).toFixed(1));
      });
      sensorReadings[s.id] = reading;
    });

    return { step, minute: step * 5, hour, dateStr, wind, sensorReadings };
  });
}

export function generateDayData(dateStr = '2025-01-14') {
  return Array.from({ length: 24 }, (_, h) => generateHourReadings(h, dateStr));
}

export function readingColor(value, pollutant) {
  const ratio = value / REPLAY_THRESHOLDS[pollutant];
  if (ratio < 0.45) return '#10b981';
  if (ratio < 0.75) return '#f59e0b';
  return '#ef4444';
}

export function readingIntensity(value, pollutant) {
  return Math.min(1, value / REPLAY_THRESHOLDS[pollutant]);
}

export const REPLAY_DATES = [
  { label: 'Tue 14 Jan 2025', value: '2025-01-14' },
  { label: 'Wed 15 Jan 2025', value: '2025-01-15' },
  { label: 'Thu 16 Jan 2025', value: '2025-01-16' },
  { label: 'Fri 17 Jan 2025', value: '2025-01-17' },
  { label: 'Sat 18 Jan 2025', value: '2025-01-18' },
  { label: 'Sun 19 Jan 2025', value: '2025-01-19' },
  { label: 'Mon 20 Jan 2025', value: '2025-01-20' },
];
