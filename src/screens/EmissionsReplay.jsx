import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  generateDayData, REPLAY_POLLUTANTS, REPLAY_THRESHOLDS, REPLAY_COLORS,
  REPLAY_DATES, readingColor, readingIntensity, STEPS_PER_HOUR,
  beaufort, compassLabel,
} from '../data/replayData.js';
import { sensors } from '../data/mockData.js';

const PLYMOUTH_CENTER = [50.3656, -4.1423];
const MAP_HEIGHT = 540;
const NUM_PARTICLES = 220;

const dayCache = {};
function getDayData(dateStr) {
  if (!dayCache[dateStr]) dayCache[dateStr] = generateDayData(dateStr);
  return dayCache[dateStr];
}

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatTimestamp(dateStr, hour, minute) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} — ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Convert hex colour to "r,g,b" string for rgba()
function hexRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

/* ─── Wind direction → canvas velocity vector ──────────────────────────────────
   Meteorological: dir = degrees the wind comes FROM (0=N, 90=E, 225=SW…)
   Canvas: x right = east, y down = south.
   Wind FROM 225° (SW) blows particles TOWARD NE:
     vx = +sin(45°) = +0.71  (rightward)
     vy = -cos(45°) = -0.71  (upward, because y-down)                          */
function windVector(dirFrom) {
  const toRad = ((dirFrom + 180) % 360) * Math.PI / 180;
  return { vx: Math.sin(toRad), vy: -Math.cos(toRad) };
}

/* ─── leaflet.heat wrapper ──────────────────────────────────────────────────── */
function HeatLayer({ stepData, pollutant }) {
  const map     = useMap();
  const heatRef = useRef(null);

  useEffect(() => {
    const points = stepData
      ? sensors.map(s => {
          const val = stepData.sensorReadings[s.id]?.[pollutant] ?? 0;
          return [s.lat, s.lng, readingIntensity(val, pollutant)];
        })
      : [];

    if (!heatRef.current) {
      heatRef.current = L.heatLayer(points, {
        radius: 45, blur: 30, maxZoom: 15, max: 1.0, minOpacity: 0.22,
        gradient: { 0.0:'#10b981', 0.5:'#f59e0b', 0.8:'#ef4444', 1.0:'#7f1d1d' },
      }).addTo(map);
    } else {
      heatRef.current.setLatLngs(points);
      heatRef.current.redraw();
    }
  }, [stepData, pollutant]); // eslint-disable-line

  useEffect(() => () => { heatRef.current && map.removeLayer(heatRef.current); }, []); // eslint-disable-line
  return null;
}

/* ─── Canvas wind-particle + plume layer ────────────────────────────────────── */
function WindPlumeCanvas({ wind, stepData, pollutant, showWind, showPlumes }) {
  const map      = useMap();
  const canvasRef = useRef(null);
  const pRef     = useRef([]); // particles
  const rafRef   = useRef(null);
  // Keep a ref of current props so the rAF loop always reads fresh values
  const stateRef = useRef({ wind, stepData, pollutant, showWind, showPlumes });
  useEffect(() => { stateRef.current = { wind, stepData, pollutant, showWind, showPlumes }; });

  useEffect(() => {
    const container = map.getContainer();

    // Create canvas, layered above heatmap (overlay pane ~400) below markers (~600)
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute', top: 0, left: 0,
      pointerEvents: 'none', zIndex: 450,
    });
    container.appendChild(canvas);
    canvasRef.current = canvas;

    function resize() {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    resize();

    // Initialise particles spread randomly across viewport
    function initParticles() {
      const w = canvas.width, h = canvas.height;
      pRef.current = Array.from({ length: NUM_PARTICLES }, () => ({
        x:      Math.random() * w,
        y:      Math.random() * h,
        age:    Math.random() * 60,
        maxAge: 40 + Math.random() * 50,
        speed:  0.4 + Math.random() * 1.4,
      }));
    }
    initParticles();

    function animate() {
      const { wind, stepData, pollutant, showWind, showPlumes } = stateRef.current;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const { vx, vy } = windVector(wind.dir);
      const baseSpeed  = wind.speed * 0.14; // knots → px/frame

      // ── Wind particles ──
      if (showWind) {
        pRef.current.forEach(p => {
          const spd = p.speed * baseSpeed;
          const prevX = p.x, prevY = p.y;
          p.x += vx * spd;
          p.y += vy * spd;
          p.age++;

          const offscreen = p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30;
          if (p.age > p.maxAge || offscreen) {
            p.x      = Math.random() * w;
            p.y      = Math.random() * h;
            p.age    = 0;
            p.maxAge = 40 + Math.random() * 50;
            return;
          }

          const alpha = Math.sin((p.age / p.maxAge) * Math.PI) * 0.72;
          const tailLen = spd * 6;

          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(prevX - vx * tailLen, prevY - vy * tailLen);
          ctx.strokeStyle = `rgba(200,225,255,${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      }

      // ── Plumes ──
      if (showPlumes && stepData) {
        sensors.forEach(s => {
          const val       = stepData.sensorReadings[s.id]?.[pollutant] ?? 0;
          const intensity = readingIntensity(val, pollutant);
          if (intensity < 0.05) return;

          const color = readingColor(val, pollutant);
          const rgb   = hexRgb(color);

          const pt = map.latLngToContainerPoint([s.lat, s.lng]);

          // Plume geometry
          const plumeLen  = 35 + intensity * 90 + wind.speed * 2.5;
          const halfAngle = (18 + intensity * 18) * Math.PI / 180;
          const spread    = Math.tan(halfAngle) * plumeLen;

          // Tip of plume in wind direction
          const tipX = pt.x + vx * plumeLen;
          const tipY = pt.y + vy * plumeLen;

          // Perpendicular vector (rotate wind vector 90°)
          const px = vy;   // perpendicular x
          const py = -vx;  // perpendicular y

          // Gradient along plume axis
          const grad = ctx.createLinearGradient(pt.x, pt.y, tipX, tipY);
          grad.addColorStop(0,   `rgba(${rgb},${0.55 * intensity})`);
          grad.addColorStop(0.6, `rgba(${rgb},${0.25 * intensity})`);
          grad.addColorStop(1,   `rgba(${rgb},0)`);

          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(tipX + px * spread, tipY + py * spread);
          ctx.lineTo(tipX - px * spread, tipY - py * spread);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        });
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    animate();

    // When map moves/zooms, plumes need no special handling (computed per-frame)
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map]); // eslint-disable-line

  return null;
}

/* ─── Compass rose (SVG, positioned in map corner) ─────────────────────────── */
function CompassRose({ windDir, windSpeed }) {
  const { vx, vy } = windVector(windDir);
  // Arrow points in the "to" direction
  const arrowRot = (windDir + 180) % 360;

  return (
    <div style={{
      position: 'absolute', bottom: 40, right: 12, zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(6,14,25,0.88)', border: '1px solid rgba(29,111,164,0.5)',
        borderRadius: 12, padding: '10px 12px', backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        {/* Compass circle */}
        <svg width="72" height="72" viewBox="0 0 72 72">
          {/* Ring */}
          <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(29,111,164,0.4)" strokeWidth="1.5"/>
          {/* Cardinal labels */}
          {[['N',36,10],['S',36,66],['E',66,39],['W',6,39]].map(([l,x,y]) => (
            <text key={l} x={x} y={y} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="Inter,sans-serif">{l}</text>
          ))}
          {/* Wind arrow (points toward where wind blows TO) */}
          <g transform={`rotate(${arrowRot}, 36, 36)`}>
            {/* Shaft */}
            <line x1="36" y1="48" x2="36" y2="22" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
            {/* Arrowhead */}
            <polygon points="36,16 31,26 41,26" fill="#60a5fa"/>
            {/* Tail feathers */}
            <line x1="36" y1="48" x2="30" y2="56" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.6"/>
            <line x1="36" y1="48" x2="42" y2="56" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.6"/>
          </g>
          {/* Centre dot */}
          <circle cx="36" cy="36" r="3" fill="#1d6fa4"/>
        </svg>

        {/* Speed + bearing */}
        <div style={{ textAlign: 'center', fontFamily: 'Inter,sans-serif' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.02em' }}>
            {compassLabel(windDir)}
          </p>
          <p style={{ fontSize: 11, color: '#60a5fa', margin: 0 }}>
            {windSpeed.toFixed(0)} kn
          </p>
          <p style={{ fontSize: 9, color: '#64748b', margin: '2px 0 0' }}>
            Bft {beaufort(windSpeed).n} · {beaufort(windSpeed).label}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Sensor marker ─────────────────────────────────────────────────────────── */
function SensorMarker({ sensor, value, pollutant, isPlaying }) {
  const color  = readingColor(value, pollutant);
  const int    = readingIntensity(value, pollutant);
  const radius = 6 + int * 11;

  return (
    <>
      <CircleMarker
        center={[sensor.lat, sensor.lng]}
        radius={radius + 9}
        pathOptions={{ color, fillColor: color,
          fillOpacity: isPlaying ? 0.10 + int * 0.10 : 0.06,
          weight: isPlaying ? 1.5 : 0.5, opacity: isPlaying ? 0.5 : 0.3 }}
        pane="shadowPane"
      />
      <CircleMarker
        center={[sensor.lat, sensor.lng]}
        radius={radius}
        pathOptions={{ color, fillColor: color,
          fillOpacity: 0.82 + int * 0.18, weight: 2, opacity: 1 }}
        pane="markerPane"
      >
        <Popup>
          <div style={{ minWidth: 210, fontFamily: 'Inter,sans-serif' }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 3 }}>{sensor.name}</p>
            <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>{sensor.id} · {sensor.type}</p>
            <div style={{ background: '#060e19', borderRadius: 8, padding: '8px 12px' }}>
              <p style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>{pollutant}</p>
              <p style={{ color, fontWeight: 700, fontSize: 24, margin: 0 }}>
                {value}<span style={{ fontSize: 12, fontWeight: 400 }}> µg/m³</span>
              </p>
              <div style={{ marginTop: 8, background: '#0a1628', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, int * 100).toFixed(0)}%`, height: '100%', background: color, borderRadius: 4 }} />
              </div>
              <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                {(int * 100).toFixed(0)}% of limit ({REPLAY_THRESHOLDS[pollutant]} µg/m³)
              </p>
            </div>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}

/* ─── Toggle button ─────────────────────────────────────────────────────────── */
function ToggleBtn({ label, active, onClick, activeColor = '#1d6fa4' }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
      style={{
        background: active ? activeColor : '#0a1628',
        color: active ? '#fff' : '#64748b',
        border: `1px solid ${active ? activeColor : 'rgba(29,111,164,0.4)'}`,
        boxShadow: active ? `0 0 10px ${activeColor}55` : 'none',
      }}>
      {active ? '● ' : '○ '}{label}
    </button>
  );
}

/* ─── Main screen ───────────────────────────────────────────────────────────── */
const HOUR_ENVELOPE = [
  0.25,0.20,0.18,0.18,0.22,0.40,0.65,0.95,1.00,0.85,0.70,0.60,
  0.55,0.58,0.62,0.68,0.90,1.00,0.80,0.60,0.45,0.38,0.30,0.27,
];

export default function EmissionsReplay() {
  const [selectedDate, setSelectedDate] = useState(REPLAY_DATES[0].value);
  const [hour, setHour]                 = useState(8);
  const [step, setStep]                 = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [pollutant, setPollutant]       = useState('NO2');
  const [speed, setSpeed]               = useState(800);
  const [showWind, setShowWind]         = useState(true);
  const [showPlumes, setShowPlumes]     = useState(true);
  const intervalRef                     = useRef(null);

  const dayData  = getDayData(selectedDate);
  const stepData = dayData[hour]?.[step];
  const wind     = stepData?.wind ?? { dir: 225, speed: 15, gust: 17 };
  const minute   = step * 5;
  const timestamp = formatTimestamp(selectedDate, hour, minute);

  const advanceStep = useCallback(() => {
    setStep(s => {
      if (s < STEPS_PER_HOUR - 1) return s + 1;
      setHour(h => { if (h < 23) return h + 1; setIsPlaying(false); return h; });
      return 0;
    });
  }, []);

  useEffect(() => {
    if (isPlaying) intervalRef.current = setInterval(advanceStep, speed);
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speed, advanceStep]);

  function handleHourChange(h) { setIsPlaying(false); setHour(h); setStep(0); }
  function handlePlayPause() {
    if (!isPlaying && hour === 23 && step === STEPS_PER_HOUR - 1) { setHour(0); setStep(0); }
    setIsPlaying(p => !p);
  }

  const scrubberMax = 24 * STEPS_PER_HOUR - 1;
  const scrubberVal = hour * STEPS_PER_HOUR + step;
  function onScrubberChange(v) { setIsPlaying(false); setHour(Math.floor(v/STEPS_PER_HOUR)); setStep(v%STEPS_PER_HOUR); }

  const bft = beaufort(wind.speed);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Emissions Replay</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>Animated intraday pollution & wind · Plymouth Harbour</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setHour(8); setStep(0); setIsPlaying(false); }}
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: '#0a1628', color: '#e2e8f0', border: '1px solid rgba(29,111,164,0.4)' }}>
            {REPLAY_DATES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>

          {/* Pollutant */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
            {REPLAY_POLLUTANTS.map(p => (
              <button key={p} onClick={() => setPollutant(p)}
                className="px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: pollutant===p ? REPLAY_COLORS[p] : '#0a1628', color: pollutant===p ? '#fff' : '#64748b' }}>
                {p}
              </button>
            ))}
          </div>

          {/* Layer toggles */}
          <ToggleBtn label="Wind" active={showWind} onClick={() => setShowWind(v => !v)} activeColor="#60a5fa" />
          <ToggleBtn label="Plumes" active={showPlumes} onClick={() => setShowPlumes(v => !v)} activeColor={REPLAY_COLORS[pollutant]} />

          {/* Speed */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#64748b' }}>Speed</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
              {[{l:'½×',v:1600},{l:'1×',v:800},{l:'2×',v:400},{l:'4×',v:200}].map(s => (
                <button key={s.v} onClick={() => setSpeed(s.v)}
                  className="px-2.5 py-1.5 text-xs transition"
                  style={{ background: speed===s.v?'#1d6fa4':'#0a1628', color: speed===s.v?'#fff':'#64748b' }}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Map + side panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Map */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden relative"
          style={{ border: '1px solid rgba(29,111,164,0.3)', height: MAP_HEIGHT }}>

          {/* Timestamp badge */}
          <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', zIndex:1000, pointerEvents:'none' }}>
            <div style={{
              padding:'8px 18px', borderRadius:10, background:'rgba(6,14,25,0.90)',
              color:'#fff', fontWeight:700, fontSize:14, letterSpacing:'0.03em',
              border:'1px solid rgba(29,111,164,0.55)', boxShadow:'0 4px 24px rgba(0,0,0,0.55)',
              backdropFilter:'blur(8px)', fontFamily:'Inter,sans-serif',
            }}>
              {timestamp}
            </div>
          </div>

          {/* Wind info pill — top left */}
          <div style={{ position:'absolute', top:12, left:12, zIndex:1000, pointerEvents:'none' }}>
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'6px 12px', borderRadius:8, background:'rgba(6,14,25,0.88)',
              border:'1px solid rgba(96,165,250,0.4)', backdropFilter:'blur(6px)',
              fontFamily:'Inter,sans-serif',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
              </svg>
              <div>
                <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>
                  {compassLabel(wind.dir)} {wind.speed.toFixed(0)} kn
                </span>
                <span style={{ fontSize:10, color:'#64748b', marginLeft:6 }}>
                  Bft {bft.n} · {bft.label}
                </span>
                {wind.gust > wind.speed + 3 && (
                  <span style={{ fontSize:10, color:'#f59e0b', marginLeft:6 }}>
                    gusting {wind.gust.toFixed(0)} kn
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* REC badge */}
          {isPlaying && (
            <div style={{
              position:'absolute', top:12, right:12, zIndex:1000, pointerEvents:'none',
              display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8,
              background:'rgba(239,68,68,0.92)', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'Inter,sans-serif',
            }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff', display:'inline-block' }}/>
              REC
            </div>
          )}

          <MapContainer center={PLYMOUTH_CENTER} zoom={13} style={{ width:'100%', height:MAP_HEIGHT }} zoomControl>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
            <HeatLayer stepData={stepData} pollutant={pollutant} />
            <WindPlumeCanvas
              wind={wind}
              stepData={stepData}
              pollutant={pollutant}
              showWind={showWind}
              showPlumes={showPlumes}
            />
            {stepData && sensors.map(s => (
              <SensorMarker key={s.id} sensor={s}
                value={stepData.sensorReadings[s.id]?.[pollutant] ?? 0}
                pollutant={pollutant} isPlaying={isPlaying} />
            ))}
          </MapContainer>

          {/* Compass rose (outside MapContainer so z-index is reliable) */}
          <CompassRose windDir={wind.dir} windSpeed={wind.speed} />
        </div>

        {/* ── Side panel ── */}
        <div className="flex flex-col gap-3" style={{ height: MAP_HEIGHT, overflowY: 'auto' }}>

          {/* Wind card */}
          <div className="rounded-xl p-4 flex-shrink-0"
            style={{ background: '#0a1628', border: '1px solid rgba(96,165,250,0.25)' }}>
            <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
              <span style={{ color:'#60a5fa' }}>↗</span> Wind Conditions
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg p-2 text-center" style={{ background:'#060e19' }}>
                <p style={{ color:'#64748b' }}>Direction</p>
                <p className="font-bold text-white text-sm">{compassLabel(wind.dir)}</p>
                <p style={{ color:'#475569' }}>{wind.dir.toFixed(0)}°</p>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background:'#060e19' }}>
                <p style={{ color:'#64748b' }}>Speed</p>
                <p className="font-bold text-white text-sm">{wind.speed.toFixed(0)} kn</p>
                <p style={{ color:'#475569' }}>Bft {bft.n}</p>
              </div>
              {wind.gust > wind.speed + 3 && (
                <div className="rounded-lg p-2 text-center col-span-2" style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
                  <p style={{ color:'#64748b' }}>Gusting</p>
                  <p className="font-bold text-sm" style={{ color:'#f59e0b' }}>{wind.gust.toFixed(0)} kn</p>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor:'rgba(29,111,164,0.15)', color:'#475569' }}>
              {showWind ? '✦ Particles show wind flow direction' : '○ Wind particles hidden'}
              <br/>
              {showPlumes ? '✦ Plumes trail from each sensor' : '○ Plumes hidden'}
            </div>
          </div>

          {/* Sensor readings */}
          <div className="rounded-xl p-4 flex-1" style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white">Sensor Readings</h3>
              <span className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background:'rgba(29,111,164,0.2)', color:'#60a5fa' }}>
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
                    style={{ background:'#060e19', borderLeft:`3px solid ${col}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white truncate mr-2" title={s.name}>
                        {s.name.replace('Plymouth ','').replace(' Harbour','').replace(' Terminal','')}
                      </span>
                      <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color:col }}>{val}</span>
                    </div>
                    <div className="rounded-full h-1.5 overflow-hidden" style={{ background:'#0a1628' }}>
                      <div style={{ width:`${Math.min(100,(val/limit)*100).toFixed(0)}%`, height:'100%', background:col, borderRadius:9999, transition:'width 0.45s ease' }}/>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs" style={{ color:'#475569' }}>{s.type}</span>
                      <span className="text-xs font-mono" style={{ color:'#475569' }}>{(int*100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="rounded-xl p-4 flex-shrink-0" style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
            <h3 className="text-xs font-semibold text-white mb-2">Level Guide</h3>
            {[{label:'Low',sub:'<45%',color:'#10b981'},{label:'Moderate',sub:'45–75%',color:'#f59e0b'},{label:'High',sub:'>75%',color:'#ef4444'}].map(l => (
              <div key={l.label} className="flex items-center gap-2 mb-1.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background:l.color }}/>
                <span className="text-xs font-medium text-white">{l.label}</span>
                <span className="text-xs" style={{ color:'#64748b' }}>{l.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Playback controls ── */}
      <div className="rounded-xl p-4" style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
        {/* Hour bar */}
        <div className="flex items-end gap-1 mb-4 overflow-x-auto pb-1">
          {HOUR_ENVELOPE.map((env, h) => (
            <button key={h} onClick={() => handleHourChange(h)} title={`${String(h).padStart(2,'0')}:00`}
              className="flex-shrink-0 flex flex-col items-center gap-1" style={{ minWidth:18 }}>
              <div style={{
                width:16, height:Math.max(4,env*32), borderRadius:3,
                background: hour===h ? REPLAY_COLORS[pollutant] : 'rgba(29,111,164,0.35)',
                boxShadow: hour===h ? `0 0 8px ${REPLAY_COLORS[pollutant]}88` : 'none',
                transition:'background 0.2s',
              }}/>
              {h%3===0 && <span style={{ fontSize:9, color:hour===h?REPLAY_COLORS[pollutant]:'#334155' }}>{String(h).padStart(2,'0')}</span>}
            </button>
          ))}
        </div>

        {/* Transport */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setIsPlaying(false); setHour(0); setStep(0); }}
            style={{ color:'#64748b', background:'#060e19', padding:'6px 10px', borderRadius:6, fontSize:14 }}>⏮</button>
          <button onClick={handlePlayPause} style={{
            width:38, height:38, borderRadius:'50%', flexShrink:0,
            background: isPlaying?'#ef4444':'#1d6fa4', color:'#fff', fontSize:16,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 4px 14px ${isPlaying?'#ef444466':'#1d6fa466'}`, border:'none', cursor:'pointer',
          }}>{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={() => { setIsPlaying(false); setHour(23); setStep(STEPS_PER_HOUR-1); }}
            style={{ color:'#64748b', background:'#060e19', padding:'6px 10px', borderRadius:6, fontSize:14 }}>⏭</button>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs font-mono flex-shrink-0" style={{ color:'#64748b', width:36 }}>
              {String(hour).padStart(2,'0')}:00
            </span>
            <input type="range" min={0} max={scrubberMax} value={scrubberVal}
              onChange={e => onScrubberChange(+e.target.value)}
              className="flex-1" style={{ accentColor:REPLAY_COLORS[pollutant], height:4 }}/>
            <span className="text-xs font-mono flex-shrink-0" style={{ color:'#64748b', width:36 }}>
              {String(Math.min(23,hour+1)).padStart(2,'0')}:00
            </span>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-white font-mono">
              {String(hour).padStart(2,'0')}:{String(minute).padStart(2,'0')}
            </p>
            <p className="text-xs" style={{ color:'#475569' }}>Step {step+1}/{STEPS_PER_HOUR}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
