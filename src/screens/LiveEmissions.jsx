import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import {
  sensors, pollutants, pollutantColors, pollutantUnits, pollutantThresholds,
  pollutantType, pollutantLabel, pollutantLimits, sensorReadings, avgPollutant,
} from '../data/mockData';

const PERIOD_OPTIONS = [
  { label: '3 Months',  value: 3 },
  { label: '6 Months',  value: 6 },
  { label: '12 Months', value: 12 },
];

// Pollutants that have a UK legal annual mean limit suitable for a chart reference line
const LIMIT_POLLUTANTS = new Set(['NO2', 'PM2.5', 'PM10']);

export default function LiveEmissions() {
  const [sensor, setSensor]       = useState('S01');
  const [pollutant, setPollutant] = useState('NO2');
  const [period, setPeriod]       = useState(6);
  const [compareA, setCompareA]   = useState(3);
  const [compareB, setCompareB]   = useState(6);

  const readings  = sensorReadings[sensor].slice(-period);
  const current   = sensorReadings[sensor].slice(-period);
  const prior     = sensorReadings[sensor].slice(-period * 2, -period);
  const currAvg   = avgPollutant(current, pollutant);
  const priorAvg  = avgPollutant(prior, pollutant);
  const trendPct  = priorAvg === 0 ? 0 : +((currAvg - priorAvg) / priorAvg * 100).toFixed(1);
  const isAlert   = trendPct > 5;

  const chartData      = readings.map(r => ({ label: r.label, [pollutant]: r[pollutant] }));
  const compareDataA   = sensorReadings[sensor].slice(-compareA).map(r => ({ label: r.label, value: r[pollutant] }));
  const compareDataB   = sensorReadings[sensor].slice(-compareB).map(r => ({ label: r.label, value: r[pollutant] }));

  // Multi-pollutant overview — exclude NOx from the raw chart (shown with dashed line) and SO2 visually distinct
  const multiData = readings.map(r => {
    const o = { label: r.label };
    pollutants.forEach(p => { o[p] = r[p]; });
    return o;
  });

  const ukLimit       = pollutantLimits[pollutant];     // UK legal annual mean limit (if any)
  const showLimitLine = LIMIT_POLLUTANTS.has(pollutant) && ukLimit != null;
  const pType         = pollutantType[pollutant];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Emissions</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>Timeline analysis · Plymouth Harbour sensors</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select value={sensor} onChange={e => setSensor(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: '#0a1628', color: '#e2e8f0', border: '1px solid rgba(29,111,164,0.4)' }}>
            {sensors.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
          </select>

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

      {/* Trend alert banner */}
      {isAlert ? (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)' }}>
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-400">
              {pollutantLabel[pollutant]} has increased by {trendPct}% vs prior {period}-month period
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
              Current avg: {currAvg} {pollutantUnits[pollutant]} · Prior avg: {priorAvg} {pollutantUnits[pollutant]}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <span className="text-lg">✅</span>
          <p className="text-sm" style={{ color: '#10b981' }}>
            {pollutantLabel[pollutant]} trend is stable · {trendPct > 0 ? '+' : ''}{trendPct}% vs prior period
            ({currAvg} vs {priorAvg} {pollutantUnits[pollutant]})
          </p>
        </div>
      )}

      {/* Pollutant selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {pollutants.map(p => {
          const pt = pollutantType[p];
          return (
            <button key={p} onClick={() => setPollutant(p)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
              style={{
                background: pollutant === p ? pollutantColors[p] : 'rgba(29,111,164,0.1)',
                color:      pollutant === p ? '#fff' : '#94a3b8',
                border:     `1px solid ${pollutant === p ? pollutantColors[p] : 'rgba(29,111,164,0.3)'}`,
                borderStyle: pt === 'modelled' ? 'dashed' : 'solid',
              }}>
              {p === 'PM2.5' ? 'PM2.5' : p}
              {pt === 'derived'  && <span style={{ fontSize: 8, opacity: 0.8, marginLeft: 2 }}>*</span>}
              {pt === 'modelled' && (
                <span style={{ fontSize: 8, fontWeight: 700, padding: '0 3px', background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>M</span>
              )}
            </button>
          );
        })}
        <span className="text-xs ml-2" style={{ color: '#475569' }}>
          * derived &nbsp;·&nbsp; <span style={{ fontStyle: 'italic' }}>M</span> = modelled estimate
        </span>
      </div>

      {/* Pollutant type indicator */}
      {pType !== 'measured' && (
        <div className="rounded-lg px-4 py-2.5 flex items-center gap-3"
          style={{
            background: pType === 'modelled' ? 'rgba(96,165,250,0.07)' : 'rgba(239,68,68,0.07)',
            border: `1px ${pType === 'modelled' ? 'dashed' : 'solid'} rgba(${pType === 'modelled' ? '96,165,250' : '239,68,68'},0.35)`,
          }}>
          <span className="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
            style={{ background: pType === 'modelled' ? 'rgba(96,165,250,0.2)' : 'rgba(239,68,68,0.2)', color: pType === 'modelled' ? '#60a5fa' : '#ef4444', border: `1px solid ${pType === 'modelled' ? 'rgba(96,165,250,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
            {pType === 'modelled' ? 'M' : '∑'}
          </span>
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            {pType === 'derived'
              ? 'NOx is a derived metric calculated as NO + NO₂. It is not directly measured — individual NO and NO₂ readings are the primary data.'
              : 'SO₂ is not directly measured at Plymouth sensors. This is a modelled estimate based on vessel fuel type and activity data. Treat with caution for regulatory submissions.'}
          </p>
        </div>
      )}

      {/* Main timeline chart */}
      <div className="rounded-xl p-5" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {pollutantLabel[pollutant]} — {sensors.find(s => s.id === sensor)?.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              Last {period} months · {pollutantUnits[pollutant]}
              {showLimitLine && ` · UK annual mean limit: ${ukLimit} µg/m³`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#64748b' }}>Avg this period</p>
            <p className="text-lg font-bold" style={{ color: pollutantColors[pollutant] }}>
              {currAvg} <span className="text-xs font-normal">{pollutantUnits[pollutant]}</span>
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.15)" />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#060e19', border: '1px solid #1d6fa4', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={v => [`${v} ${pollutantUnits[pollutant]}`, pollutantLabel[pollutant]]}
            />
            {/* UK annual mean limit — shown for measured pollutants with a defined limit */}
            {showLimitLine && (
              <ReferenceLine y={ukLimit} stroke="#ef4444" strokeDasharray="6 3"
                label={{ value: `UK limit ${ukLimit}`, fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }} />
            )}
            <Line
              type="monotone" dataKey={pollutant} stroke={pollutantColors[pollutant]}
              strokeWidth={2.5} strokeDasharray={pType !== 'measured' ? '6 3' : undefined}
              dot={{ fill: pollutantColors[pollutant], r: 3 }} activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Period comparison */}
      <div className="rounded-xl p-5" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Period Comparison</h2>
            <p className="text-xs" style={{ color: '#64748b' }}>Compare two rolling windows · {pollutantLabel[pollutant]}</p>
          </div>
          <div className="flex items-center gap-3">
            {[['Period A', compareA, setCompareA], ['Period B', compareB, setCompareB]].map(([lbl, val, set]) => (
              <div key={lbl} className="flex items-center gap-2">
                <span className="text-xs" style={{ color: '#64748b' }}>{lbl}</span>
                <select value={val} onChange={e => set(+e.target.value)}
                  className="px-2 py-1 rounded text-xs outline-none"
                  style={{ background: '#060e19', color: '#e2e8f0', border: '1px solid rgba(29,111,164,0.4)' }}>
                  {[3, 6, 12].map(v => <option key={v} value={v}>{v} months</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ label: `Last ${compareA} months`, data: compareDataA, color: '#1d6fa4' },
            { label: `Last ${compareB} months`, data: compareDataB, color: '#00c2a8' }].map(({ label, data, color }) => {
            const avg = +(data.reduce((a, d) => a + d.value, 0) / data.length).toFixed(2);
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>Avg: {avg} {pollutantUnits[pollutant]}</span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.12)" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#060e19', border: `1px solid ${color}`, borderRadius: 6, fontSize: 11 }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    {showLimitLine && (
                      <ReferenceLine y={ukLimit} stroke="#ef444480" strokeDasharray="4 2"
                        label={{ value: `UK limit ${ukLimit}`, fill: '#ef4444', fontSize: 8 }} />
                    )}
                    <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-pollutant overview */}
      <div className="rounded-xl p-5" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
        <h2 className="text-sm font-semibold text-white mb-1">
          All Pollutants — {sensors.find(s => s.id === sensor)?.name}
        </h2>
        <p className="text-xs mb-1" style={{ color: '#64748b' }}>
          Last {period} months · µg/m³ · dashed lines = derived or modelled
        </p>
        <div className="flex flex-wrap gap-3 mb-3 text-xs" style={{ color: '#64748b' }}>
          <span style={{ color: '#10b981' }}>● Measured</span>
          <span style={{ color: '#f59e0b' }}>- - Derived (NOx = NO + NO₂)</span>
          <span style={{ color: '#60a5fa', fontStyle: 'italic' }}>- - SO₂ (modelled)</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={multiData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.15)" />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#060e19', border: '1px solid #1d6fa4', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {/* UK annual mean limit lines */}
            <ReferenceLine y={40} stroke="#f59e0b44" strokeDasharray="4 4"
              label={{ value: 'NO₂ limit 40', fill: '#f59e0b', fontSize: 8 }} />
            <ReferenceLine y={20} stroke="#a78bfa44" strokeDasharray="4 4"
              label={{ value: 'PM2.5 limit 20', fill: '#a78bfa', fontSize: 8 }} />
            {pollutants.map(p => (
              <Line key={p} type="monotone" dataKey={p}
                stroke={pollutantColors[p]} strokeWidth={1.5} dot={false}
                strokeDasharray={pollutantType[p] !== 'measured' ? '5 3' : undefined}
                name={pollutantLabel[p]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
