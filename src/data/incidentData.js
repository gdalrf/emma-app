/**
 * Pre-defined incident events for Incident Investigation mode in Emissions Replay.
 * Each incident represents a detected spike at a specific sensor and timestamp.
 */

export const INCIDENTS = [
  {
    id: 'INC-001',
    date: '2025-01-14',
    hour: 8,
    step: 2, // 08:10
    sensor: 'S02',
    sensorName: 'Millbay Ferry Terminal',
    lat: 50.3635, lng: -4.1488,
    pollutant: 'NO2',
    reading: 164,
    unit: 'µg/m³',
    vessel: { id: 'V02', name: 'PS Brittany Ferry', type: 'Ferry', engineType: 'Heavy Marine Diesel', imo: '9234567' },
    windDir: 230,
    windSpeed: 15,
    confidence: 88,
    severity: 'high',
    title: 'Unusual NO2 spike — Millbay Ferry Terminal',
    description: 'NO₂ reading of 164 µg/m³ detected during Brittany Ferry departure procedure at 08:10. SW wind at 15 kn is consistent with direct plume transport from Berth 5 to sensor S02. AIS data confirms vessel at berth 08:02–08:17.',
  },
  {
    id: 'INC-002',
    date: '2025-01-14',
    hour: 17,
    step: 5, // 17:25
    sensor: 'S01',
    sensorName: 'Devonport Naval Basin',
    lat: 50.3705, lng: -4.1571,
    pollutant: 'NOx',
    reading: 312,
    unit: 'µg/m³',
    vessel: { id: 'V03', name: 'RFA Wave Knight', type: 'Naval Auxiliary', engineType: 'Diesel', imo: '9345678' },
    windDir: 222,
    windSpeed: 18,
    confidence: 74,
    severity: 'high',
    title: 'NOx exceedance — Devonport Naval Basin',
    description: 'NOx reading of 312 µg/m³ detected at 17:25 during RFA Wave Knight slow-speed manoeuvring into basin. Backing SW wind at 18 kn carries exhaust plume directly toward S01. No prior warning issued.',
  },
  {
    id: 'INC-003',
    date: '2025-01-15',
    hour: 7,
    step: 8, // 07:40
    sensor: 'S05',
    sensorName: 'Cattewater Oil Terminal',
    lat: 50.3594, lng: -4.1288,
    pollutant: 'PM2.5',
    reading: 21.4,
    unit: 'µg/m³',
    vessel: { id: 'V04', name: 'MV Celtic Carrier', type: 'Bulk Cargo', engineType: 'Diesel', imo: '9456789' },
    windDir: 228,
    windSpeed: 17,
    confidence: 81,
    severity: 'medium',
    title: 'Elevated PM2.5 — Cattewater Terminal',
    description: 'PM2.5 at 21.4 µg/m³ (85% of WHO interim target) recorded at 07:40 during MV Celtic Carrier loading operations. Emission pattern consistent with auxiliary engine load cycles at Cattewater under SW wind.',
  },
  {
    id: 'INC-004',
    date: '2025-01-16',
    hour: 8,
    step: 4, // 08:20
    sensor: 'S06',
    sensorName: 'Turnchapel Jetty',
    lat: 50.3556, lng: -4.1227,
    pollutant: 'NO2',
    reading: 178,
    unit: 'µg/m³',
    vessel: { id: 'V06', name: 'MV Europa Star', type: 'Container', engineType: 'Diesel', imo: '9678901' },
    windDir: 225,
    windSpeed: 16,
    confidence: 92,
    severity: 'high',
    title: 'Critical NO2 spike — Turnchapel Jetty',
    description: 'NO₂ reading of 178 µg/m³ (89% of EU AAQ Directive limit) at 08:20. MV Europa Star confirmed at berth with AIS transponder active. Prevailing SW wind at 16 kn places exhaust plume directly over S06. Recommend formal vessel notice.',
  },
  {
    id: 'INC-005',
    date: '2025-01-17',
    hour: 18,
    step: 3, // 18:15
    sensor: 'S01',
    sensorName: 'Devonport Naval Basin',
    lat: 50.3705, lng: -4.1571,
    pollutant: 'NOx',
    reading: 344,
    unit: 'µg/m³',
    vessel: { id: 'V01', name: 'MV Atlantic Pioneer', type: 'Cargo', engineType: 'Diesel', imo: '9812345' },
    windDir: 238,
    windSpeed: 20,
    confidence: 79,
    severity: 'high',
    title: 'NOx alert — Devonport Naval Basin',
    description: 'NOx reading of 344 µg/m³ at 18:15 during MV Atlantic Pioneer departure. Strongest wind of the day at 20 kn SW contributes to elevated plume concentration at sensor. Engine warm-up period likely contributor.',
  },
];

export function getIncidentsForDate(dateStr) {
  return INCIDENTS.filter(i => i.date === dateStr);
}

export function getIncidentAtStep(dateStr, hour, step) {
  return INCIDENTS.find(
    i => i.date === dateStr && i.hour === hour && Math.abs(i.step - step) <= 1
  ) ?? null;
}
