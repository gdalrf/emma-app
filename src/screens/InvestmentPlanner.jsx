import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  INFRA_TYPES, PLACEMENT_ZONES, BASELINE_HEAT, PORT_BASELINE, calcTotalImpact,
} from '../data/investmentData';

const PLYMOUTH_CENTER = [50.3656, -4.1423];
const MAP_HEIGHT = 500;

/* ─── Baseline heatmap overlay ──────────────────────────────────────────────── */
function BaselineHeatLayer({ show }) {
  const map     = useMap();
  const heatRef = useRef(null);

  useEffect(() => {
    if (show) {
      if (!heatRef.current) {
        heatRef.current = L.heatLayer(BASELINE_HEAT, {
          radius: 50, blur: 35, maxZoom: 15, max: 1.0, minOpacity: 0.18,
          gradient: { 0.0:'#10b981', 0.4:'#f59e0b', 0.8:'#ef4444', 1.0:'#7f1d1d' },
        }).addTo(map);
      }
    } else {
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
        heatRef.current = null;
      }
    }
  }, [show]); // eslint-disable-line

  useEffect(() => () => { heatRef.current && map.removeLayer(heatRef.current); }, []); // eslint-disable-line
  return null;
}

/* ─── Map click handler ─────────────────────────────────────────────────────── */
function MapClickHandler({ pendingTypeId, onPlace }) {
  useMapEvents({
    click: (e) => {
      if (pendingTypeId) {
        onPlace(pendingTypeId, e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

/* ─── Cursor overlay (crosshair when type is selected) ─────────────────────── */
function CursorOverlay({ active }) {
  const map = useMap();
  useEffect(() => {
    const c = map.getContainer();
    c.style.cursor = active ? 'crosshair' : '';
  }, [active, map]);
  return null;
}

/* ─── Find nearest zone name from lat/lng ───────────────────────────────────── */
function nearestZoneName(lat, lng) {
  let minDist = Infinity, nearest = null;
  PLACEMENT_ZONES.forEach(z => {
    const d = Math.hypot(z.lat - lat, z.lng - lng);
    if (d < minDist) { minDist = d; nearest = z.name; }
  });
  return nearest ?? 'Custom location';
}

/* ─── Main screen ───────────────────────────────────────────────────────────── */
export default function InvestmentPlanner() {
  const [placedItems, setPlacedItems]     = useState([]);
  const [pendingTypeId, setPendingTypeId] = useState(null);
  const [showHeat, setShowHeat]           = useState(true);
  const [bizCaseExp, setBizCaseExp]       = useState(false);

  const impact = calcTotalImpact(placedItems);

  function handlePlace(typeId, lat, lng) {
    setPlacedItems(items => [
      ...items,
      { id: `item-${Date.now()}`, typeId, lat, lng, zoneName: nearestZoneName(lat, lng) },
    ]);
    setPendingTypeId(null);
  }

  function handleRemove(itemId) {
    setPlacedItems(items => items.filter(i => i.id !== itemId));
  }

  function handleSelectType(typeId) {
    setPendingTypeId(prev => prev === typeId ? null : typeId);
  }

  async function handleBizCasePDF() {
    setBizCaseExp(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
      const W = 210, M = 18;

      // Header
      pdf.setFillColor(6, 14, 25);
      pdf.rect(0, 0, W, 32, 'F');
      pdf.setFillColor(0, 194, 168);
      pdf.rect(0, 0, 4, 32, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text('EMMA — Infrastructure Investment Business Case', M, 13);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Plymouth Port Authority · Clean Maritime & Air Quality Programme', M, 22);
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}`, W - M, 22, { align:'right' });

      let y = 42;

      // Executive Summary KPIs
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Executive Summary', M, y);
      y += 8;

      const kpis = [
        { label: 'Total Investment', value: `£${impact.totalCost.toFixed(1)}M` },
        { label: 'Annual Saving', value: `£${impact.totalAnnualSaving.toFixed(2)}M` },
        { label: 'Avg Payback', value: `${impact.avgPayback} yrs` },
        { label: 'Strategic Score', value: `${impact.score}/100` },
      ];

      const kW = (W - M * 2) / 4;
      kpis.forEach((k, i) => {
        const x = M + i * kW;
        pdf.setFillColor(10, 22, 40);
        pdf.roundedRect(x, y, kW - 3, 18, 2, 2, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(k.label, x + 4, y + 6);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(0, 194, 168);
        pdf.text(k.value, x + 4, y + 14);
      });
      y += 26;

      // Intro paragraph
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      const intro = `This business case sets out the strategic rationale and financial appraisal for ${placedItems.length} proposed infrastructure investment${placedItems.length !== 1 ? 's' : ''} at Plymouth Harbour. The programme is designed to reduce port-area emissions in line with Plymouth City Council's Clean Air Plan 2030 and the UK Government's Clean Maritime Plan.`;
      pdf.text(pdf.splitTextToSize(intro, W - M * 2), M, y);
      y += 20;

      // Proposed infrastructure table
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text('1. Proposed Infrastructure', M, y);
      y += 8;

      if (placedItems.length === 0) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text('No infrastructure items placed. Use the Investment Planner map to add items.', M, y);
        y += 10;
      } else {
        // Table header
        pdf.setFillColor(10, 22, 40);
        pdf.rect(M, y, W - M * 2, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        const tCols = [M + 4, M + 60, M + 105, M + 135, M + 158];
        ['Infrastructure Type','Location','Cost (£M)','Payback (yrs)','Primary Benefit'].forEach((h, j) => pdf.text(h, tCols[j], y + 5));
        y += 8;

        placedItems.forEach((item, i) => {
          const type = INFRA_TYPES.find(t => t.id === item.typeId);
          if (!type) return;
          pdf.setFillColor(i % 2 === 0 ? 241 : 248, i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 249 : 252);
          pdf.rect(M, y, W - M * 2, 7, 'F');
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(30, 41, 59);
          pdf.text(type.shortName, tCols[0], y + 5);
          pdf.setTextColor(71, 85, 105);
          pdf.text(item.zoneName.substring(0, 25), tCols[1], y + 5);
          pdf.text(String(type.costM.toFixed(1)), tCols[2], y + 5);
          pdf.text(String(type.paybackYears), tCols[3], y + 5);
          pdf.setTextColor(16, 185, 129);
          pdf.text(type.primaryPollutant ? `${type.primaryPollutant} −${type.reductions[type.primaryPollutant]}%` : 'Data quality', tCols[4], y + 5);
          y += 7;
        });
        y += 4;
      }

      // Pollutant reductions
      y += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text('2. Projected Emission Reductions (Combined Programme)', M, y);
      y += 8;

      const pollutantsList = ['NOx', 'NO2', 'PM25', 'CO2', 'SOx'];
      pdf.setFillColor(10, 22, 40);
      pdf.rect(M, y, W - M * 2, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const rCols = [M + 4, M + 40, M + 80, M + 120];
      ['Pollutant', 'Baseline (t/yr)', 'Reduction (%)', 'Projected (t/yr)'].forEach((h, j) => pdf.text(h, rCols[j], y + 5));
      y += 8;

      pollutantsList.forEach((p, i) => {
        const baseline = PORT_BASELINE[p]?.shipping ?? 0;
        const pctRed   = impact.reductions[p] ?? 0;
        const projected = Math.round(baseline * (1 - pctRed / 100));
        pdf.setFillColor(i % 2 === 0 ? 241 : 248, i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 249 : 252);
        pdf.rect(M, y, W - M * 2, 7, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text(p, rCols[0], y + 5);
        pdf.setTextColor(71, 85, 105);
        pdf.text(baseline.toLocaleString(), rCols[1], y + 5);
        pdf.setTextColor(pctRed > 0 ? 16 : 100, pctRed > 0 ? 185 : 116, pctRed > 0 ? 129 : 139);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${pctRed > 0 ? '−' : ''}${pctRed}%`, rCols[2], y + 5);
        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'normal');
        pdf.text(projected.toLocaleString(), rCols[3], y + 5);
        y += 7;
      });

      // Financial projection
      y += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text('3. Financial Projection (10-Year)', M, y);
      y += 8;

      pdf.setFillColor(10, 22, 40);
      pdf.rect(M, y, W - M * 2, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const fCols = [M + 4, M + 45, M + 90, M + 135];
      ['Year', 'Annual Saving (£M)', 'Cumulative Saving (£M)', 'Net Position (£M)'].forEach((h, j) => pdf.text(h, fCols[j], y + 5));
      y += 8;

      for (let yr = 1; yr <= 10; yr++) {
        const cumSaving = impact.totalAnnualSaving * yr;
        const netPos    = cumSaving - impact.totalCost;
        pdf.setFillColor(yr % 2 === 0 ? 241 : 248, yr % 2 === 0 ? 245 : 250, yr % 2 === 0 ? 249 : 252);
        pdf.rect(M, y, W - M * 2, 7, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text(`Year ${yr}`, fCols[0], y + 5);
        pdf.text(impact.totalAnnualSaving.toFixed(2), fCols[1], y + 5);
        pdf.text(cumSaving.toFixed(2), fCols[2], y + 5);
        pdf.setTextColor(netPos >= 0 ? 16 : 239, netPos >= 0 ? 185 : 68, netPos >= 0 ? 129 : 68);
        pdf.setFont('helvetica', 'bold');
        pdf.text((netPos >= 0 ? '+' : '') + netPos.toFixed(2), fCols[3], y + 5);
        y += 7;
      }

      // Footer
      pdf.setFillColor(6, 14, 25);
      pdf.rect(0, 283, W, 14, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.text(
        'EMMA Investment Business Case · Plymouth Port Authority · For funding submission use · EMMA v2.4.1',
        W / 2, 290, { align:'center' }
      );

      pdf.save(`EMMA_BusinessCase_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) { console.error(err); }
    setBizCaseExp(false);
  }

  const pendingType = INFRA_TYPES.find(t => t.id === pendingTypeId) ?? null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Investment Planner</h1>
          <p className="text-sm" style={{ color:'#64748b' }}>Model clean infrastructure scenarios · Plymouth Harbour</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowHeat(v => !v)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
            style={{
              background: showHeat ? 'rgba(239,68,68,0.2)' : '#0a1628',
              color: showHeat ? '#ef4444' : '#64748b',
              border: `1px solid ${showHeat ? 'rgba(239,68,68,0.4)' : 'rgba(29,111,164,0.4)'}`,
            }}>
            {showHeat ? '● ' : '○ '}Baseline Heat
          </button>
          <button
            onClick={handleBizCasePDF}
            disabled={bizCaseExp}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition"
            style={{
              background: bizCaseExp ? '#0a4d3a' : 'rgba(0,194,168,0.2)',
              border: '1px solid rgba(0,194,168,0.4)',
              color: '#00c2a8',
            }}>
            {bizCaseExp ? '⏳ Generating…' : '📊 Build Business Case PDF'}
          </button>
        </div>
      </div>

      {/* ── KPI summary row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryKPI
          label="Total Investment"
          value={placedItems.length ? `£${impact.totalCost.toFixed(1)}M` : '—'}
          sub={placedItems.length ? `${placedItems.length} item${placedItems.length > 1 ? 's' : ''}` : 'No items placed'}
          color="#00c2a8"
        />
        <SummaryKPI
          label="NOx Reduction"
          value={placedItems.length ? `${impact.reductions.NOx}%` : '—'}
          sub={placedItems.length ? `from shipping baseline` : 'Place items on map'}
          color="#f59e0b"
        />
        <SummaryKPI
          label="CO₂ Reduction"
          value={placedItems.length ? `${impact.reductions.CO2}%` : '—'}
          sub={placedItems.length ? `annual shipping CO₂` : 'Place items on map'}
          color="#10b981"
        />
        <SummaryKPI
          label="Avg Payback"
          value={placedItems.length ? `${impact.avgPayback} yrs` : '—'}
          sub={placedItems.length ? `Strategic score: ${impact.score}/100` : 'Place items on map'}
          color="#8b5cf6"
        />
      </div>

      {/* ── Selection hint ── */}
      {pendingType && (
        <div style={{
          background: `rgba(${hexToRgb(pendingType.color)},0.12)`,
          border: `1px solid ${pendingType.color}55`,
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>{pendingType.icon}</span>
          <div>
            <p className="text-xs font-bold text-white">
              {pendingType.name} selected — click anywhere on the map to place
            </p>
            <p className="text-xs" style={{ color:'#64748b' }}>
              Cost £{pendingType.costM}M · Payback {pendingType.paybackYears} yrs · {pendingType.category}
            </p>
          </div>
          <button onClick={() => setPendingTypeId(null)} style={{
            marginLeft:'auto', fontSize:11, color:'#64748b', background:'transparent',
            border:'1px solid rgba(100,116,139,0.3)', borderRadius:5, padding:'3px 8px', cursor:'pointer',
          }}>Cancel</button>
        </div>
      )}

      {/* ── Map + right panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Map */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden relative"
          style={{ border:'1px solid rgba(29,111,164,0.3)', height: MAP_HEIGHT }}>

          {/* Map legend overlay */}
          <div style={{ position:'absolute', bottom:12, left:12, zIndex:1000, pointerEvents:'none' }}>
            <div style={{
              background:'rgba(6,14,25,0.88)', border:'1px solid rgba(29,111,164,0.4)',
              borderRadius:8, padding:'8px 12px', backdropFilter:'blur(6px)',
            }}>
              <p style={{ fontSize:9, fontWeight:700, color:'#64748b', marginBottom:6, letterSpacing:'0.08em' }}>
                INFRASTRUCTURE
              </p>
              {INFRA_TYPES.map(t => (
                <div key={t.id} className="flex items-center gap-2 mb-1">
                  <span style={{ width:10, height:10, borderRadius:'50%', background:t.color, display:'inline-block', flexShrink:0 }}/>
                  <span style={{ fontSize:9, color:'#94a3b8' }}>{t.shortName}</span>
                </div>
              ))}
              {showHeat && (
                <div className="mt-2 pt-2" style={{ borderTop:'1px solid rgba(29,111,164,0.2)' }}>
                  <p style={{ fontSize:9, color:'#64748b' }}>
                    <span style={{ color:'#10b981' }}>■</span> Low{' '}
                    <span style={{ color:'#f59e0b' }}>■</span> Med{' '}
                    <span style={{ color:'#ef4444' }}>■</span> High · Baseline NOx
                  </p>
                </div>
              )}
            </div>
          </div>

          <MapContainer center={PLYMOUTH_CENTER} zoom={13} style={{ width:'100%', height:MAP_HEIGHT }} zoomControl>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
            <BaselineHeatLayer show={showHeat} />
            <MapClickHandler pendingTypeId={pendingTypeId} onPlace={handlePlace} />
            <CursorOverlay active={!!pendingTypeId} />

            {/* Placed infrastructure markers */}
            {placedItems.map(item => {
              const type = INFRA_TYPES.find(t => t.id === item.typeId);
              if (!type) return null;
              const noxRed = type.reductions.NOx ?? 0;
              return (
                <CircleMarker
                  key={item.id}
                  center={[item.lat, item.lng]}
                  radius={16}
                  pathOptions={{
                    color: type.color,
                    fillColor: type.color,
                    fillOpacity: 0.30,
                    weight: 2.5,
                    opacity: 0.9,
                  }}
                  pane="markerPane"
                >
                  <Popup>
                    <div style={{ minWidth:220, fontFamily:'Inter,sans-serif' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize:18 }}>{type.icon}</span>
                        <div>
                          <p style={{ fontWeight:700, fontSize:13, color:'#fff', margin:0 }}>{type.name}</p>
                          <p style={{ fontSize:10, color:'#64748b', margin:0 }}>{item.zoneName}</p>
                        </div>
                      </div>
                      <div style={{ background:'#060e19', borderRadius:8, padding:'8px 10px', marginBottom:8 }}>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p style={{ color:'#64748b' }}>Cost</p>
                            <p style={{ color: type.color, fontWeight:700 }}>£{type.costM}M</p>
                          </div>
                          <div>
                            <p style={{ color:'#64748b' }}>Payback</p>
                            <p style={{ color:'#fff', fontWeight:700 }}>{type.paybackYears} yrs</p>
                          </div>
                          <div>
                            <p style={{ color:'#64748b' }}>NOx −</p>
                            <p style={{ color:'#10b981', fontWeight:700 }}>{noxRed}%</p>
                          </div>
                          <div>
                            <p style={{ color:'#64748b' }}>CO₂ −</p>
                            <p style={{ color:'#10b981', fontWeight:700 }}>{type.reductions.CO2}%</p>
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize:10, color:'#94a3b8', marginBottom:6 }}>{type.description}</p>
                      <button
                        onClick={() => handleRemove(item.id)}
                        style={{ width:'100%', padding:'6px', borderRadius:6, background:'rgba(239,68,68,0.15)', color:'#ef4444', fontSize:11, fontWeight:600, border:'1px solid rgba(239,68,68,0.3)', cursor:'pointer' }}>
                        Remove this item
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Candidate zone markers (when a type is pending) */}
            {pendingTypeId && PLACEMENT_ZONES.map(z => (
              <CircleMarker
                key={z.id}
                center={[z.lat, z.lng]}
                radius={8}
                pathOptions={{ color:'#60a5fa', fillColor:'#60a5fa', fillOpacity:0.20, weight:1.5, dashArray:'4 3' }}
                pane="shadowPane"
              >
                <Popup>
                  <p style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#fff', margin:0 }}>{z.name}</p>
                  <p style={{ fontFamily:'Inter,sans-serif', fontSize:10, color:'#64748b', margin:'2px 0 0' }}>
                    Suggested zone for {INFRA_TYPES.find(t => t.id === z.primaryType)?.shortName ?? z.primaryType}
                  </p>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col gap-3" style={{ height: MAP_HEIGHT, overflowY:'auto' }}>

          {/* Infrastructure palette */}
          <div className="rounded-xl p-3 flex-shrink-0"
            style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
            <p className="text-xs font-bold text-white mb-2">Infrastructure Types</p>
            <p className="text-xs mb-3" style={{ color:'#64748b' }}>
              Click a type, then click the map to place
            </p>
            <div className="space-y-1.5">
              {INFRA_TYPES.map(type => {
                const isSelected = pendingTypeId === type.id;
                return (
                  <button key={type.id} onClick={() => handleSelectType(type.id)}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all"
                    style={{
                      background: isSelected ? `rgba(${hexToRgb(type.color)},0.15)` : '#060e19',
                      border: `1px solid ${isSelected ? type.color : 'rgba(29,111,164,0.2)'}`,
                      boxShadow: isSelected ? `0 0 10px ${type.color}33` : 'none',
                    }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{type.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{type.shortName}</p>
                      <p className="text-xs font-mono" style={{ color: type.color }}>£{type.costM}M · {type.paybackYears}yr</p>
                    </div>
                    {isSelected && (
                      <span style={{ fontSize:9, color: type.color, fontWeight:700, flexShrink:0 }}>↑ ACTIVE</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Placed items */}
          <div className="rounded-xl p-3 flex-1"
            style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.25)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-white">Placed Items</p>
              {placedItems.length > 0 && (
                <button onClick={() => setPlacedItems([])} style={{
                  fontSize:10, color:'#ef4444', background:'transparent',
                  border:'1px solid rgba(239,68,68,0.3)', borderRadius:4, padding:'2px 6px', cursor:'pointer',
                }}>Clear all</button>
              )}
            </div>
            {placedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6" style={{ color:'#334155' }}>
                <p style={{ fontSize:28 }}>📍</p>
                <p className="text-xs mt-2" style={{ textAlign:'center' }}>
                  Select a type above and click the map to place infrastructure
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {placedItems.map(item => {
                  const type = INFRA_TYPES.find(t => t.id === item.typeId);
                  if (!type) return null;
                  return (
                    <div key={item.id} className="rounded-lg p-2.5 flex items-start gap-2"
                      style={{ background:'#060e19', borderLeft:`3px solid ${type.color}` }}>
                      <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{type.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{type.shortName}</p>
                        <p className="text-xs truncate" style={{ color:'#64748b' }}>{item.zoneName}</p>
                        <p className="text-xs font-mono" style={{ color:type.color }}>
                          NOx −{type.reductions.NOx}% · £{type.costM}M
                        </p>
                      </div>
                      <button onClick={() => handleRemove(item.id)} style={{
                        fontSize:14, color:'#475569', background:'transparent',
                        border:'none', cursor:'pointer', flexShrink:0, lineHeight:1,
                      }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Impact breakdown table ── */}
      {placedItems.length > 0 && (
        <div className="rounded-xl p-4"
          style={{ background:'#0a1628', border:'1px solid rgba(0,194,168,0.25)' }}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span style={{ color:'#00c2a8' }}>◆</span> Combined Emissions Impact — Full Programme
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {['NOx','NO2','PM25','CO2','SOx'].map(p => {
              const pctRed  = impact.reductions[p] ?? 0;
              const baseline = PORT_BASELINE[p]?.shipping ?? 0;
              const projected = Math.round(baseline * (1 - pctRed / 100));
              const color = pctRed > 50 ? '#10b981' : pctRed > 20 ? '#f59e0b' : pctRed > 0 ? '#60a5fa' : '#475569';
              return (
                <div key={p} className="rounded-lg p-3 text-center"
                  style={{ background:'#060e19', border:`1px solid ${color}33` }}>
                  <p className="text-xs font-semibold text-white mb-1">{p}</p>
                  <p className="text-2xl font-bold" style={{ color }}>
                    {pctRed > 0 ? `−${pctRed}%` : '—'}
                  </p>
                  <div className="mt-2 rounded-full h-1.5" style={{ background:'#0a1628' }}>
                    <div style={{
                      width:`${Math.min(100, pctRed)}%`, height:'100%',
                      background:color, borderRadius:9999, transition:'width 0.4s ease',
                    }}/>
                  </div>
                  <p className="text-xs mt-1.5" style={{ color:'#475569' }}>
                    {baseline.toLocaleString()} → {projected.toLocaleString()} t/yr
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg p-3" style={{ background:'#060e19', border:'1px solid rgba(0,194,168,0.2)' }}>
              <p className="text-xs" style={{ color:'#64748b' }}>Total Capital Cost</p>
              <p className="text-xl font-bold" style={{ color:'#00c2a8' }}>£{impact.totalCost.toFixed(1)}M</p>
            </div>
            <div className="rounded-lg p-3" style={{ background:'#060e19', border:'1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-xs" style={{ color:'#64748b' }}>Annual Operational Saving</p>
              <p className="text-xl font-bold" style={{ color:'#10b981' }}>£{impact.totalAnnualSaving.toFixed(2)}M</p>
            </div>
            <div className="rounded-lg p-3" style={{ background:'#060e19', border:'1px solid rgba(139,92,246,0.2)' }}>
              <p className="text-xs" style={{ color:'#64748b' }}>Strategic Benefit Score</p>
              <p className="text-xl font-bold" style={{ color:'#8b5cf6' }}>{impact.score}<span className="text-sm font-normal">/100</span></p>
            </div>
          </div>

          {/* Funding streams */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor:'rgba(29,111,164,0.15)' }}>
            <p className="text-xs font-semibold text-white mb-2">Applicable Funding Streams</p>
            <div className="flex flex-wrap gap-2">
              {[...new Set(placedItems.flatMap(item => INFRA_TYPES.find(t => t.id === item.typeId)?.fundingStreams ?? []))]
                .map(stream => (
                  <span key={stream} className="px-2.5 py-1 rounded-full text-xs"
                    style={{ background:'rgba(29,111,164,0.15)', color:'#60a5fa', border:'1px solid rgba(29,111,164,0.3)' }}>
                    {stream}
                  </span>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function SummaryKPI({ label, value, sub, color }) {
  return (
    <div className="rounded-xl p-4" style={{ background:'#0a1628', border:`1px solid ${color}22` }}>
      <p className="text-xs mb-1" style={{ color:'#64748b' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color:'#475569' }}>{sub}</p>
    </div>
  );
}
