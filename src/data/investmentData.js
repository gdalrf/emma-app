/**
 * Infrastructure investment options and baseline data for the Investment Planner screen.
 */

export const INFRA_TYPES = [
  {
    id: 'shore-power',
    name: 'Shore Power (Cold Ironing)',
    shortName: 'Shore Power',
    icon: '⚡',
    color: '#f59e0b',
    costM: 2.8,
    annualSavingM: 0.35,
    paybackYears: 8,
    reductions: { NOx: 42, NO2: 38, PM25: 35, CO2: 55, SO2: 70 },
    primaryPollutant: 'NOx',
    description: 'Allows berthed vessels to connect to shore grid and shut off auxiliary engines, eliminating hoteling emissions. Each berth unit costs ~£1.4M. Suitable for Ferry and RoRo berths.',
    category: 'Electrification',
    fundingStreams: ['UKSPF', 'Innovate UK', 'BEIS Clean Maritime'],
  },
  {
    id: 'hydrogen-hub',
    name: 'Hydrogen Bunkering Hub',
    shortName: 'H₂ Hub',
    icon: '⬡',
    color: '#00c2a8',
    costM: 6.2,
    annualSavingM: 0.41,
    paybackYears: 15,
    reductions: { NOx: 68, NO2: 65, PM25: 72, CO2: 78, SO2: 95 },
    primaryPollutant: 'CO2',
    description: 'Green hydrogen bunkering facility enabling zero-emission propulsion for fuel-cell enabled vessels. Aligns with UK Hydrogen Strategy 2030 and Clean Maritime Plan.',
    category: 'Alternative Fuels',
    fundingStreams: ['Hydrogen BECCS', 'Clean Maritime Plan', 'EU Horizon'],
  },
  {
    id: 'lez',
    name: 'Low-Emission Zone',
    shortName: 'LEZ',
    icon: '🚫',
    color: '#ec4899',
    costM: 0.4,
    annualSavingM: 0.13,
    paybackYears: 3,
    reductions: { NOx: 18, NO2: 22, PM25: 15, CO2: 8, SO2: 10 },
    primaryPollutant: 'NO2',
    description: 'Restricts highest-emitting vessel classes from sensitive berths. Includes signage, AIS monitoring, emissions certificate requirements, and graduated penalty schedule.',
    category: 'Regulation',
    fundingStreams: ['DEFRA AQ Grant', 'Local Authority Capital'],
  },
  {
    id: 'scrubber-subsidy',
    name: 'Scrubber Retrofit Programme',
    shortName: 'Scrubber Programme',
    icon: '🔧',
    color: '#8b5cf6',
    costM: 3.5,
    annualSavingM: 0.33,
    paybackYears: 10,
    reductions: { NOx: 25, NO2: 20, PM25: 30, CO2: 5, SO2: 88 },
    primaryPollutant: 'SO2',
    description: 'Port-administered subsidy scheme for vessel operators to install IMO-compliant EGCS scrubbers. Particularly effective for SO2 and PM2.5 reduction from HFO-burning vessels.',
    category: 'Vessel Retrofit',
    fundingStreams: ['MCA MSES Fund', 'UKRI Net Zero Marine'],
  },
  {
    id: 'monitoring',
    name: 'Enhanced Sensor Network',
    shortName: 'Sensor Network+',
    icon: '📡',
    color: '#60a5fa',
    costM: 0.8,
    annualSavingM: 0.09,
    paybackYears: 9,
    reductions: { NOx: 0, NO2: 0, PM25: 0, CO2: 0, SO2: 0 },
    primaryPollutant: null,
    description: 'Adds 6 additional sensor nodes and real-time calibration. Enables source-attribution accuracy for enforcement, insurance mitigation, and funding evidence generation.',
    category: 'Data Infrastructure',
    fundingStreams: ['Innovate UK', 'DEFRA AQ Research', 'UKSPF'],
    note: 'Enables enforcement that unlocks indirect reductions from all other measures.',
  },
];

// Candidate placement zones around Plymouth Harbour
export const PLACEMENT_ZONES = [
  { id: 'Z01', name: 'Millbay Ferry Terminal',   lat: 50.3635, lng: -4.1488, primaryType: 'shore-power' },
  { id: 'Z02', name: 'Devonport Naval Basin',    lat: 50.3720, lng: -4.1580, primaryType: 'hydrogen-hub' },
  { id: 'Z03', name: 'QAB Marina',               lat: 50.3621, lng: -4.1388, primaryType: 'shore-power' },
  { id: 'Z04', name: 'Cattewater Wharves',       lat: 50.3594, lng: -4.1288, primaryType: 'scrubber-subsidy' },
  { id: 'Z05', name: 'Sutton Harbour Inner',     lat: 50.3650, lng: -4.1270, primaryType: 'monitoring' },
  { id: 'Z06', name: 'Turnchapel Marine Area',   lat: 50.3550, lng: -4.1210, primaryType: 'lez' },
  { id: 'Z07', name: 'Torpoint Ferry Slip',      lat: 50.3740, lng: -4.1930, primaryType: 'shore-power' },
];

// Baseline heatmap points (lat, lng, intensity 0–1) based on sensor positions + background level
export const BASELINE_HEAT = [
  [50.3705, -4.1571, 0.88], // Devonport — highest
  [50.3635, -4.1488, 0.75], // Millbay
  [50.3621, -4.1388, 0.48], // QAB
  [50.3594, -4.1288, 0.58], // Cattewater
  [50.3640, -4.1480, 0.70], // between Millbay + QAB
  [50.3660, -4.1440, 0.65],
  [50.3680, -4.1530, 0.78],
  [50.3590, -4.1350, 0.52],
  [50.3614, -4.1320, 0.43], // Sutton
  [50.3556, -4.1227, 0.62], // Turnchapel
  [50.3740, -4.1930, 0.38], // Torpoint
  [50.3500, -4.1400, 0.22], // Sound Buoy
];

// Annual baseline emissions by source (tonnes/year) — Plymouth port area
export const PORT_BASELINE = {
  NOx:  { shipping: 420, road: 190, background: 85,  total: 695  },
  NO2:  { shipping: 280, road: 145, background: 60,  total: 485  },
  PM25: { shipping: 95,  road: 72,  background: 38,  total: 205  },
  PM10: { shipping: 140, road: 95,  background: 55,  total: 290  },
  SO2:  { shipping: 310, road: 12,  background: 28,  total: 350  },
};

// Mock year-on-year emission indices (2022 = 100 baseline)
export const YOY_TREND = [
  { year: '2021', NOx: 92,  NO2: 88,  PM25: 95, PM10: 97,  SO2: 112 },
  { year: '2022', NOx: 100, NO2: 100, PM25: 100, PM10: 100, SO2: 100 },
  { year: '2023', NOx: 98,  NO2: 95,  PM25: 96, PM10: 96,  SO2: 88  },
  { year: '2024', NOx: 94,  NO2: 91,  PM25: 93, PM10: 93,  SO2: 82  },
  { year: '2025', NOx: 89,  NO2: 87,  PM25: 90, PM10: 90,  SO2: 76  },
];

// Before/after comparison data (index points) for a typical shore-power installation
export const SHORE_POWER_IMPACT = [
  { month: 'Jan', before: 100, after: 61 },
  { month: 'Feb', before: 96,  after: 58 },
  { month: 'Mar', before: 94,  after: 57 },
  { month: 'Apr', before: 88,  after: 54 },
  { month: 'May', before: 90,  after: 55 },
  { month: 'Jun', before: 82,  after: 51 },
  { month: 'Jul', before: 80,  after: 50 },
  { month: 'Aug', before: 84,  after: 52 },
  { month: 'Sep', before: 87,  after: 54 },
  { month: 'Oct', before: 92,  after: 57 },
  { month: 'Nov', before: 97,  after: 60 },
  { month: 'Dec', before: 102, after: 63 },
];

/**
 * Calculate aggregate impact for a collection of placed infrastructure items.
 * Uses compound reduction logic (each item reduces from the remaining baseline).
 */
export function calcTotalImpact(placedItems) {
  const types = placedItems
    .map(p => INFRA_TYPES.find(t => t.id === p.typeId))
    .filter(Boolean);

  const totalCost = types.reduce((a, t) => a + t.costM, 0);
  const totalAnnualSaving = types.reduce((a, t) => a + t.annualSavingM, 0);

  // Compound reductions
  const pollutants = ['NOx', 'NO2', 'PM25', 'CO2', 'SO2'];
  const reductions = {};
  pollutants.forEach(p => {
    let remaining = 1;
    types.forEach(t => { remaining *= (1 - (t.reductions[p] ?? 0) / 100); });
    reductions[p] = +((1 - remaining) * 100).toFixed(1);
  });

  const avgPayback = types.length
    ? +(types.reduce((a, t) => a + t.paybackYears, 0) / types.length).toFixed(1)
    : 0;

  const score = Math.min(100, Math.round(
    ((reductions.NOx + reductions.NO2) / 2) * 0.5 +
    (reductions.CO2) * 0.3 +
    Math.max(0, 40 - avgPayback * 2) * 0.2
  ));

  return {
    totalCost: +totalCost.toFixed(2),
    totalAnnualSaving: +totalAnnualSaving.toFixed(2),
    reductions,
    avgPayback,
    score,
  };
}
