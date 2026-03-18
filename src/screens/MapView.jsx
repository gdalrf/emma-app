import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  sensors, pollutants, pollutantColors, pollutantUnits, pollutantThresholds,
  pollutantType, pollutantLabel, pollutantLimits,
  sensorReadings, getLatestReading, vessels,
} from '../data/mockData';

const PLYMOUTH_CENTER = [50.3656, -4.1571];

const PERIOD_OPTIONS = [
  { label: '3 Months',  value: 3 },
  { label: '6 Months',  value: 6 },
  { label: '12 Months', value: 12 },
];

// Random vessel near each sensor for popup flavour
function nearbyVessel(sensorIdx) {
  return vessels[sensorIdx % vessels.length];
}

export default function MapView() {
  const [activePollutant, setActivePollutant] = useState('NO2');
  const [period, setPeriod]                   = useState(3);
  const [selected, setSelected]               = useState(null);

  // Compute avg reading per sensor for selected pollutant & period
  function avgForSensor(sensorId) {
    const readings = sensorReadings[sensorId].slice(-period);
    const avg = readings.reduce((a, r) => a + r[activePollutant], 0) / readings.length;
    return +avg.toFixed(2);
  }

  function getColor(value) {
    const threshold = pollutantThresholds[activePollutant];
    const ratio = Math.min(value / threshold, 1);
    if (ratio < 0.5) return '#10b981';
    if (ratio < 0.75) return '#f59e0b';
    return '#ef4444';
  }

  function getRadius(value) {
    const threshold = pollutantThresholds[activePollutant];
    return 8 + (value / threshold) * 18;
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header + controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Map View</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>Plymouth Harbour — Sensor Network</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
            {PERIOD_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                className="px-3 py-1.5 text-xs font-medium transition"
                style={{
                  background: period === o.value ? '#1d6fa4' : '#0a1628',
                  color: period === o.value ? '#fff' : '#64748b',
                }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pollutant toggles */}
      <div className="flex flex-wrap gap-2 items-center">
        {pollutants.map(p => {
          const pType = pollutantType[p];
          const isActive = activePollutant === p;
          return (
            <button
              key={p}
              onClick={() => setActivePollutant(p)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
              style={{
                background: isActive ? pollutantColors[p] : 'rgba(29,111,164,0.1)',
                color: isActive ? '#fff' : '#94a3b8',
                border: `1px ${pType === 'modelled' ? 'dashed' : 'solid'} ${isActive ? pollutantColors[p] : 'rgba(29,111,164,0.3)'}`,
              }}>
              {p === 'NOx' ? 'NOx*' : p}
              {pType === 'modelled' && (
                <span className="text-xs font-bold px-1 rounded"
                  style={{ background: 'rgba(96,165,250,0.25)', color: '#60a5fa', fontSize: 9 }}>M</span>
              )}
            </button>
          );
        })}
        <span className="text-xs ml-1" style={{ color: '#475569' }}>* derived · M = modelled</span>
      </div>

      {/* Map + legend row */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0" style={{ minHeight: 480 }}>
        {/* Map */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.3)', height: 540 }}>
          <MapContainer
            center={PLYMOUTH_CENTER}
            zoom={13}
            style={{ height: 540, width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            {sensors.map((sensor, idx) => {
              const val = avgForSensor(sensor.id);
              const vessel = nearbyVessel(idx);
              const pct = Math.min(100, +(val / pollutantThresholds[activePollutant] * 100).toFixed(0));
              return (
                <CircleMarker
                  key={sensor.id}
                  center={[sensor.lat, sensor.lng]}
                  radius={getRadius(val)}
                  pathOptions={{
                    color: getColor(val),
                    fillColor: getColor(val),
                    fillOpacity: 0.55,
                    weight: 2,
                  }}
                  eventHandlers={{ click: () => setSelected({ sensor, val, vessel, pct }) }}
                >
                  <Popup>
                    <div style={{ minWidth: 220, fontFamily: 'Inter, sans-serif' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{sensor.name}</span>
                        <span style={{ fontSize: 10, color: '#64748b', background: '#060e19', padding: '2px 6px', borderRadius: 4 }}>{sensor.id}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{sensor.type} · {period}m avg</div>

                      <div style={{ background: '#060e19', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {pollutantLabel[activePollutant]}
                          {pollutantType[activePollutant] === 'modelled' && (
                            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', padding: '1px 4px', borderRadius: 3 }}>M modelled</span>
                          )}
                          {pollutantType[activePollutant] === 'derived' && (
                            <span style={{ fontSize: 9, color: '#94a3b8' }}>derived</span>
                          )}
                        </div>
                        <div style={{ color: getColor(val), fontWeight: 700, fontSize: 20 }}>
                          {val} <span style={{ fontSize: 12, fontWeight: 400 }}>{pollutantUnits[activePollutant]}</span>
                        </div>
                        <div style={{ marginTop: 6, background: '#0a1628', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: getColor(val), borderRadius: 4 }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
                          {pct}% of {pollutantType[activePollutant] === 'modelled' ? 'display' : 'regulatory'} limit
                          {pollutantType[activePollutant] === 'modelled' && (
                            <span style={{ marginLeft: 4, color: '#60a5fa' }}>· modelled from vessel activity</span>
                          )}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid rgba(29,111,164,0.3)', paddingTop: 8 }}>
                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Nearby Vessel</div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#60a5fa' }}>{vessel.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {vessel.type} · {vessel.flag} · IMO {vessel.imo}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          Engine: {vessel.engineType} · GT: {vessel.gtonnage.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* Legend */}
          <div className="rounded-xl p-4" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
            <h3 className="text-xs font-semibold text-white mb-3">Concentration Level</h3>
            {[
              { label: 'Low (0–50%)',    color: '#10b981' },
              { label: 'Medium (50–75%)', color: '#f59e0b' },
              { label: 'High (75–100%)', color: '#ef4444' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: l.color }} />
                <span className="text-xs" style={{ color: '#94a3b8' }}>{l.label}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(29,111,164,0.2)' }}>
              <p className="text-xs" style={{ color: '#64748b' }}>Active layer</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-sm font-bold" style={{ color: pollutantColors[activePollutant] }}>
                  {activePollutant}
                </p>
                {pollutantType[activePollutant] === 'modelled' && (
                  <span className="text-xs font-bold px-1 rounded" style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', fontSize: 9 }}>M</span>
                )}
                {pollutantType[activePollutant] === 'derived' && (
                  <span className="text-xs" style={{ color: '#94a3b8', fontSize: 9 }}>*derived</span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                {pollutantType[activePollutant] === 'modelled' ? 'Display' : 'Limit'}: {pollutantLimits[activePollutant]} {pollutantUnits[activePollutant]}
              </p>
              {pollutantType[activePollutant] === 'modelled' && (
                <p className="text-xs mt-1" style={{ color: '#475569', lineHeight: 1.4 }}>
                  Modelled from vessel fuel type &amp; engine activity — not directly measured.
                </p>
              )}
            </div>
          </div>

          {/* Sensor list */}
          <div className="rounded-xl p-4 flex-1 overflow-y-auto" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
            <h3 className="text-xs font-semibold text-white mb-3">Sensor Readings ({period}m avg)</h3>
            <div className="space-y-2">
              {sensors.map(s => {
                const val = avgForSensor(s.id);
                const color = getColor(val);
                const pct = Math.min(100, +(val / pollutantThresholds[activePollutant] * 100).toFixed(0));
                return (
                  <div key={s.id} className="rounded-lg p-2.5" style={{ background: '#060e19' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white truncate mr-2">{s.name}</span>
                      <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color }}>{val}</span>
                    </div>
                    <div className="rounded-full h-1.5 overflow-hidden" style={{ background: '#0a1628' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
