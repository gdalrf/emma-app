/**
 * Intraday replay data generator for Emissions Replay screen.
 *
 * Models realistic Plymouth harbour pollution patterns:
 *  - Morning peak  07:00–09:00 (vessel departures + ferry arrivals)
 *  - Afternoon peak 16:00–18:00 (evening ferry + bulk cargo)
 *  - Low overnight and midday
 *
 * Wind drift: prevailing SW wind means upwind sensors (S07 Plymouth Sound,
 * S02 Millbay) register first; downwind sensors (S04 Sutton, S05 Cattewater,
 * S06 Turnchapel) lag 1–2 steps (5–10 min).
 */

import { sensors } from './mockData.js';

// Base thresholds for replay pollutants
export const REPLAY_POLLUTANTS = ['NO2', 'PM2.5', 'NOx'];

export const REPLAY_THRESHOLDS = { NO2: 200, 'PM2.5': 25, NOx: 400 };

export const REPLAY_COLORS = { NO2: '#f59e0b', 'PM2.5': '#06b6d4', NOx: '#ec4899' };

// How many 5-minute steps in an hour
export const STEPS_PER_HOUR = 12;

/**
 * Hourly envelope: base multiplier for each hour of day.
 * Peaks at 07–09 and 16–18, low overnight.
 */
const HOURLY_ENVELOPE = [
  0.25, 0.20, 0.18, 0.18, 0.22, 0.40, // 00–05
  0.65, 0.95, 1.00, 0.85, 0.70, 0.60, // 06–11
  0.55, 0.58, 0.62, 0.68, 0.90, 1.00, // 12–17
  0.80, 0.60, 0.45, 0.38, 0.30, 0.27, // 18–23
];

/**
 * Sensor-specific base emission levels (µg/m³) by pollutant.
 * Industrial and ferry locations emit more.
 */
const SENSOR_BASE = {
  S01: { NO2: 95,  'PM2.5': 14, NOx: 210 }, // Devonport — high industrial
  S02: { NO2: 80,  'PM2.5': 11, NOx: 175 }, // Millbay — ferry terminal
  S03: { NO2: 55,  'PM2.5':  8, NOx: 120 }, // QAB marina — lower
  S04: { NO2: 65,  'PM2.5': 10, NOx: 145 }, // Sutton — fishing
  S05: { NO2: 78,  'PM2.5': 12, NOx: 168 }, // Cattewater — bulk cargo
  S06: { NO2: 88,  'PM2.5': 13, NOx: 195 }, // Turnchapel — industrial
  S07: { NO2: 35,  'PM2.5':  5, NOx:  80 }, // Sound Buoy — open water, low
  S08: { NO2: 72,  'PM2.5': 10, NOx: 160 }, // Torpoint Ferry
};

/**
 * Wind drift lag per sensor (in 5-min steps).
 * SW prevailing wind: upwind = S07, S02. Downwind = S04, S05, S06.
 */
const WIND_LAG = {
  S07: 0, // upwind — Plymouth Sound, first hit
  S02: 0, // Millbay — upwind face of harbour
  S01: 1, // Devonport — slight lag
  S08: 1, // Torpoint — slight lag
  S03: 2, // QAB — further into harbour
  S04: 2, // Sutton — downwind
  S05: 3, // Cattewater — well downwind
  S06: 3, // Turnchapel — furthest downwind
};

// Simple deterministic noise
function noise(seed) {
  return (Math.abs(Math.sin(seed * 127.1 + 311.7) * 43758.5) % 1) * 2 - 1;
}

/**
 * Generate readings for every 5-minute step within a given hour.
 * Returns: array[12] of { step, minute, sensors: { S01: {NO2, PM2.5, NOx}, … } }
 */
export function generateHourReadings(hour, dateStr = '2025-01-14') {
  const envelope   = HOURLY_ENVELOPE[hour] ?? 0.5;
  const nextEnv    = HOURLY_ENVELOPE[(hour + 1) % 24] ?? 0.5;

  return Array.from({ length: STEPS_PER_HOUR }, (_, step) => {
    // Interpolate envelope across the hour
    const t   = step / STEPS_PER_HOUR;
    const env = envelope * (1 - t) + nextEnv * t;

    const minute = step * 5;
    const sensorReadings = {};

    sensors.forEach(s => {
      const base = SENSOR_BASE[s.id];
      const lag  = WIND_LAG[s.id] ?? 0;
      // Apply lag: use a slightly earlier envelope
      const lagT    = Math.max(0, t - lag / STEPS_PER_HOUR);
      const lagEnv  = envelope * (1 - lagT) + nextEnv * lagT;

      const reading = {};
      REPLAY_POLLUTANTS.forEach(p => {
        const n = noise(s.id.charCodeAt(1) + step * 7 + p.charCodeAt(0) * 3 + hour * 97);
        reading[p] = Math.max(0, +(base[p] * lagEnv * (1 + n * 0.18)).toFixed(1));
      });
      sensorReadings[s.id] = reading;
    });

    return { step, minute, hour, dateStr, sensorReadings };
  });
}

/**
 * Pre-generate a full day's worth of hourly data so scrubbing is instant.
 */
export function generateDayData(dateStr = '2025-01-14') {
  const hours = [];
  for (let h = 0; h < 24; h++) {
    hours.push(generateHourReadings(h, dateStr));
  }
  return hours; // hours[h][step]
}

/** Get the colour for a reading relative to its threshold */
export function readingColor(value, pollutant) {
  const limit = REPLAY_THRESHOLDS[pollutant];
  const ratio = value / limit;
  if (ratio < 0.45) return '#10b981'; // green
  if (ratio < 0.75) return '#f59e0b'; // amber
  return '#ef4444';                    // red
}

/** Normalise 0–1 for opacity / radius scaling */
export function readingIntensity(value, pollutant) {
  return Math.min(1, value / REPLAY_THRESHOLDS[pollutant]);
}

// Available replay dates (mock — last 7 days from reference date)
export const REPLAY_DATES = [
  { label: 'Tue 14 Jan 2025', value: '2025-01-14' },
  { label: 'Wed 15 Jan 2025', value: '2025-01-15' },
  { label: 'Thu 16 Jan 2025', value: '2025-01-16' },
  { label: 'Fri 17 Jan 2025', value: '2025-01-17' },
  { label: 'Sat 18 Jan 2025', value: '2025-01-18' },
  { label: 'Sun 19 Jan 2025', value: '2025-01-19' },
  { label: 'Mon 20 Jan 2025', value: '2025-01-20' },
];
