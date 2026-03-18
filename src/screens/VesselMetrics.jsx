import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { vessels, vesselEmissions, pollutants, pollutantColors, pollutantUnits, pollutantType, pollutantLabel } from '../data/mockData';

const PERIOD_OPTIONS = [
  { label: '3 Months',  value: 3 },
  { label: '6 Months',  value: 6 },
  { label: '12 Months', value: 12 },
];

export default function VesselMetrics() {
  const [period, setPeriod]         = useState(12);
  const [pollutant, setPollutant]   = useState('NO2');
  const [filter, setFilter]         = useState('');
  const [sortCol, setSortCol]       = useState('miles');
  const [sortDir, setSortDir]       = useState('desc');
  const [selected, setSelected]     = useState(null);

  // Aggregate vessel stats
  const tableData = useMemo(() => {
    return vessels.map(v => {
      const readings = vesselEmissions[v.id].slice(-period);
      const miles    = readings.reduce((a, r) => a + r.miles, 0);
      const emissions = {};
      pollutants.forEach(p => {
        emissions[p] = +(readings.reduce((a, r) => a + r[p], 0) / readings.length).toFixed(2);
      });
      return { ...v, miles, ...emissions };
    });
  }, [period]);

  const filtered = useMemo(() => {
    return tableData
      .filter(v =>
        v.name.toLowerCase().includes(filter.toLowerCase()) ||
        v.type.toLowerCase().includes(filter.toLowerCase()) ||
        v.flag.toLowerCase().includes(filter.toLowerCase())
      )
      .sort((a, b) => {
        const av = a[sortCol] ?? 0;
        const bv = b[sortCol] ?? 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
  }, [tableData, filter, sortCol, sortDir]);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  // Chart data for selected pollutant
  const chartData = filtered.slice(0, 10).map(v => ({
    name: v.name.replace('MV ', '').replace('FV ', '').replace('PS ', '').replace('RFA ', '').replace('SV ', '').replace('TSS ', ''),
    [pollutant]: v[pollutant],
    miles: v.miles,
  }));

  const selectedVesselData = selected
    ? vesselEmissions[selected.id].slice(-period).map(r => ({ label: `M${r.month + 1}`, ...r }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Vessel & Shipping Metrics</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            {vessels.length} vessels monitored · Plymouth Port Authority
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter vessels…"
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: '#0a1628', color: '#e2e8f0', border: '1px solid rgba(29,111,164,0.4)', minWidth: 160 }}
          />
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
            {PERIOD_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                className="px-3 py-1.5 text-xs font-medium transition"
                style={{ background: period === o.value ? '#1d6fa4' : '#0a1628', color: period === o.value ? '#fff' : '#64748b' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pollutant filter */}
      <div className="flex flex-wrap gap-2 items-center">
        {pollutants.map(p => {
          const pType = pollutantType[p];
          const isActive = pollutant === p;
          return (
            <button key={p} onClick={() => setPollutant(p)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
              style={{
                background: isActive ? pollutantColors[p] : 'rgba(29,111,164,0.1)',
                color: isActive ? '#fff' : '#94a3b8',
                border: `1px ${pType === 'modelled' ? 'dashed' : 'solid'} ${isActive ? pollutantColors[p] : 'rgba(29,111,164,0.3)'}`,
              }}>
              {p === 'NOx' ? 'NOx*' : p}
              {pType === 'modelled' && (
                <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(96,165,250,0.25)', color: '#60a5fa', padding: '0 3px', borderRadius: 3 }}>M</span>
              )}
            </button>
          );
        })}
        <span className="text-xs ml-1" style={{ color: '#475569' }}>* derived · M = modelled</span>
      </div>

      {/* Chart */}
      <div className="rounded-xl p-5" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
        <h2 className="text-sm font-semibold text-white mb-1">
          {pollutantLabel[pollutant]} Avg Emissions by Vessel (top 10)
        </h2>
        <p className="text-xs mb-4" style={{ color: '#64748b' }}>
          Last {period} months · {pollutantUnits[pollutant]}
          {pollutantType[pollutant] === 'modelled' && <span style={{ color: '#60a5fa', marginLeft: 6 }}>· modelled estimate</span>}
          {pollutantType[pollutant] === 'derived' && <span style={{ color: '#94a3b8', marginLeft: 6 }}>· derived (NO + NO₂)</span>}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 0, right: 8, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.15)" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} angle={-30} textAnchor="end" axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#060e19', border: `1px solid ${pollutantColors[pollutant]}`, borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Bar dataKey={pollutant} fill={pollutantColors[pollutant]} radius={[3, 3, 0, 0]} fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.25)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#0a1628' }}>
                {[
                  { col: 'name',    label: 'Vessel Name' },
                  { col: 'type',    label: 'Type' },
                  { col: 'flag',    label: 'Flag' },
                  { col: 'miles',   label: 'Miles (nm)' },
                  { col: 'NO2',     label: 'NO₂ Avg' },
                  { col: 'NO',      label: 'NO Avg' },
                  { col: 'PM2.5',   label: 'PM2.5 Avg' },
                  { col: 'PM10',    label: 'PM10 Avg' },
                  { col: 'engineType', label: 'Engine' },
                ].map(({ col, label }) => (
                  <th key={col}
                    onClick={() => toggleSort(col)}
                    className="px-4 py-3 text-left font-semibold cursor-pointer select-none transition"
                    style={{ color: sortCol === col ? '#60a5fa' : '#64748b', whiteSpace: 'nowrap' }}>
                    {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr
                  key={v.id}
                  onClick={() => setSelected(selected?.id === v.id ? null : v)}
                  className="cursor-pointer transition"
                  style={{
                    background: selected?.id === v.id ? 'rgba(29,111,164,0.2)' : i % 2 === 0 ? '#060e19' : '#081220',
                    borderBottom: '1px solid rgba(29,111,164,0.1)',
                  }}
                >
                  <td className="px-4 py-3 font-medium text-white">{v.name}</td>
                  <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                    <TypeBadge type={v.type} />
                  </td>
                  <td className="px-4 py-3 font-mono" style={{ color: '#64748b' }}>{v.flag}</td>
                  <td className="px-4 py-3 font-mono text-right" style={{ color: '#60a5fa' }}>
                    {v.miles.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-right font-bold" style={{ color: '#f59e0b' }}>{v.NO2}</td>
                  <td className="px-4 py-3 font-mono text-right" style={{ color: '#8b5cf6' }}>{v.NO}</td>
                  <td className="px-4 py-3 font-mono text-right" style={{ color: '#a78bfa' }}>{v['PM2.5']}</td>
                  <td className="px-4 py-3 font-mono text-right" style={{ color: '#6366f1' }}>{v.PM10}</td>
                  <td className="px-4 py-3" style={{ color: '#64748b' }}>
                    <EngineBadge engine={v.engineType} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected vessel detail */}
      {selected && (
        <div className="rounded-xl p-5" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.3)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">{selected.name} — Monthly Profile</h2>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                IMO: {selected.imo} · GT: {selected.gtonnage.toLocaleString()} · Port: {selected.homePort}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs" style={{ color: '#64748b' }}>✕ Close</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Miles', value: selected.miles.toLocaleString(), unit: 'nm', color: '#60a5fa' },
              { label: `Avg ${pollutantLabel[pollutant]}`, value: selected[pollutant], unit: pollutantUnits[pollutant], color: pollutantColors[pollutant] },
              { label: 'Avg NO', value: selected.NO, unit: 'µg/m³', color: '#8b5cf6' },
              { label: 'Avg PM2.5', value: selected['PM2.5'], unit: 'µg/m³', color: '#a78bfa' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: '#060e19' }}>
                <p className="text-xs mb-1" style={{ color: '#64748b' }}>{s.label}</p>
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs" style={{ color: '#475569' }}>{s.unit}</p>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={selectedVesselData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.12)" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#060e19', border: '1px solid #1d6fa4', borderRadius: 6, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Bar dataKey={pollutant} fill={pollutantColors[pollutant]} radius={[3,3,0,0]} />
              <Bar dataKey="miles" fill="#60a5fa" radius={[3,3,0,0]} fillOpacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  const colors = {
    Cargo: '#60a5fa', Ferry: '#34d399', Naval: '#f59e0b',
    'Bulk Cargo': '#8b5cf6', Container: '#ec4899', Fishing: '#fb923c', Passenger: '#a78bfa',
  };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs" style={{
      background: `${colors[type] || '#64748b'}20`,
      color: colors[type] || '#64748b',
      border: `1px solid ${colors[type] || '#64748b'}40`,
    }}>{type}</span>
  );
}

function EngineBadge({ engine }) {
  const colors = { Diesel: '#f59e0b', LNG: '#10b981', Nuclear: '#ef4444' };
  return (
    <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ color: colors[engine] || '#94a3b8' }}>
      {engine}
    </span>
  );
}
