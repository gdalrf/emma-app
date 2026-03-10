import { useState } from 'react';

const assumptions = [
  {
    id: 'emf',
    title: 'Emission Factors',
    category: 'Modelling',
    content: `Emission factors are derived from the EMEP/EEA Air Pollutant Emission Inventory Guidebook (2023 edition)
    and the IMO Fourth GHG Study (2020). Vessel-specific factors are based on engine type, gross tonnage,
    and fuel type (HFO, MGO, LNG). Default load factors assume vessels operate at 70–80% of MCR when
    within port limits and 30–40% MCR when manoeuvring.`,
    accuracy: 'Estimated accuracy: ±15% for individual vessel readings. Port-wide averages: ±8%.',
  },
  {
    id: 'disp',
    title: 'Dispersion Modelling',
    category: 'Atmospheric',
    content: `Pollutant dispersion is estimated using a Gaussian plume model adapted for coastal environments.
    The model accounts for sea-breeze effects common in Plymouth Sound, prevailing south-westerly winds,
    and urban heat island effects in the Devonport area. Atmospheric stability classes follow the Pasquill–Gifford
    classification, updated hourly from MET Office data.`,
    accuracy: 'Near-field accuracy (within 500m of source): ±20%. Far-field (>2km): ±35%.',
  },
  {
    id: 'sensor',
    title: 'Sensor Calibration',
    category: 'Hardware',
    content: `All EMMA sensors are calibrated quarterly against certified reference instruments conforming to
    EN 14211 (NOx), EN 14212 (SO₂), EN 14907 (PM10/PM2.5), and EN ISO 16911 (CO₂). Sensors use
    electrochemical cells for NOx/SO₂ and optical particle counters for PM readings.
    Data is logged at 1-minute intervals and aggregated to hourly/monthly means.`,
    accuracy: 'Sensor drift between calibrations: <5%. Data completeness target: >95%.',
  },
  {
    id: 'shore',
    title: 'Shore Power & Cold Ironing',
    category: 'Operational',
    content: `Vessels connected to shore power at Millbay Docks and Devonport are assumed to have zero
    auxiliary engine emissions during berth. Shore power consumption is converted to upstream emissions
    using the UK grid carbon intensity (National Grid ESO data, typically 150–250 gCO₂/kWh in 2025).
    Cold ironing eligibility is limited to berths with 11kV connection capability.`,
    accuracy: 'Shore power emission estimates: ±10%.',
  },
  {
    id: 'marpol',
    title: 'MARPOL Annex VI Compliance',
    category: 'Regulatory',
    content: `Plymouth Harbour operates within the North Sea SOx Emission Control Area (SECA).
    All vessels must use fuel with sulphur content ≤0.1% m/m. EMMA monitors SOx as a proxy for
    fuel sulphur compliance. Vessels with scrubbers (exhaust gas cleaning systems) are flagged separately;
    open-loop scrubber discharges are not permitted in Plymouth Sound.`,
    accuracy: 'SOx compliance screening accuracy: ±12% against laboratory fuel analysis.',
  },
  {
    id: 'background',
    title: 'Background Concentrations',
    category: 'Atmospheric',
    content: `Background pollutant concentrations are sourced from DEFRA's Automatic Urban and Rural Network (AURN)
    Plymouth Centre monitoring station. Shipping-attributable emissions are estimated by subtracting
    background levels from total measured concentrations during vessel activity periods.
    Road traffic and industrial sources are estimated separately using the National Atmospheric Emissions Inventory.`,
    accuracy: 'Attribution accuracy: ±25% (due to source mixing complexities in urban coastal areas).',
  },
];

const dataSourceInfo = [
  { label: 'Emission Factors',     source: 'EMEP/EEA 2023, IMO GHG Study 2020' },
  { label: 'Vessel Data',          source: 'Lloyd\'s Register, IHS Markit AIS' },
  { label: 'Meteorology',          source: 'MET Office MIDAS, Plymouth Sound buoy' },
  { label: 'Air Quality Background', source: 'DEFRA AURN — Plymouth Centre' },
  { label: 'Regulatory Limits',   source: 'EU AAQ Directive 2008/50/EC, WHO AQG 2021' },
  { label: 'Fuel Sulphur Content', source: 'MARPOL Annex VI, MEPC.320(74)' },
];

export default function Settings() {
  const [showAccuracy, setShowAccuracy]         = useState(true);
  const [expanded, setExpanded]                 = useState(null);
  const [showDataSources, setShowDataSources]   = useState(false);
  const [units, setUnits]                       = useState('metric');
  const [alertThreshold, setAlertThreshold]     = useState(5);
  const [notifications, setNotifications]       = useState({ email: true, dashboard: true, weekly: false });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings & Assumptions</h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          Modelling methodology, data sources, and accuracy notes
        </p>
      </div>

      {/* Display settings */}
      <Section title="Display Preferences">
        <div className="space-y-4">
          <ToggleRow
            label="Show accuracy notes in panels"
            description="Displays ±% accuracy ranges under each emissions reading"
            value={showAccuracy}
            onChange={setShowAccuracy}
          />
          <ToggleRow
            label="Show data sources panel"
            description="Reveals full list of data sources used in modelling"
            value={showDataSources}
            onChange={setShowDataSources}
          />
          <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgba(29,111,164,0.15)' }}>
            <div>
              <p className="text-sm font-medium text-white">Measurement Units</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Select display unit system</p>
            </div>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
              {['metric', 'imperial'].map(u => (
                <button key={u} onClick={() => setUnits(u)}
                  className="px-3 py-1.5 text-xs font-medium capitalize transition"
                  style={{ background: units === u ? '#1d6fa4' : '#0a1628', color: units === u ? '#fff' : '#64748b' }}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Alert settings */}
      <Section title="Alert Configuration">
        <div className="space-y-4">
          <div className="py-3 border-b" style={{ borderColor: 'rgba(29,111,164,0.15)' }}>
            <p className="text-sm font-medium text-white mb-1">Trend Alert Threshold</p>
            <p className="text-xs mb-3" style={{ color: '#64748b' }}>
              Trigger an alert when emissions increase by more than X% vs the prior period
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range" min={1} max={20} value={alertThreshold}
                onChange={e => setAlertThreshold(+e.target.value)}
                className="flex-1"
                style={{ accentColor: '#1d6fa4' }}
              />
              <span className="text-sm font-bold w-12 text-center rounded-lg py-1"
                style={{ background: '#060e19', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                {alertThreshold}%
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: '#475569' }}>
              Current setting: alert when ≥{alertThreshold}% increase detected. EMMA default is 5%.
            </p>
          </div>
          <ToggleRow label="Email alerts" description="Receive email when thresholds are exceeded"
            value={notifications.email} onChange={v => setNotifications(n => ({ ...n, email: v }))} />
          <ToggleRow label="Dashboard notifications" description="Show in-app banners for active alerts"
            value={notifications.dashboard} onChange={v => setNotifications(n => ({ ...n, dashboard: v }))} />
          <ToggleRow label="Weekly digest" description="Receive weekly summary email every Monday"
            value={notifications.weekly} onChange={v => setNotifications(n => ({ ...n, weekly: v }))} />
        </div>
      </Section>

      {/* Modelling assumptions */}
      <Section title="Modelling Assumptions">
        <p className="text-xs mb-4" style={{ color: '#64748b' }}>
          Click any assumption to expand the full methodology note. These describe how EMMA estimates
          port emissions and the expected accuracy of each component.
        </p>
        <div className="space-y-2">
          {assumptions.map(a => (
            <div key={a.id} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${expanded === a.id ? 'rgba(29,111,164,0.5)' : 'rgba(29,111,164,0.2)'}` }}>
              <button
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition"
                style={{ background: expanded === a.id ? 'rgba(29,111,164,0.15)' : '#060e19' }}>
                <div className="flex items-center gap-3">
                  <CategoryBadge cat={a.category} />
                  <span className="text-sm font-medium text-white">{a.title}</span>
                </div>
                <span className="text-xs" style={{ color: '#64748b' }}>{expanded === a.id ? '▲' : '▼'}</span>
              </button>
              {expanded === a.id && (
                <div className="px-4 pb-4" style={{ background: '#060e19' }}>
                  <p className="text-sm leading-relaxed mt-2" style={{ color: '#94a3b8' }}>{a.content}</p>
                  {showAccuracy && (
                    <div className="mt-3 px-3 py-2 rounded-lg flex items-start gap-2"
                      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                      <span className="text-warn mt-0.5">ⓘ</span>
                      <p className="text-xs" style={{ color: '#f59e0b' }}>{a.accuracy}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Data sources */}
      {showDataSources && (
        <Section title="Data Sources">
          <div className="space-y-2">
            {dataSourceInfo.map(d => (
              <div key={d.label} className="flex items-start justify-between py-2 border-b"
                style={{ borderColor: 'rgba(29,111,164,0.12)' }}>
                <span className="text-sm font-medium text-white">{d.label}</span>
                <span className="text-xs text-right ml-4" style={{ color: '#64748b', maxWidth: '60%' }}>{d.source}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* System info */}
      <Section title="System Information">
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            ['EMMA Version', 'v2.4.1'],
            ['Data Standard', 'EN 15804, ISO 14064'],
            ['Sensor Protocol', 'IEC 61850 / MODBUS TCP'],
            ['Report Format', 'PDF/A-1b, PNG'],
            ['Timezone', 'UTC+1 (BST)'],
            ['Last Calibration', '14 Feb 2025'],
            ['Data Retention', '7 years (MARPOL)'],
            ['Support Contact', 'emma-support@plymouthport.gov.uk'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg px-3 py-2.5" style={{ background: '#060e19', border: '1px solid rgba(29,111,164,0.15)' }}>
              <p style={{ color: '#64748b' }}>{k}</p>
              <p className="font-medium text-white mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.25)' }}>
      <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#1d6fa4' }} />
        {title}
      </h2>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgba(29,111,164,0.15)' }}>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-10 h-5 rounded-full transition-all flex-shrink-0 ml-4"
        style={{ background: value ? '#1d6fa4' : '#1e293b', border: '1px solid rgba(29,111,164,0.4)' }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{ background: '#fff', left: value ? '1.35rem' : '0.1rem' }} />
      </button>
    </div>
  );
}

function CategoryBadge({ cat }) {
  const colors = {
    Modelling: '#60a5fa', Atmospheric: '#34d399', Hardware: '#f59e0b',
    Operational: '#8b5cf6', Regulatory: '#ef4444',
  };
  const c = colors[cat] || '#64748b';
  return (
    <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${c}20`, color: c }}>
      {cat}
    </span>
  );
}
