import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  generateDayData, REPLAY_POLLUTANTS, REPLAY_THRESHOLDS, REPLAY_COLORS,
  REPLAY_DATES, readingColor, readingIntensity, STEPS_PER_HOUR,
  beaufort, compassLabel, windReliability,
} from '../data/replayData.js';
import { sensors, pollutantType } from '../data/mockData.js';
import { INCIDENTS, getIncidentsForDate } from '../data/incidentData.js';
import ScheduleInvestigationModal from '../components/ScheduleInvestigationModal.jsx';

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

function hexRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

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
  const pRef     = useRef([]);
  const rafRef   = useRef(null);
  const stateRef = useRef({ wind, stepData, pollutant, showWind, showPlumes });
  useEffect(() => { stateRef.current = { wind, stepData, pollutant, showWind, showPlumes }; });

  useEffect(() => {
    const container = map.getContainer();
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
      const baseSpeed  = wind.speed * 0.14;

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

      if (showPlumes && stepData) {
        sensors.forEach(s => {
          const val       = stepData.sensorReadings[s.id]?.[pollutant] ?? 0;
          const intensity = readingIntensity(val, pollutant);
          if (intensity < 0.05) return;

          const color = readingColor(val, pollutant);
          const rgb   = hexRgb(color);
          const pt = map.latLngToContainerPoint([s.lat, s.lng]);

          const plumeLen  = 35 + intensity * 90 + wind.speed * 2.5;
          const halfAngle = (18 + intensity * 18) * Math.PI / 180;
          const spread    = Math.tan(halfAngle) * plumeLen;
          const tipX = pt.x + vx * plumeLen;
          const tipY = pt.y + vy * plumeLen;
          const px = vy;
          const py = -vx;

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
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map]); // eslint-disable-line

  return null;
}

/* ─── Compass rose ──────────────────────────────────────────────────────────── */
function CompassRose({ windDir, windSpeed }) {
  const arrowRot = (windDir + 180) % 360;
  const bft = beaufort(windSpeed);

  return (
    <div style={{ position:'absolute', bottom:40, right:12, zIndex:1000, pointerEvents:'none' }}>
      <div style={{
        background:'rgba(6,14,25,0.88)', border:'1px solid rgba(29,111,164,0.5)',
        borderRadius:12, padding:'10px 12px', backdropFilter:'blur(8px)',
        display:'flex', flexDirection:'column', alignItems:'center', gap:6,
      }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(29,111,164,0.4)" strokeWidth="1.5"/>
          {[['N',36,10],['S',36,66],['E',66,39],['W',6,39]].map(([l,x,y]) => (
            <text key={l} x={x} y={y} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="Inter,sans-serif">{l}</text>
          ))}
          <g transform={`rotate(${arrowRot}, 36, 36)`}>
            <line x1="36" y1="48" x2="36" y2="22" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
            <polygon points="36,16 31,26 41,26" fill="#60a5fa"/>
            <line x1="36" y1="48" x2="30" y2="56" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.6"/>
            <line x1="36" y1="48" x2="42" y2="56" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.6"/>
          </g>
          <circle cx="36" cy="36" r="3" fill="#1d6fa4"/>
        </svg>
        <div style={{ textAlign:'center', fontFamily:'Inter,sans-serif' }}>
          <p style={{ fontSize:13, fontWeight:700, color:'#fff', margin:0 }}>{compassLabel(windDir)}</p>
          <p style={{ fontSize:11, color:'#60a5fa', margin:0 }}>{windSpeed.toFixed(0)} kn</p>
          <p style={{ fontSize:9, color:'#64748b', margin:'2px 0 0' }}>Bft {bft.n} · {bft.label}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Sensor marker ─────────────────────────────────────────────────────────── */
function SensorMarker({ sensor, value, pollutant, isPlaying, highlighted }) {
  const color  = highlighted ? '#fff' : readingColor(value, pollutant);
  const int    = readingIntensity(value, pollutant);
  const radius = 6 + int * 11;

  return (
    <>
      <CircleMarker
        center={[sensor.lat, sensor.lng]}
        radius={radius + (highlighted ? 14 : 9)}
        pathOptions={{
          color: highlighted ? '#ef4444' : color,
          fillColor: highlighted ? '#ef4444' : color,
          fillOpacity: highlighted ? 0.25 : (isPlaying ? 0.10 + int * 0.10 : 0.06),
          weight: highlighted ? 2.5 : (isPlaying ? 1.5 : 0.5),
          opacity: highlighted ? 0.9 : (isPlaying ? 0.5 : 0.3),
        }}
        pane="shadowPane"
      />
      <CircleMarker
        center={[sensor.lat, sensor.lng]}
        radius={radius}
        pathOptions={{
          color: highlighted ? '#ef4444' : color,
          fillColor: highlighted ? '#ef4444' : color,
          fillOpacity: 0.82 + int * 0.18,
          weight: highlighted ? 3 : 2,
          opacity: 1,
        }}
        pane="markerPane"
      >
        <Popup>
          <div style={{ minWidth:210, fontFamily:'Inter,sans-serif' }}>
            <p style={{ fontWeight:700, fontSize:13, color:'#fff', marginBottom:3 }}>{sensor.name}</p>
            <p style={{ fontSize:11, color:'#64748b', marginBottom:10 }}>{sensor.id} · {sensor.type}</p>
            <div style={{ background:'#060e19', borderRadius:8, padding:'8px 12px' }}>
              <p style={{ color:'#64748b', fontSize:10, marginBottom:2 }}>{pollutant}</p>
              <p style={{ color, fontWeight:700, fontSize:24, margin:0 }}>
                {value}<span style={{ fontSize:12, fontWeight:400 }}> µg/m³</span>
              </p>
              <div style={{ marginTop:8, background:'#0a1628', borderRadius:4, height:6, overflow:'hidden' }}>
                <div style={{ width:`${Math.min(100,int*100).toFixed(0)}%`, height:'100%', background:color, borderRadius:4 }}/>
              </div>
              <p style={{ fontSize:10, color:'#64748b', marginTop:4 }}>
                {(int*100).toFixed(0)}% of limit ({REPLAY_THRESHOLDS[pollutant]} µg/m³)
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

  // Incident investigation state
  const [activeIncidentId, setActiveIncidentId]       = useState(null);
  const [dispatchNote, setDispatchNote]               = useState('');
  const [investigateExporting, setInvestigateExporting] = useState(false);
  const [scheduleIncident, setScheduleIncident]       = useState(null);
  const [scheduleToast, setScheduleToast]             = useState(false);

  function handleScheduleSuccess() {
    setScheduleIncident(null);
    setScheduleToast(true);
    setTimeout(() => setScheduleToast(false), 4000);
  }

  const dayData  = getDayData(selectedDate);
  const stepData = dayData[hour]?.[step];
  const wind     = stepData?.wind ?? { dir: 225, speed: 15, gust: 17 };
  const minute   = step * 5;
  const timestamp = formatTimestamp(selectedDate, hour, minute);

  const dateIncidents = getIncidentsForDate(selectedDate);
  const activeIncident = dateIncidents.find(i => i.id === activeIncidentId) ?? null;

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

  function handleAlertClick(inc) {
    setIsPlaying(false);
    setSelectedDate(inc.date);
    setHour(inc.hour);
    setStep(inc.step);
    setActiveIncidentId(inc.id);
    setPollutant(inc.pollutant === 'PM2.5' ? 'PM2.5' : inc.pollutant);
  }

  function handleClearIncident() {
    setActiveIncidentId(null);
    setDispatchNote('');
  }

  async function handleInvestigatePDF() {
    const inc = INCIDENTS.find(i => i.id === activeIncidentId);
    if (!inc) return;
    setInvestigateExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
      const W = 210, M = 18;

      // Header
      pdf.setFillColor(6, 14, 25);
      pdf.rect(0, 0, W, 30, 'F');
      pdf.setFillColor(29, 111, 164);
      pdf.rect(0, 0, 4, 30, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(255, 255, 255);
      pdf.text('EMMA — Incident Investigation Report', M, 13);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Plymouth Port Authority · Class A Operator', M, 21);
      pdf.text(`Generated: ${new Date().toLocaleString('en-GB')}`, W - M, 21, { align: 'right' });

      let y = 40;

      // Severity badge + ID
      const sevBg = inc.severity === 'high' ? [239, 68, 68] : [245, 158, 11];
      pdf.setFillColor(...sevBg);
      pdf.roundedRect(M, y - 5, 30, 9, 2, 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text(inc.severity.toUpperCase(), M + 15, y + 0.5, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(29, 111, 164);
      pdf.text(inc.id, M + 36, y + 0.5);

      y += 12;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(inc.title, M, y);

      y += 9;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const d = new Date(`${inc.date}T00:00:00`);
      const ts = `${String(inc.hour).padStart(2,'0')}:${String(inc.step * 5).padStart(2,'0')} — ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      pdf.text(`Timestamp: ${ts}`, M, y);
      y += 6;
      pdf.text(`Location: ${inc.sensorName} (Sensor ${inc.sensor}) · ${inc.lat.toFixed(4)}°N, ${Math.abs(inc.lng).toFixed(4)}°W`, M, y);

      // Pollutant reading block
      y += 12;
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(M, y, W - M * 2, 26, 3, 3, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Pollutant Reading', M + 5, y + 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const threshold = REPLAY_THRESHOLDS[inc.pollutant] ?? 200;
      const pct = ((inc.reading / threshold) * 100).toFixed(0);
      pdf.text(`${inc.pollutant}: ${inc.reading} ${inc.unit}`, M + 5, y + 15);
      pdf.text(`Regulatory limit: ${threshold} ${inc.unit} · At ${pct}% of limit`, M + 5, y + 22);

      // Wind conditions
      y += 36;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Wind Conditions', M, y);
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const bft = beaufort(inc.windSpeed);
      pdf.text(
        `${compassLabel(inc.windDir)} (${inc.windDir}°) · ${inc.windSpeed} knots · Beaufort ${bft.n} — ${bft.label}`,
        M, y
      );
      y += 5;
      pdf.text('Wind direction is consistent with plume transport from identified source to sensor location.', M, y);

      // Likely source block
      y += 13;
      pdf.setFillColor(6, 14, 25);
      pdf.roundedRect(M, y, W - M * 2, 38, 3, 3, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(96, 165, 250);
      pdf.text('Likely Source', M + 5, y + 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Vessel: ${inc.vessel.name}`, M + 5, y + 16);
      pdf.text(`Type: ${inc.vessel.type} · Engine: ${inc.vessel.engineType} · IMO: ${inc.vessel.imo}`, M + 5, y + 23);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(16, 185, 129);
      pdf.text(`Confidence: ${inc.confidence}%`, M + 5, y + 31);

      // Description
      y += 50;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Incident Description', M, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const descLines = pdf.splitTextToSize(inc.description, W - M * 2);
      pdf.text(descLines, M, y);
      y += descLines.length * 5 + 6;

      // Dispatch note
      if (dispatchNote.trim()) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59);
        pdf.text('Harbour Master Dispatch Note', M, y);
        y += 7;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        const noteLines = pdf.splitTextToSize(dispatchNote, W - M * 2);
        pdf.text(noteLines, M, y);
        y += noteLines.length * 5 + 6;
      }

      // Signature block
      y = Math.max(y + 10, 230);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(M, y, M + 70, y);
      pdf.line(W - M - 70, y, W - M, y);
      y += 5;
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Harbour Master Signature', M, y);
      pdf.text('Date & Stamp', W - M - 70, y);

      // Footer
      pdf.setFillColor(6, 14, 25);
      pdf.rect(0, 283, W, 14, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.text(
        'EMMA Incident Investigation Report · Plymouth Port Authority · CONFIDENTIAL · Not for public release',
        W / 2, 290, { align: 'center' }
      );

      pdf.save(`EMMA_${inc.id}_${inc.date}.pdf`);
    } catch (err) {
      console.error(err);
    }
    setInvestigateExporting(false);
  }

  const scrubberMax = 24 * STEPS_PER_HOUR - 1;
  const scrubberVal = hour * STEPS_PER_HOUR + step;
  function onScrubberChange(v) {
    setIsPlaying(false);
    setHour(Math.floor(v / STEPS_PER_HOUR));
    setStep(v % STEPS_PER_HOUR);
  }

  const bft         = beaufort(wind.speed);
  const reliability = windReliability(wind.dir);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Emissions Replay</h1>
          <p className="text-sm" style={{ color:'#64748b' }}>Animated intraday pollution & wind · Plymouth Harbour</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value);
              setHour(8); setStep(0); setIsPlaying(false);
              setActiveIncidentId(null); setDispatchNote('');
            }}
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background:'#0a1628', color:'#e2e8f0', border:'1px solid rgba(29,111,164,0.4)' }}>
            {REPLAY_DATES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>

          <div className="flex flex-wrap gap-1">
            {REPLAY_POLLUTANTS.map(p => {
              const pType = pollutantType[p];
              const isActive = pollutant === p;
              return (
                <button key={p} onClick={() => setPollutant(p)}
                  className="px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1 rounded-lg"
                  style={{
                    background: isActive ? REPLAY_COLORS[p] : '#0a1628',
                    color: isActive ? '#fff' : '#64748b',
                    border: `1px ${pType === 'modelled' ? 'dashed' : 'solid'} ${isActive ? REPLAY_COLORS[p] : 'rgba(29,111,164,0.4)'}`,
                  }}>
                  {p === 'NOx' ? 'NOx*' : p}
                  {pType === 'modelled' && (
                    <span style={{ fontSize:8, fontWeight:700, background:'rgba(96,165,250,0.25)', color:'#60a5fa', padding:'0 3px', borderRadius:2 }}>M</span>
                  )}
                </button>
              );
            })}
          </div>

          <ToggleBtn label="Wind" active={showWind} onClick={() => setShowWind(v => !v)} activeColor="#60a5fa" />
          <ToggleBtn label="Plumes" active={showPlumes} onClick={() => setShowPlumes(v => !v)} activeColor={REPLAY_COLORS[pollutant]} />

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color:'#64748b' }}>Speed</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border:'1px solid rgba(29,111,164,0.4)' }}>
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

      {/* ── Alerts Banner ── */}
      {dateIncidents.length > 0 && (
        <div style={{
          background: activeIncidentId ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.07)',
          border: `1px solid ${activeIncidentId ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.3)'}`,
          borderRadius: 10, padding: '10px 14px',
        }}>
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ fontSize:11, fontWeight:700, color:'#ef4444', flexShrink:0 }}>
              ⚠ {dateIncidents.length} Incident Alert{dateIncidents.length > 1 ? 's' : ''}
            </span>
            {dateIncidents.map(inc => {
              const isActive = activeIncidentId === inc.id;
              const sevColor = inc.severity === 'high' ? '#ef4444' : '#f59e0b';
              return (
                <span key={inc.id} style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                  <button onClick={() => handleAlertClick(inc)} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: isActive ? sevColor : `rgba(${inc.severity === 'high' ? '239,68,68' : '245,158,11'},0.12)`,
                    color: isActive ? '#fff' : sevColor,
                    border: `1px solid ${sevColor}55`,
                    transition: 'all 0.15s',
                  }}>
                    [{inc.id}] {inc.sensorName.replace('Plymouth ','').replace(' Terminal','').replace(' Jetty','').replace(' Naval Basin','')} ·{' '}
                    {String(inc.hour).padStart(2,'0')}:{String(inc.step * 5).padStart(2,'0')}
                  </button>
                  <button onClick={() => setScheduleIncident(inc)} style={{
                    padding: '4px 7px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.35)',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Schedule
                  </button>
                </span>
              );
            })}
            {activeIncidentId && (
              <button onClick={handleClearIncident} style={{
                fontSize:10, color:'#64748b', background:'transparent',
                border:'1px solid rgba(100,116,139,0.3)', borderRadius:5,
                padding:'3px 8px', cursor:'pointer',
              }}>
                ✕ Clear investigation
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Map + side panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Map */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden relative"
          style={{ border:'1px solid rgba(29,111,164,0.3)', height: MAP_HEIGHT }}>

          {/* Timestamp badge + reliability indicator */}
          <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', zIndex:1000, pointerEvents:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{
              padding:'8px 18px', borderRadius:10, background:'rgba(6,14,25,0.90)',
              color:'#fff', fontWeight:700, fontSize:14, letterSpacing:'0.03em',
              border:`1px solid ${activeIncidentId ? 'rgba(239,68,68,0.6)' : 'rgba(29,111,164,0.55)'}`,
              boxShadow:'0 4px 24px rgba(0,0,0,0.55)', backdropFilter:'blur(8px)', fontFamily:'Inter,sans-serif',
            }}>
              {activeIncidentId && <span style={{ color:'#ef4444', marginRight:8 }}>⚠</span>}
              {timestamp}
            </div>
            <div style={{
              display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:7,
              background:'rgba(6,14,25,0.85)', backdropFilter:'blur(6px)',
              border:`1px solid ${reliability.color}55`, fontFamily:'Inter,sans-serif',
            }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:reliability.color, flexShrink:0 }}/>
              <span style={{ fontSize:10, fontWeight:600, color:reliability.color }}>{reliability.label}</span>
            </div>
          </div>

          {/* Wind info pill */}
          <div style={{ position:'absolute', top:12, left:12, zIndex:1000, pointerEvents:'none' }}>
            <div style={{
              display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:8,
              background:'rgba(6,14,25,0.88)', border:'1px solid rgba(96,165,250,0.4)',
              backdropFilter:'blur(6px)', fontFamily:'Inter,sans-serif',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
              </svg>
              <div>
                <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{compassLabel(wind.dir)} {wind.speed.toFixed(0)} kn</span>
                <span style={{ fontSize:10, color:'#64748b', marginLeft:6 }}>Bft {bft.n} · {bft.label}</span>
                {wind.gust > wind.speed + 3 && (
                  <span style={{ fontSize:10, color:'#f59e0b', marginLeft:6 }}>gusting {wind.gust.toFixed(0)} kn</span>
                )}
              </div>
            </div>
          </div>

          {/* REC / INCIDENT badge */}
          {(isPlaying || activeIncidentId) && (
            <div style={{
              position:'absolute', top:12, right:12, zIndex:1000, pointerEvents:'none',
              display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8,
              background: activeIncidentId ? 'rgba(239,68,68,0.92)' : 'rgba(239,68,68,0.92)',
              color:'#fff', fontSize:11, fontWeight:700, fontFamily:'Inter,sans-serif',
            }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff', display:'inline-block' }}/>
              {activeIncidentId ? 'INCIDENT' : 'REC'}
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
                pollutant={pollutant}
                isPlaying={isPlaying}
                highlighted={activeIncident?.sensor === s.id}
              />
            ))}
          </MapContainer>

          <CompassRose windDir={wind.dir} windSpeed={wind.speed} />
        </div>

        {/* ── Side panel ── */}
        <div className="flex flex-col gap-3" style={{ height: MAP_HEIGHT, overflowY: 'auto' }}>

          {activeIncident ? (
            /* ── INCIDENT MODE ── */
            <>
              {/* Incident summary */}
              <div className="rounded-xl p-4 flex-shrink-0" style={{
                background:'#0a1628',
                border:'1px solid rgba(239,68,68,0.4)',
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:4,
                    background: activeIncident.severity === 'high' ? '#ef4444' : '#f59e0b', color:'#fff' }}>
                    {activeIncident.severity.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono" style={{ color:'#60a5fa' }}>{activeIncident.id}</span>
                </div>
                <p className="text-xs font-semibold text-white mb-2" style={{ lineHeight:1.4 }}>{activeIncident.title}</p>
                <div className="rounded-lg p-2" style={{ background:'#060e19' }}>
                  <p className="text-xs" style={{ color:'#64748b' }}>{activeIncident.sensorName}</p>
                  <p className="text-sm font-bold font-mono mt-1"
                    style={{ color: activeIncident.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                    {activeIncident.pollutant}: {activeIncident.reading} {activeIncident.unit}
                  </p>
                  <p className="text-xs mt-1" style={{ color:'#475569' }}>
                    {String(activeIncident.hour).padStart(2,'0')}:{String(activeIncident.step * 5).padStart(2,'0')} · {activeIncident.date}
                  </p>
                </div>
              </div>

              {/* Likely Source */}
              <div className="rounded-xl p-4 flex-shrink-0"
                style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.3)' }}>
                <h3 className="text-xs font-bold text-white mb-3">Likely Source</h3>

                <div className="rounded-lg p-3 mb-3" style={{ background:'#060e19', borderLeft:'3px solid #1d6fa4' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/>
                      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.5.8 4.3 1.62 6"/>
                      <path d="M12 6V2"/><path d="M8 2h8"/>
                    </svg>
                    <span className="text-xs font-semibold text-white">{activeIncident.vessel.name}</span>
                  </div>
                  <p className="text-xs" style={{ color:'#64748b' }}>{activeIncident.vessel.type} · {activeIncident.vessel.engineType}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color:'#475569' }}>IMO {activeIncident.vessel.imo}</p>
                </div>

                {/* Wind corroboration */}
                <div className="rounded-lg p-2 mb-3" style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color:'#60a5fa' }}>Wind Corroboration</p>
                  <p className="text-xs" style={{ color:'#94a3b8' }}>
                    {compassLabel(activeIncident.windDir)} {activeIncident.windSpeed} kn — plume direction{' '}
                    <span style={{ color:'#10b981' }}>consistent</span> with sensor location
                  </p>
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color:'#64748b' }}>Confidence</span>
                    <span className="text-xs font-bold" style={{ color:'#10b981' }}>{activeIncident.confidence}%</span>
                  </div>
                  <div className="rounded-full h-2" style={{ background:'#060e19' }}>
                    <div style={{
                      width:`${activeIncident.confidence}%`, height:'100%', borderRadius:9999,
                      background:`linear-gradient(90deg, #1d6fa4, ${activeIncident.confidence >= 80 ? '#10b981' : '#f59e0b'})`,
                    }}/>
                  </div>
                </div>
              </div>

              {/* Dispatch Note + Investigate */}
              <div className="rounded-xl p-4 flex-1"
                style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
                <h3 className="text-xs font-bold text-white mb-2">Harbour Master Dispatch Note</h3>
                <textarea
                  value={dispatchNote}
                  onChange={e => setDispatchNote(e.target.value)}
                  placeholder="Log your response to this incident…"
                  rows={4}
                  style={{
                    width:'100%', background:'#060e19', color:'#e2e8f0',
                    border:'1px solid rgba(29,111,164,0.3)', borderRadius:6,
                    padding:'8px', fontSize:11, resize:'vertical',
                    fontFamily:'Inter,sans-serif', outline:'none',
                  }}
                />
                <button
                  onClick={handleInvestigatePDF}
                  disabled={investigateExporting}
                  style={{
                    marginTop:8, width:'100%', padding:'9px',
                    borderRadius:8, background: investigateExporting ? '#155880' : '#1d6fa4',
                    color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                    boxShadow:'0 4px 12px rgba(29,111,164,0.4)',
                  }}>
                  {investigateExporting ? '⏳ Generating…' : '📋 Investigate — Export PDF'}
                </button>
                <button
                  onClick={() => setScheduleIncident(activeIncident)}
                  style={{
                    marginTop:6, width:'100%', padding:'9px', borderRadius:8,
                    background:'rgba(245,158,11,0.15)', color:'#f59e0b',
                    fontSize:12, fontWeight:700, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    border:'1px solid rgba(245,158,11,0.35)',
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Schedule Investigation
                </button>
                <button onClick={handleClearIncident} style={{
                  marginTop:6, width:'100%', padding:'7px', borderRadius:8,
                  background:'transparent', color:'#64748b', fontSize:11,
                  cursor:'pointer', border:'1px solid rgba(100,116,139,0.25)',
                }}>
                  Clear Investigation
                </button>
              </div>
            </>
          ) : (
            /* ── NORMAL MODE ── */
            <>
              {/* Wind card */}
              <div className="rounded-xl p-4 flex-shrink-0"
                style={{ background:'#0a1628', border:'1px solid rgba(96,165,250,0.25)' }}>
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
                    <div className="rounded-lg p-2 text-center col-span-2"
                      style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
                      <p style={{ color:'#64748b' }}>Gusting</p>
                      <p className="font-bold text-sm" style={{ color:'#f59e0b' }}>{wind.gust.toFixed(0)} kn</p>
                    </div>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor:'rgba(29,111,164,0.15)', color:'#475569' }}>
                  {showWind ? '✦ Particles show wind flow' : '○ Wind particles hidden'}<br/>
                  {showPlumes ? '✦ Plumes trail from sensors' : '○ Plumes hidden'}
                </div>
              </div>

              {/* Sensor readings */}
              <div className="rounded-xl p-4 flex-1"
                style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
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
              <div className="rounded-xl p-4 flex-shrink-0"
                style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
                <h3 className="text-xs font-semibold text-white mb-2">Level Guide</h3>
                {[
                  {label:'Low',sub:'<45%',color:'#10b981'},
                  {label:'Moderate',sub:'45–75%',color:'#f59e0b'},
                  {label:'High',sub:'>75%',color:'#ef4444'},
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background:l.color }}/>
                    <span className="text-xs font-medium text-white">{l.label}</span>
                    <span className="text-xs" style={{ color:'#64748b' }}>{l.sub}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Playback controls ── */}
      <div className="rounded-xl p-4" style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
        {/* Hour bar with incident markers */}
        <div className="flex items-end gap-1 mb-4 overflow-x-auto pb-1 relative">
          {HOUR_ENVELOPE.map((env, h) => {
            const hasIncident = dateIncidents.some(i => i.hour === h);
            return (
              <button key={h} onClick={() => handleHourChange(h)} title={`${String(h).padStart(2,'0')}:00`}
                className="flex-shrink-0 flex flex-col items-center gap-1 relative" style={{ minWidth:18 }}>
                {hasIncident && (
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#ef4444',
                    position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)' }}/>
                )}
                <div style={{
                  width:16, height:Math.max(4,env*32), borderRadius:3,
                  background: hour===h
                    ? (hasIncident ? '#ef4444' : REPLAY_COLORS[pollutant])
                    : (hasIncident ? 'rgba(239,68,68,0.35)' : 'rgba(29,111,164,0.35)'),
                  boxShadow: hour===h ? `0 0 8px ${hasIncident ? '#ef444488' : REPLAY_COLORS[pollutant]+'88'}` : 'none',
                  transition:'background 0.2s',
                }}/>
                {h%3===0 && (
                  <span style={{ fontSize:9, color: hour===h ? REPLAY_COLORS[pollutant] : '#334155' }}>
                    {String(h).padStart(2,'0')}
                  </span>
                )}
              </button>
            );
          })}
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

      {/* Schedule Investigation modal */}
      {scheduleIncident && (
        <ScheduleInvestigationModal
          incident={scheduleIncident}
          onClose={() => setScheduleIncident(null)}
          onSuccess={handleScheduleSuccess}
        />
      )}

      {/* Success toast */}
      {scheduleToast && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9999,
          background:'#10b981', color:'#fff', borderRadius:10,
          padding:'12px 20px', fontSize:13, fontWeight:600,
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', gap:8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Investigation scheduled — added to Google Calendar
        </div>
      )}
    </div>
  );
}
