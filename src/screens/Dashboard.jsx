import { getPortKPIs, sensors, pollutantColors, sensorReadings } from '../data/mockData';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function Dashboard({ onNavigate }) {
  const kpi = getPortKPIs(12);
  const kpi3 = getPortKPIs(3);

  // Mini sparkline: last 6 months port-wide avg CO2
  const sparkData = sensorReadings['S01'].slice(-6).map(r => ({
    label: r.label,
    CO2: +r.CO2.toFixed(0),
    NO2: +r.NO2.toFixed(1),
    NOx: +r.NOx.toFixed(1),
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Port Emissions Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            Plymouth Harbour — 12-month rolling summary
          </p>
        </div>
        <div className="flex gap-2">
          <QuickBtn label="Map View" color="#1d6fa4" onClick={() => onNavigate('map')} icon="🗺️" />
          <QuickBtn label="Reports" color="#00c2a8" onClick={() => onNavigate('reports')} icon="📄" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total CO₂ (12m)"
          value={kpi.totalCO2.toLocaleString()}
          unit="ppm-months"
          sub="All sensors combined"
          color="#10b981"
          trend={null}
        />
        <KPICard
          title="Avg NO₂"
          value={kpi.avgNO2}
          unit="µg/m³"
          sub="Port-wide average"
          color="#f59e0b"
          trend="+2.3%"
          trendUp={true}
        />
        <KPICard
          title="Avg PM2.5"
          value={kpi.avgPM25}
          unit="µg/m³"
          sub="WHO limit: 15 µg/m³"
          color="#06b6d4"
          trend="-1.1%"
          trendUp={false}
        />
        <KPICard
          title="Total Miles"
          value={kpi.totalMiles.toLocaleString()}
          unit="nautical miles"
          sub={`${kpi.activeVessels} vessels tracked`}
          color="#8b5cf6"
          trend="+4.7%"
          trendUp={true}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBadge label="Active Sensors" value={kpi.activeSensors} icon="📡" />
        <StatBadge label="Vessels Monitored" value={kpi.activeVessels} icon="🚢" />
        <StatBadge label="Avg SOx (12m)" value={`${kpi.avgSOx} µg/m³`} icon="🌫️" />
        <StatBadge label="Data Completeness" value="97.4%" icon="✅" />
      </div>

      {/* Chart + Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend chart */}
        <div className="lg:col-span-2 rounded-xl p-5"
          style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Emissions Trend — Last 6 Months</h2>
              <p className="text-xs" style={{ color: '#64748b' }}>Devonport Sensor (S01) · CO₂, NO₂, NOx</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sparkData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                {[['CO2','#10b981'],['NO2','#f59e0b'],['NOx','#ec4899']].map(([k,c])=>(
                  <linearGradient key={k} id={`g${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={c} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.15)" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0a1628', border: '1px solid #1d6fa4', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="CO2" stroke="#10b981" fill="url(#gCO2)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="NO2" stroke="#f59e0b" fill="url(#gNO2)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="NOx" stroke="#ec4899" fill="url(#gNOx)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts */}
        <div className="rounded-xl p-5 space-y-3"
          style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
          <h2 className="text-sm font-semibold text-white">Active Alerts</h2>
          <Alert level="warn"  title="NO₂ Elevated" msg="Millbay Docks — 187 µg/m³ (93% of limit)" />
          <Alert level="warn"  title="SOx Spike"    msg="Cattewater — 312 µg/m³ (89% of limit)" />
          <Alert level="info"  title="Ferry Schedule" msg="Brittany Ferries arrival 14:30 — monitor SO₂" />
          <Alert level="ok"    title="PM2.5 Normal"   msg="All sensors within WHO guidelines" />
          <Alert level="info"  title="Report Due"     msg="Q1 2025 compliance report due in 8 days" />
          <button
            onClick={() => onNavigate('emissions')}
            className="w-full mt-2 text-xs py-2 rounded-lg font-medium transition"
            style={{ background: 'rgba(29,111,164,0.2)', color: '#60a5fa', border: '1px solid rgba(29,111,164,0.3)' }}
          >
            View Live Emissions →
          </button>
        </div>
      </div>

      {/* Sensor status grid */}
      <div className="rounded-xl p-5"
        style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Sensor Network Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sensors.map(s => {
            const latest = sensorReadings[s.id].at(-1);
            const ok = latest.NO2 < 160;
            return (
              <div key={s.id} className="rounded-lg p-3" style={{ background: '#060e19', border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.4)'}` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono" style={{ color: '#64748b' }}>{s.id}</span>
                  <span className="w-2 h-2 rounded-full" style={{ background: ok ? '#10b981' : '#f59e0b' }} />
                </div>
                <p className="text-xs font-medium text-white truncate">{s.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{s.type}</p>
                <p className="text-xs mt-1 font-mono" style={{ color: ok ? '#10b981' : '#f59e0b' }}>
                  NO₂ {latest.NO2} µg/m³
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, unit, sub, color, trend, trendUp }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium" style={{ color: '#64748b' }}>{title}</p>
        {trend && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: trendUp ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: trendUp ? '#ef4444' : '#10b981' }}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold mt-2" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{unit}</p>
      <p className="text-xs mt-2" style={{ color: '#64748b' }}>{sub}</p>
    </div>
  );
}

function StatBadge({ label, value, icon }) {
  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3"
      style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.2)' }}>
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xs" style={{ color: '#64748b' }}>{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function Alert({ level, title, msg }) {
  const cfg = {
    warn: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', dot: '#f59e0b' },
    info: { bg: 'rgba(29,111,164,0.1)',  border: 'rgba(29,111,164,0.3)',  dot: '#60a5fa' },
    ok:   { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', dot: '#10b981' },
  }[level];
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        <span className="text-xs font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs mt-0.5 ml-3.5" style={{ color: '#94a3b8' }}>{msg}</p>
    </div>
  );
}

function QuickBtn({ label, color, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
      style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
