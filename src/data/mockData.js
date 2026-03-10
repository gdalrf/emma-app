// ─── Sensor locations around Plymouth Harbour ────────────────────────────────
export const sensors = [
  { id: 'S01', name: 'Devonport Naval Base',    lat: 50.3706, lng: -4.1820, type: 'Industrial' },
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
  { id: 'V01', name: 'MV Atlantic Pioneer',  type: 'Cargo',      flag: 'GBR', imo: '9812345', gtonnage: 18500, engineType: 'Diesel',   homePort: 'Plymouth' },
  { id: 'V02', name: 'PS Brittany Ferry',    type: 'Ferry',      flag: 'FRA', imo: '9234567', gtonnage: 42000, engineType: 'Diesel',   homePort: 'Roscoff'  },
  { id: 'V03', name: 'RFA Wave Knight',      type: 'Naval',      flag: 'GBR', imo: '9345678', gtonnage: 31500, engineType: 'Diesel',   homePort: 'Plymouth' },
  { id: 'V04', name: 'MV Celtic Carrier',    type: 'Bulk Cargo', flag: 'IRL', imo: '9456789', gtonnage: 12800, engineType: 'Diesel',   homePort: 'Cork'     },
  { id: 'V05', name: 'SV Plymouth Trader',   type: 'Cargo',      flag: 'GBR', imo: '9567890', gtonnage: 7200,  engineType: 'LNG',     homePort: 'Plymouth' },
  { id: 'V06', name: 'MV Europa Star',       type: 'Container',  flag: 'NLD', imo: '9678901', gtonnage: 28000, engineType: 'Diesel',   homePort: 'Rotterdam'},
  { id: 'V07', name: 'Torpoint Lynher',      type: 'Ferry',      flag: 'GBR', imo: '9789012', gtonnage: 980,   engineType: 'Diesel',   homePort: 'Plymouth' },
  { id: 'V08', name: 'FV Trevose Head',      type: 'Fishing',    flag: 'GBR', imo: '9890123', gtonnage: 380,   engineType: 'Diesel',   homePort: 'Plymouth' },
  { id: 'V09', name: 'MV Sound of Mull',     type: 'Cargo',      flag: 'GBR', imo: '9901234', gtonnage: 9100,  engineType: 'Diesel',   homePort: 'Glasgow'  },
  { id: 'V10', name: 'TSS Devonport',        type: 'Naval',      flag: 'GBR', imo: '9012345', gtonnage: 5200,  engineType: 'Nuclear',  homePort: 'Plymouth' },
  { id: 'V11', name: 'MV Hebridean Princess',type: 'Passenger',  flag: 'GBR', imo: '9123456', gtonnage: 2112,  engineType: 'Diesel',   homePort: 'Oban'     },
  { id: 'V12', name: 'FV Rachel Ann',        type: 'Fishing',    flag: 'GBR', imo: '9234568', gtonnage: 190,   engineType: 'Diesel',   homePort: 'Plymouth' },
];

// ─── Pollutants ───────────────────────────────────────────────────────────────
export const pollutants = ['NO2', 'SOx', 'SO2', 'CO2', 'NO', 'NOx', 'PM2.5', 'PM10'];

export const pollutantUnits = {
  NO2:   'µg/m³',
  SOx:   'µg/m³',
  SO2:   'µg/m³',
  CO2:   'ppm',
  NO:    'µg/m³',
  NOx:   'µg/m³',
  'PM2.5': 'µg/m³',
  PM10:  'µg/m³',
};

export const pollutantThresholds = {
  NO2:   200,
  SOx:   350,
  SO2:   350,
  CO2:   1000,
  NO:    100,
  NOx:   400,
  'PM2.5': 25,
  PM10:  50,
};

export const pollutantColors = {
  NO2:     '#f59e0b',
  SOx:     '#ef4444',
  SO2:     '#fb923c',
  CO2:     '#10b981',
  NO:      '#8b5cf6',
  NOx:     '#ec4899',
  'PM2.5': '#06b6d4',
  PM10:    '#3b82f6',
};

// ─── Generate monthly emissions readings ──────────────────────────────────────
const seed = (n) => Math.abs(Math.sin(n * 9301 + 49297) * 233280) % 1;

function generateMonthlyReadings(sensorId, year = 2025) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const base = sensorId.charCodeAt(1);
    const reading = {
      month: m,
      year,
      date: new Date(year, m, 1).toISOString(),
      label: new Date(year, m, 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
    };
    pollutants.forEach((p, pi) => {
      const s = seed(base + m * 13 + pi * 7);
      const baseVal = {
        NO2: 80, SOx: 120, SO2: 90, CO2: 420, NO: 45, NOx: 180, 'PM2.5': 12, PM10: 22,
      }[p];
      reading[p] = +(baseVal + s * baseVal * 0.6 - baseVal * 0.1).toFixed(2);
    });
    months.push(reading);
  }
  return months;
}

export const sensorReadings = {};
sensors.forEach(s => {
  sensorReadings[s.id] = generateMonthlyReadings(s.id);
});

// ─── Vessel emissions & miles ─────────────────────────────────────────────────
function generateVesselMonthly(vesselId, year = 2025) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const base = vesselId.charCodeAt(1);
    const s = seed(base + m * 17);
    const miles = +(400 + s * 1800).toFixed(0);
    const reading = { month: m, year, miles };
    pollutants.forEach((p, pi) => {
      const s2 = seed(base + m * 13 + pi * 11);
      const baseVal = {
        NO2: 60, SOx: 95, SO2: 70, CO2: 380, NO: 35, NOx: 140, 'PM2.5': 8, PM10: 16,
      }[p];
      reading[p] = +(baseVal + s2 * baseVal * 0.8).toFixed(2);
    });
    months.push(reading);
  }
  return months;
}

export const vesselEmissions = {};
vessels.forEach(v => {
  vesselEmissions[v.id] = generateVesselMonthly(v.id);
});

// ─── Helper: aggregate over last N months ─────────────────────────────────────
export function aggregateLastN(readings, n) {
  return readings.slice(-n);
}

export function sumPollutant(readings, pollutant) {
  return +readings.reduce((acc, r) => acc + (r[pollutant] || 0), 0).toFixed(2);
}

export function avgPollutant(readings, pollutant) {
  return +(readings.reduce((acc, r) => acc + (r[pollutant] || 0), 0) / readings.length).toFixed(2);
}

// ─── KPI summary across all sensors ──────────────────────────────────────────
export function getPortKPIs(months = 12) {
  const allReadings = sensors.flatMap(s => sensorReadings[s.id].slice(-months));
  const totalCO2 = +allReadings.reduce((a, r) => a + r.CO2, 0).toFixed(0);
  const avgNO2  = +(allReadings.reduce((a, r) => a + r.NO2, 0) / allReadings.length).toFixed(1);
  const avgPM25 = +(allReadings.reduce((a, r) => a + r['PM2.5'], 0) / allReadings.length).toFixed(1);
  const avgSOx  = +(allReadings.reduce((a, r) => a + r.SOx, 0) / allReadings.length).toFixed(1);

  const totalMiles = vessels.reduce((a, v) => {
    return a + vesselEmissions[v.id].slice(-months).reduce((b, r) => b + r.miles, 0);
  }, 0);

  return { totalCO2, avgNO2, avgPM25, avgSOx, totalMiles, activeSensors: sensors.length, activeVessels: vessels.length };
}

// ─── Trend comparison (last N vs prior N months) ──────────────────────────────
export function getTrend(sensorId, pollutant, n = 3) {
  const readings = sensorReadings[sensorId];
  const current = readings.slice(-n);
  const prior   = readings.slice(-n * 2, -n);
  const currAvg = avgPollutant(current, pollutant);
  const priorAvg = avgPollutant(prior, pollutant);
  const pct = priorAvg === 0 ? 0 : +((currAvg - priorAvg) / priorAvg * 100).toFixed(1);
  return { currAvg, priorAvg, pct, increased: pct > 5 };
}

// ─── Current sensor reading (latest month) ───────────────────────────────────
export function getLatestReading(sensorId) {
  return sensorReadings[sensorId].at(-1);
}
