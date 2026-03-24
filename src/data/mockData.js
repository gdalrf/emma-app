// ─── Sensor locations around Plymouth Harbour ────────────────────────────────
export const sensors = [
  { id: 'S01', name: 'Devonport',    lat: 50.3706, lng: -4.1820, type: 'Industrial' },
  { id: 'S02', name: 'Millbay Docks',           lat: 50.3648, lng: -4.1611, type: 'Commercial' },
  { id: 'S03', name: 'Queen Anne\'s Battery',   lat: 50.3660, lng: -4.1379, type: 'Marina' },
  { id: 'S04', name: 'Sutton Harbour',          lat: 50.3681, lng: -4.1355, type: 'Fishing' },
  { id: 'S05', name: 'Cattewater Harbour',      lat: 50.3630, lng: -4.1230, type: 'Bulk Cargo' },
  { id: 'S06', name: 'Turnchapel Wharf',        lat: 50.3567, lng: -4.1178, type: 'Industrial' },
  { id: 'S07', name: 'Plymouth Sound Buoy',     lat: 50.3420, lng: -4.1650, type: 'Offshore' },
  { id: 'S08', name: 'Torpoint Ferry Terminal', lat: 50.3735, lng: -4.1973, type: 'Ferry' },
];

// ─── Vessels ──────────────────────────────────────────────────────────────────
export const vessels = [
  { id: 'V01', name: 'MV Atlantic Pioneer',  type: 'Cargo',      flag: 'GBR', imo: '9812345', gtonnage: 18500, engineType: 'Diesel',  homePort: 'Plymouth' },
  { id: 'V02', name: 'PS Ferry',    type: 'Ferry',      flag: 'FRA', imo: '9234567', gtonnage: 42000, engineType: 'Diesel',  homePort: 'Roscoff'  },
  { id: 'V03', name: 'RFA Wave Knight',      type: 'Naval',      flag: 'GBR', imo: '9345678', gtonnage: 31500, engineType: 'Diesel',  homePort: 'Plymouth' },
  { id: 'V04', name: 'MV Celtic Carrier',    type: 'Bulk Cargo', flag: 'IRL', imo: '9456789', gtonnage: 12800, engineType: 'Diesel',  homePort: 'Cork'     },
  { id: 'V05', name: 'SV Plymouth Trader',   type: 'Cargo',      flag: 'GBR', imo: '9567890', gtonnage: 7200,  engineType: 'LNG',    homePort: 'Plymouth' },
  { id: 'V06', name: 'MV Europa Star',       type: 'Container',  flag: 'NLD', imo: '9678901', gtonnage: 28000, engineType: 'Diesel',  homePort: 'Rotterdam'},
  { id: 'V07', name: 'Torpoint Lynher',      type: 'Ferry',      flag: 'GBR', imo: '9789012', gtonnage: 980,   engineType: 'Diesel',  homePort: 'Plymouth' },
  { id: 'V08', name: 'FV Trevose Head',      type: 'Fishing',    flag: 'GBR', imo: '9890123', gtonnage: 380,   engineType: 'Diesel',  homePort: 'Plymouth' },
  { id: 'V09', name: 'MV Sound of Mull',     type: 'Cargo',      flag: 'GBR', imo: '9901234', gtonnage: 9100,  engineType: 'Diesel',  homePort: 'Glasgow'  },
  { id: 'V10', name: 'TSS Devonport',        type: 'Naval',      flag: 'GBR', imo: '9012345', gtonnage: 5200,  engineType: 'Nuclear', homePort: 'Plymouth' },
  { id: 'V11', name: 'MV Hebridean Princess',type: 'Passenger',  flag: 'GBR', imo: '9123456', gtonnage: 2112,  engineType: 'Diesel',  homePort: 'Oban'     },
  { id: 'V12', name: 'FV Rachel Ann',        type: 'Fishing',    flag: 'GBR', imo: '9234568', gtonnage: 190,   engineType: 'Diesel',  homePort: 'Plymouth' },
];

// ─── Pollutants ───────────────────────────────────────────────────────────────
// Measured directly at Plymouth sensors: NO2, NO, PM2.5, PM10
// Derived (calculated): NOx = NO + NO2
// Modelled estimate (not directly measured): SO2

export const pollutants = ['NO2', 'NO', 'NOx', 'PM2.5', 'PM10', 'SO2'];

/** 'measured' | 'derived' | 'modelled' */
export const pollutantType = {
  NO2:     'measured',
  NO:      'measured',
  NOx:     'derived',   // derived = NO + NO2
  'PM2.5': 'measured',
  PM10:    'measured',
  SO2:     'modelled',  // modelled estimate — not measured at Plymouth sensors
};

/** Full display labels for tooltips, PDF exports, axis labels */
export const pollutantLabel = {
  NO2:     'NO₂',
  NO:      'NO',
  NOx:     'NOx (derived: NO + NO₂)',
  'PM2.5': 'PM2.5',
  PM10:    'PM10',
  SO2:     'SO₂ (modelled estimate)',
};

export const pollutantUnits = {
  NO2:     'µg/m³',
  NO:      'µg/m³',
  NOx:     'µg/m³',
  'PM2.5': 'µg/m³',
  PM10:    'µg/m³',
  SO2:     'µg/m³',
};

/**
 * UK regulatory annual mean limits (µg/m³).
 * Used as reference lines on trend charts.
 * NO and NOx have no strict UK annual mean limit; values shown for context only.
 */
export const pollutantLimits = {
  NO2:     40,   // UK/EU annual mean limit
  NO:      50,   // informal reference (no UK legal limit)
  NOx:     80,   // informal combined reference
  'PM2.5': 20,   // UK annual mean limit (as of 2024)
  PM10:    40,   // UK annual mean limit
  SO2:     125,  // UK 24-hr mean limit (modelled data — lower practical threshold used)
};

/** Thresholds used for chart colouring / intensity calculations */
export const pollutantThresholds = {
  NO2:     40,
  NO:      50,
  NOx:     80,
  'PM2.5': 20,
  PM10:    40,
  SO2:     20,  // display threshold for low-level modelled SO2 estimates
};

export const pollutantColors = {
  NO2:     '#f59e0b',  // amber — measured
  NO:      '#8b5cf6',  // purple — measured
  NOx:     '#ef4444',  // red — derived (sum of NO + NO2)
  'PM2.5': '#a78bfa',  // grey-purple — measured
  PM10:    '#6366f1',  // indigo — measured
  SO2:     '#60a5fa',  // blue-grey — modelled
};

// ─── Realistic per-sensor monthly base values (µg/m³) ────────────────────────
// Based on UK urban background + port-activity enhancement
// NO2: 15–40 background, Industrial sensors higher
// NO: roughly 50–60% of NO2
// PM2.5: 8–15 background, spikes during cargo operations
// PM10: ~1.8× PM2.5
// SO2: 2–8 µg/m³ modelled baseline (very low, MARPOL Tier III zone)
const SENSOR_BASES = {
  S01: { NO2: 36, NO: 21, 'PM2.5': 13, PM10: 24, SO2: 6  }, // Devonport — industrial/naval
  S02: { NO2: 28, NO: 16, 'PM2.5': 10, PM10: 18, SO2: 5  }, // Millbay — commercial/ferry
  S03: { NO2: 18, NO: 10, 'PM2.5':  7, PM10: 13, SO2: 3  }, // QAB Marina — low activity
  S04: { NO2: 22, NO: 12, 'PM2.5':  8, PM10: 15, SO2: 3  }, // Sutton Harbour — fishing
  S05: { NO2: 27, NO: 15, 'PM2.5':  9, PM10: 17, SO2: 4  }, // Cattewater — bulk cargo
  S06: { NO2: 33, NO: 18, 'PM2.5': 11, PM10: 21, SO2: 5  }, // Turnchapel — industrial
  S07: { NO2: 12, NO:  6, 'PM2.5':  5, PM10:  9, SO2: 2  }, // Sound Buoy — offshore
  S08: { NO2: 24, NO: 13, 'PM2.5':  9, PM10: 17, SO2: 4  }, // Torpoint — ferry terminal
};

// ─── Deterministic noise ──────────────────────────────────────────────────────
const seed = (n) => Math.abs(Math.sin(n * 9301 + 49297) * 233280) % 1;

// ─── Monthly sensor readings ──────────────────────────────────────────────────
const MEASURED = ['NO2', 'NO', 'PM2.5', 'PM10', 'SO2'];

function generateMonthlyReadings(sensorId, year = 2025) {
  const bases = SENSOR_BASES[sensorId];
  const months = [];
  for (let m = 0; m < 12; m++) {
    const base = sensorId.charCodeAt(1);
    const reading = {
      month: m,
      year,
      date: new Date(year, m, 1).toISOString(),
      label: new Date(year, m, 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
    };
    MEASURED.forEach((p, pi) => {
      const s  = seed(base + m * 13 + pi * 7);
      const bv = bases[p];
      // Range: ~90%–160% of base (so ~14–57 µg/m³ for NO2 at S01)
      reading[p] = Math.max(1, +(bv * (0.9 + s * 0.70)).toFixed(1));
    });
    // NOx is derived — store as sum
    reading['NOx'] = +(reading.NO2 + reading.NO).toFixed(1);
    months.push(reading);
  }
  return months;
}

export const sensorReadings = {};
sensors.forEach(s => {
  sensorReadings[s.id] = generateMonthlyReadings(s.id);
});

// ─── Vessel emissions & miles ─────────────────────────────────────────────────
// Vessel emission concentrations are higher than ambient sensors (measured at source)
const VESSEL_BASE = { NO2: 52, NO: 32, 'PM2.5': 12, PM10: 22, SO2: 14 };

function generateVesselMonthly(vesselId, year = 2025) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const base = vesselId.charCodeAt(1);
    const s = seed(base + m * 17);
    const miles = +(400 + s * 1800).toFixed(0);
    const reading = { month: m, year, miles };
    MEASURED.forEach((p, pi) => {
      const s2 = seed(base + m * 13 + pi * 11);
      const bv = VESSEL_BASE[p];
      reading[p] = Math.max(1, +(bv * (0.85 + s2 * 0.90)).toFixed(1));
    });
    reading['NOx'] = +(reading.NO2 + reading.NO).toFixed(1);
    months.push(reading);
  }
  return months;
}

export const vesselEmissions = {};
vessels.forEach(v => {
  vesselEmissions[v.id] = generateVesselMonthly(v.id);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function aggregateLastN(readings, n) {
  return readings.slice(-n);
}

export function sumPollutant(readings, pollutant) {
  return +readings.reduce((acc, r) => acc + (r[pollutant] || 0), 0).toFixed(2);
}

export function avgPollutant(readings, pollutant) {
  return +(readings.reduce((acc, r) => acc + (r[pollutant] || 0), 0) / readings.length).toFixed(2);
}

// ─── Port KPIs ────────────────────────────────────────────────────────────────
export function getPortKPIs(months = 12) {
  const allReadings = sensors.flatMap(s => sensorReadings[s.id].slice(-months));
  const n = allReadings.length;

  const avgNO2  = +(allReadings.reduce((a, r) => a + r.NO2, 0)        / n).toFixed(1);
  const avgNO   = +(allReadings.reduce((a, r) => a + r.NO, 0)         / n).toFixed(1);
  const avgPM25 = +(allReadings.reduce((a, r) => a + r['PM2.5'], 0)   / n).toFixed(1);
  const avgPM10 = +(allReadings.reduce((a, r) => a + r.PM10, 0)       / n).toFixed(1);
  const avgSO2  = +(allReadings.reduce((a, r) => a + r.SO2, 0)        / n).toFixed(1);
  // Count monthly readings exceeding the UK annual mean NO2 limit of 40 µg/m³
  const no2Exceedances = allReadings.filter(r => r.NO2 > 40).length;

  const totalMiles = vessels.reduce((a, v) =>
    a + vesselEmissions[v.id].slice(-months).reduce((b, r) => b + r.miles, 0), 0);

  return {
    avgNO2, avgNO, avgPM25, avgPM10, avgSO2,
    no2Exceedances, totalMiles,
    activeSensors: sensors.length, activeVessels: vessels.length,
  };
}

// ─── Trend comparison ─────────────────────────────────────────────────────────
export function getTrend(sensorId, pollutant, n = 3) {
  const readings = sensorReadings[sensorId];
  const current  = readings.slice(-n);
  const prior    = readings.slice(-n * 2, -n);
  const currAvg  = avgPollutant(current, pollutant);
  const priorAvg = avgPollutant(prior, pollutant);
  const pct = priorAvg === 0 ? 0 : +((currAvg - priorAvg) / priorAvg * 100).toFixed(1);
  return { currAvg, priorAvg, pct, increased: pct > 5 };
}

// ─── Latest reading ───────────────────────────────────────────────────────────
export function getLatestReading(sensorId) {
  return sensorReadings[sensorId].at(-1);
}