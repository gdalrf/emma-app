import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  generateDayData, REPLAY_POLLUTANTS, REPLAY_THRESHOLDS, REPLAY_COLORS,
  REPLAY_DATES, readingColor, readingIntensity, STEPS_PER_HOUR,
} from '../data/replayData.js';
import { sensors } from '../data/mockData.js';

// Plymouth harbour centre — correct lat/lng
const PLYMOUTH_CENTER = [50.3656, -4.1423];
const MAP_HEIGHT = 540; // explicit px — fixes the blank-map bug

/* ─── Pre-generate all day data up-front ────────────────────────────────────── */
const dayCache = {};
function getDayData(dateStr) {
  if (!dayCache[dateStr]) dayCache[dateStr] = generateDayData(dateStr);
  return dayCache[dateStr];
}

/* ─── Timestamp formatter ───────────────────────────────────────────────────── */
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatTimestamp(dateStr, hour, minute) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} — ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* ─── leaflet.heat layer managed via useEffect ──────────────────────────────── */
function HeatLayer({ stepData, pollutant }) {
  const map = useMap();
  const heatRef = useRef(null);

  useEffect(() => {
    // Build heatmap points: [lat, lng, intensity 0–1]
    const points = stepData
      ? sensors.map(s => {
          const val = stepData.sensorReadings[s.id]?.[pollutant] ?? 0;
          const intensity = readingIntensity(val, pollutant);
          return [s.lat, s.lng, intensity];
        })
      : [];

    if (!heatRef.current) {
      // Create the layer on first render
      heatRef.current = L.heatLayer(points, {
        radius:  45,
        blur:    30,
        maxZoom: 15,
        max:     1.0,
        gradient: {
          0.0: '#10b981', // green — low
          0.5: '#f59e0b', // amber — moderate
          0.8: '#ef4444', // red — high
          1.0: '#7f1d1d', // deep red — exceeds limit
        },
        minOpacity: 0.25,
      });
      heatRef.current.addTo(map);
    } else {
      // Update points on each step change
      heatRef.current.setLatLngs(points);
      heatRef.current.redraw();
    }

    return () => {
      // Cleanup only on unmount
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepData, pollutant]);

  // Remove layer on unmount
  useEffect(() => {
    return () => {
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
        heatRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/* ─── Sensor marker with glow pulse ────────────────────────────────────────── */
function SensorMarker({ sensor, value, pollutant, isPlaying }) {
  const color  = readingColor(value, pollutant);
  const int    = readingIntensity(value, pollutant);
  const radius = 6 + int * 11;

  return (
    <>
      {/* Outer glow ring */}
      <CircleMarker
        center={[sensor.lat, sensor.lng]}
        radius={radius + 9}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: isPlaying ? 0.10 + int * 0.10 : 0.06,
          weight: isPlaying ? 1.5 : 0.5,
          opacity: isPlaying ? 0.5 : 0.3,
        }}
        pane="shadowPane"
      />
      {/* Core node */}
      <CircleMarker
        center={[sensor.lat, sensor.lng]}
        radius={radius}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: 0.82 + int * 0.18,
          weight: 2,
          opacity: 1,
        }}
        pane="markerPane"
      >
        <Popup>
          <div style={{ minWidth: 210, fontFamily: 'Inter, sans-serif' }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 3 }}>{sensor.name}</p>
            <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>{sensor.id} · {sensor.type}</p>
            <div style={{ background: '#060e19', borderRadius: 8, padding: '8px 12px' }}>
              <p style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>{pollutant}</p>
              <p style={{ color, fontWeight: 700, fontSize: 24, margin: 0 }}>
                {value}<span style={{ fontSize: 12, fontWeight: 400 }}> µg/m³</span>
              </p>
              <div style={{ marginTop: 8, background: '#0a1628', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, int * 100).toFixed(0)}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                {(int * 100).toFixed(0)}% of regulatory limit ({REPLAY_THRESHOLDS[pollutant]} µg/m³)
              </p>
            </div>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────────────── */
export default function EmissionsReplay() {
  const [selectedDate, setSelectedDate] = useState(REPLAY_DATES[0].value);
  const [hour, setHour]                 = useState(8);
  const [step, setStep]                 = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [pollutant, setPollutant]       = useState('NO2');
  const [speed, setSpeed]               = useState(800);
  const intervalRef                     = useRef(null);

  const dayData  = getDayData(selectedDate);
  const stepData = dayData[hour]?.[step];
  const minute   = step * 5;
  const timestamp = formatTimestamp(selectedDate, hour, minute);

  /* ── Playback logic ── */
  const advanceStep = useCallback(() => {
    setStep(s => {
      if (s < STEPS_PER_HOUR - 1) return s + 1;
      setHour(h => {
        if (h < 23) return h + 1;
        setIsPlaying(false);
        return h;
      });
      return 0;
    });
  }, []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(advanceStep, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speed, advanceStep]);

  function handleHourChange(h) {
    setIsPlaying(false);
    setHour(h);
    setStep(0);
  }

  function handlePlayPause() {
    if (!isPlaying && hour === 23 && step === STEPS_PER_HOUR - 1) {
      setHour(0); setStep(0);
    }
    setIsPlaying(p => !p);
  }

  const scrubberMax = 24 * STEPS_PER_HOUR - 1;
  const scrubberVal = hour * STEPS_PER_HOUR + step;

  function onScrubberChange(v) {
    setIsPlaying(false);
    setHour(Math.floor(v / STEPS_PER_HOUR));
    setStep(v % STEPS_PER_HOUR);
  }

  const HOUR_ENVELOPE = [
    0.25,0.20,0.18,0.18,0.22,0.40,0.65,0.95,1.00,0.85,0.70,0.60,
    0.55,0.58,0.62,0.68,0.90,1.00,0.80,0.60,0.45,0.38,0.30,0.27,
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Emissions Replay</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Animated intraday pollution time-lapse · Plymouth Harbour
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setHour(8); setStep(0); setIsPlaying(false); }}
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: '#0a1628', color: '#e2e8f0', border: '1px solid rgba(29,111,164,0.4)' }}>
            {REPLAY_DATES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>

          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
            {REPLAY_POLLUTANTS.map(p => (
              <button key={p} onClick={() => setPollutant(p)}
                className="px-3 py-1.5 text-xs font-semibold transition"
                style={{
                  background: pollutant === p ? REPLAY_COLORS[p] : '#0a1628',
                  color: pollutant === p ? '#fff' : '#64748b',
                }}>
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#64748b' }}>Speed</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
              {[{ l: '½×', v: 1600 },{ l: '1×', v: 800 },{ l: '2×', v: 400 },{ l: '4×', v: 200 }].map(s => (
                <button key={s.v} onClick={() => setSpeed(s.v)}
                  className="px-2.5 py-1.5 text-xs transition"
                  style={{ background: speed === s.v ? '#1d6fa4' : '#0a1628', color: speed === s.v ? '#fff' : '#64748b' }}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Map + side panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Map column */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden relative"
          style={{ border: '1px solid rgba(29,111,164,0.3)', height: MAP_HEIGHT }}>

          {/* Timestamp badge */}
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, pointerEvents: 'none',
          }}>
            <div style={{
              padding: '8px 18px', borderRadius: 10,
              background: 'rgba(6,14,25,0.90)',
              color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '0.03em',
              border: '1px solid rgba(29,111,164,0.55)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              fontFamily: 'Inter, sans-serif',
            }}>
              {timestamp}
            </div>
          </div>

          {/* REC badge */}
          {isPlaying && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              zIndex: 1000, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.92)', color: '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#fff',
                display: 'inline-block',
                animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
              }} />
              REC
            </div>
          )}

          {/* THE MAP — explicit height is critical for Leaflet to render */}
          <MapContainer
            center={PLYMOUTH_CENTER}
            zoom={13}
            style={{ width: '100%', height: MAP_HEIGHT }}
            zoomControl
          >
            {/* OSM base tiles — free, no API key, always loads */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />

            {/* leaflet.heat heatmap — sits above tiles, below markers */}
            <HeatLayer stepData={stepData} pollutant={pollutant} />

            {/* Sensor nodes on top */}
            {stepData && sensors.map(s => (
              <SensorMarker
                key={s.id}
                sensor={s}
                value={stepData.sensorReadings[s.id]?.[pollutant] ?? 0}
                pollutant={pollutant}
                isPlaying={isPlaying}
              />
            ))}
          </MapContainer>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3" style={{ height: MAP_HEIGHT, overflowY: 'auto' }}>

          {/* Per-sensor readings */}
          <div className="rounded-xl p-4 flex-1"
            style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white">Sensor Readings</h3>
              <span className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: 'rgba(29,111,164,0.2)', color: '#60a5fa' }}>
                {String(hour).padStart(2,'0')}:{String(minute).padStart(2,'0')}
              </span>
            </div>
            <div className="space-y-2">
              {sensors.map(s => {
                const val   = stepData?.sensorReadings[s.id]?.[pollutant] ?? 0;
                const col   = readingColor(val, pollutant);
                const int   = readingIntensity(val, pollutant);
                const limit = REPLAY_THRESHOLDS[pollutant];
                return (
                  <div key={s.id} className="rounded-lg p-2.5"
                    style={{ background: '#060e19', borderLeft: `3px solid ${col}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white truncate mr-2" title={s.name}>
                        {s.name.replace('Plymouth ', '').replace(' Harbour','').replace(' Terminal','')}
                      </span>
                      <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color: col }}>
                        {val}
                      </span>
                    </div>
                    <div className="rounded-full h-1.5 overflow-hidden" style={{ background: '#0a1628' }}>
                      <div style={{
                        width: `${Math.min(100, (val / limit) * 100).toFixed(0)}%`,
                        height: '100%', background: col, borderRadius: 9999,
                        transition: 'width 0.45s ease',
                      }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs" style={{ color: '#475569' }}>{s.type}</span>
                      <span className="text-xs font-mono" style={{ color: '#475569' }}>
                        {(int * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="rounded-xl p-4 flex-shrink-0"
            style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
            <h3 className="text-xs font-semibold text-white mb-3">Concentration Level</h3>
            {[
              { label: 'Low',      sub: '<45% of limit',  color: '#10b981' },
              { label: 'Moderate', sub: '45–75%',         color: '#f59e0b' },
              { label: 'High',     sub: '>75% of limit',  color: '#ef4444' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2 mb-1.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: l.color }} />
                <span className="text-xs font-medium text-white">{l.label}</span>
                <span className="text-xs" style={{ color: '#64748b' }}>{l.sub}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: 'rgba(29,111,164,0.2)', color: '#64748b' }}>
              <p className="font-semibold" style={{ color: '#94a3b8' }}>
                {pollutant} limit: <span style={{ color: REPLAY_COLORS[pollutant] }}>{REPLAY_THRESHOLDS[pollutant]} µg/m³</span>
              </p>
              <p className="mt-1.5">☁️ SW wind · downwind sensors lag 5–15 min</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Playback controls ── */}
      <div className="rounded-xl p-4"
        style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>

        {/* Hour activity bar */}
        <div className="flex items-end gap-1 mb-4 overflow-x-auto pb-1">
          {HOUR_ENVELOPE.map((env, h) => (
            <button
              key={h}
              onClick={() => handleHourChange(h)}
              title={`${String(h).padStart(2,'0')}:00`}
              className="flex-shrink-0 flex flex-col items-center gap-1 group"
              style={{ minWidth: 18 }}>
              <div style={{
                width: 16, height: Math.max(4, env * 32), borderRadius: 3,
                background: hour === h ? REPLAY_COLORS[pollutant] : 'rgba(29,111,164,0.35)',
                transition: 'background 0.2s, height 0.2s',
                boxShadow: hour === h ? `0 0 8px ${REPLAY_COLORS[pollutant]}88` : 'none',
              }} />
              {h % 3 === 0 && (
                <span style={{ fontSize: 9, color: hour === h ? REPLAY_COLORS[pollutant] : '#334155' }}>
                  {String(h).padStart(2,'0')}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transport row */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setIsPlaying(false); setHour(0); setStep(0); }}
            style={{ color: '#64748b', background: '#060e19', padding: '6px 10px', borderRadius: 6, fontSize: 14 }}
            title="Jump to 00:00">⏮</button>

          <button
            onClick={handlePlayPause}
            style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: isPlaying ? '#ef4444' : '#1d6fa4', color: '#fff',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 14px ${isPlaying ? '#ef444466' : '#1d6fa466'}`,
              border: 'none', cursor: 'pointer',
            }}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button onClick={() => { setIsPlaying(false); setHour(23); setStep(STEPS_PER_HOUR - 1); }}
            style={{ color: '#64748b', background: '#060e19', padding: '6px 10px', borderRadius: 6, fontSize: 14 }}
            title="Jump to 23:55">⏭</button>

          {/* Global scrubber */}
          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs font-mono flex-shrink-0" style={{ color: '#64748b', width: 36 }}>
              {String(hour).padStart(2,'0')}:00
            </span>
            <input
              type="range"
              min={0} max={scrubberMax} value={scrubberVal}
              onChange={e => onScrubberChange(+e.target.value)}
              className="flex-1"
              style={{ accentColor: REPLAY_COLORS[pollutant], height: 4 }}
            />
            <span className="text-xs font-mono flex-shrink-0" style={{ color: '#64748b', width: 36 }}>
              {String(Math.min(23, hour + 1)).padStart(2,'0')}:00
            </span>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-white font-mono">
              {String(hour).padStart(2,'0')}:{String(minute).padStart(2,'0')}
            </p>
            <p className="text-xs" style={{ color: '#475569' }}>
              Step {step + 1} / {STEPS_PER_HOUR}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
