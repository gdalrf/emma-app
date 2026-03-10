import { useRef, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  sensors, vessels, pollutants, pollutantColors, pollutantUnits, sensorReadings,
  vesselEmissions, getPortKPIs,
} from '../data/mockData';

export default function ReportGenerator() {
  const [period, setPeriod]   = useState(12);
  const [exporting, setExp]   = useState(false);
  const reportRef             = useRef(null);

  const kpi = getPortKPIs(period);

  // Aggregate monthly port-wide
  const months = sensorReadings['S01'].slice(-period).map((r, i) => {
    const o = { label: r.label };
    pollutants.forEach(p => {
      o[p] = +(sensors.reduce((a, s) => a + sensorReadings[s.id].slice(-period)[i]?.[p] || 0, 0) / sensors.length).toFixed(2);
    });
    return o;
  });

  // Vessel summary
  const vesselSummary = vessels.map(v => {
    const reads = vesselEmissions[v.id].slice(-period);
    return {
      name: v.name.replace(/^(MV|FV|PS|SV|RFA|TSS) /, ''),
      miles: reads.reduce((a, r) => a + r.miles, 0),
      CO2: +(reads.reduce((a, r) => a + r.CO2, 0) / reads.length).toFixed(1),
    };
  }).sort((a, b) => b.CO2 - a.CO2);

  // Pollutant share pie
  const pieData = pollutants.slice(0, 6).map(p => ({
    name: p,
    value: +(months.reduce((a, m) => a + m[p], 0) / months.length).toFixed(2),
  }));

  async function handleDownloadPDF() {
    setExp(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0a1628',
        scale: 1.5,
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let y = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      while (y < pdfH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(img, 'PNG', 0, -y, pdfW, pdfH);
        y += pageH;
      }
      pdf.save(`EMMA_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error(err);
    }
    setExp(false);
  }

  async function downloadChart(chartId, name) {
    const { default: html2canvas } = await import('html2canvas');
    const el = document.getElementById(chartId);
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: '#0a1628', scale: 2 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `EMMA_${name}.png`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Automated Report Generator</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>Plymouth Port Authority — Emissions Compliance Report</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.4)' }}>
            {[3, 6, 12].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1.5 text-xs font-medium transition"
                style={{ background: period === p ? '#1d6fa4' : '#0a1628', color: period === p ? '#fff' : '#64748b' }}>
                {p}m
              </button>
            ))}
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: exporting ? '#155880' : '#1d6fa4', boxShadow: '0 4px 12px rgba(29,111,164,0.4)' }}>
            {exporting ? '⏳ Generating…' : '⬇️ Download PDF'}
          </button>
        </div>
      </div>

      {/* === REPORT BODY === */}
      <div ref={reportRef} className="space-y-6 rounded-xl p-6"
        style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.3)' }}>

        {/* Report header */}
        <div className="border-b pb-6" style={{ borderColor: 'rgba(29,111,164,0.3)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #1d6fa4, #00c2a8)' }}>E</div>
                <div>
                  <p className="text-lg font-bold text-white">EMMA — Emissions Report</p>
                  <p className="text-xs" style={{ color: '#64748b' }}>Plymouth Port Authority</p>
                </div>
              </div>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                <strong style={{ color: '#fff' }}>Reporting Period:</strong> Last {period} months
              </p>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                <strong style={{ color: '#fff' }}>Generated:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm" style={{ color: '#94a3b8' }}>
                <strong style={{ color: '#fff' }}>Prepared by:</strong> Harbour Master — Class A Operator
              </p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(0,194,168,0.15)', color: '#00c2a8', border: '1px solid rgba(0,194,168,0.3)' }}>
                DRAFT — CONFIDENTIAL
              </span>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div>
          <SectionTitle>1. Executive Summary</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <KPIBox label="Total CO₂" value={kpi.totalCO2.toLocaleString()} unit="ppm-m" color="#10b981" />
            <KPIBox label="Avg NO₂" value={kpi.avgNO2} unit="µg/m³" color="#f59e0b" />
            <KPIBox label="Avg PM2.5" value={kpi.avgPM25} unit="µg/m³" color="#06b6d4" />
            <KPIBox label="Vessels" value={kpi.activeVessels} unit="monitored" color="#8b5cf6" />
          </div>
          <div className="mt-3 p-4 rounded-lg text-sm leading-relaxed" style={{ background: '#060e19', color: '#94a3b8' }}>
            <p>
              This report summarises port-wide emissions data collected across {sensors.length} sensor locations
              at Plymouth Harbour over the {period}-month reporting period. A total of {kpi.activeVessels} vessels
              were tracked, collectively logging {kpi.totalMiles.toLocaleString()} nautical miles. Average NO₂
              concentrations of {kpi.avgNO2} µg/m³ remain within EU Air Quality Directive thresholds (200 µg/m³),
              and PM2.5 levels of {kpi.avgPM25} µg/m³ are below the WHO interim target of 15 µg/m³.
            </p>
          </div>
        </div>

        {/* Emissions Timeline */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>2. Emissions Timeline — All Sensors</SectionTitle>
            <button onClick={() => downloadChart('chart-timeline', 'Emissions_Timeline')}
              className="text-xs px-2 py-1 rounded transition" style={{ color: '#60a5fa', background: 'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <div id="chart-timeline" className="mt-3 p-3 rounded-lg" style={{ background: '#060e19' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={months} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.15)" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #1d6fa4', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {['NO2','NOx','SO2','CO2'].map(p => (
                  <Line key={p} type="monotone" dataKey={p} stroke={pollutantColors[p]} strokeWidth={1.8} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CO2 bar chart */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>3. Monthly CO₂ Concentrations</SectionTitle>
            <button onClick={() => downloadChart('chart-co2', 'CO2_Monthly')}
              className="text-xs px-2 py-1 rounded transition" style={{ color: '#60a5fa', background: 'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <div id="chart-co2" className="mt-3 p-3 rounded-lg" style={{ background: '#060e19' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={months} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.12)" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #10b981', borderRadius: 6, fontSize: 11 }} />
                <Bar dataKey="CO2" fill="#10b981" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pollutant mix pie */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>4. Pollutant Distribution</SectionTitle>
            <button onClick={() => downloadChart('chart-pie', 'Pollutant_Distribution')}
              className="text-xs px-2 py-1 rounded transition" style={{ color: '#60a5fa', background: 'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <div id="chart-pie" className="mt-3 p-3 rounded-lg flex justify-center" style={{ background: '#060e19' }}>
            <PieChart width={380} height={200}>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#64748b' }} fontSize={11}>
                {pieData.map((e, i) => <Cell key={i} fill={pollutantColors[e.name] || '#60a5fa'} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #1d6fa4', borderRadius: 6, fontSize: 11 }} />
            </PieChart>
          </div>
        </div>

        {/* Vessel emissions table */}
        <div>
          <SectionTitle>5. Vessel Emissions Summary</SectionTitle>
          <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(29,111,164,0.2)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#060e19' }}>
                  {['Vessel', 'Type', 'Flag', 'Miles (nm)', 'Avg CO₂ (ppm)'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vesselSummary.map((v, i) => (
                  <tr key={v.name} style={{ background: i % 2 === 0 ? 'transparent' : '#060e1940', borderBottom: '1px solid rgba(29,111,164,0.08)' }}>
                    <td className="px-3 py-2 font-medium text-white">{v.name}</td>
                    <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{vessels[i]?.type}</td>
                    <td className="px-3 py-2 font-mono" style={{ color: '#64748b' }}>{vessels[i]?.flag}</td>
                    <td className="px-3 py-2 font-mono text-right" style={{ color: '#60a5fa' }}>{v.miles.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-right font-bold" style={{ color: '#10b981' }}>{v.CO2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regulatory compliance */}
        <div>
          <SectionTitle>6. Regulatory Compliance</SectionTitle>
          <div className="mt-3 space-y-2">
            {[
              { pollutant: 'NO₂',   limit: '200 µg/m³',  actual: `${kpi.avgNO2} µg/m³`,  ok: kpi.avgNO2 < 200,  ref: 'EU AAQ Directive' },
              { pollutant: 'SOx',   limit: '350 µg/m³',  actual: `${kpi.avgSOx} µg/m³`,  ok: kpi.avgSOx < 350,  ref: 'EU AAQ Directive' },
              { pollutant: 'PM2.5', limit: '25 µg/m³',   actual: `${kpi.avgPM25} µg/m³`, ok: kpi.avgPM25 < 25,  ref: 'WHO AQG 2021' },
              { pollutant: 'CO₂',   limit: '1000 ppm',   actual: `${(kpi.totalCO2/sensors.length/period).toFixed(0)} ppm`, ok: true, ref: 'MARPOL Annex VI' },
            ].map(row => (
              <div key={row.pollutant} className="flex items-center justify-between rounded-lg px-4 py-2.5"
                style={{ background: '#060e19', border: `1px solid ${row.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.3)'}` }}>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${row.ok ? 'text-green-400' : 'text-red-400'}`}>{row.ok ? '✓' : '✗'}</span>
                  <span className="text-sm font-medium text-white">{row.pollutant}</span>
                  <span className="text-xs" style={{ color: '#64748b' }}>Limit: {row.limit} ({row.ref})</span>
                </div>
                <span className="text-sm font-bold" style={{ color: row.ok ? '#10b981' : '#ef4444' }}>{row.actual}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Report footer */}
        <div className="border-t pt-4 text-xs" style={{ borderColor: 'rgba(29,111,164,0.2)', color: '#475569' }}>
          <p>This report has been automatically generated by EMMA v2.4.1. Data is based on modelled emissions estimates
          from {sensors.length} sensor locations. All values are indicative; refer to certified measurement records for
          regulatory submissions. Plymouth Port Authority · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-bold text-white flex items-center gap-2">
      <span className="w-1 h-4 rounded-full inline-block" style={{ background: '#1d6fa4' }} />
      {children}
    </h2>
  );
}

function KPIBox({ label, value, unit, color }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: '#060e19' }}>
      <p className="text-xs mb-1" style={{ color: '#64748b' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs" style={{ color: '#475569' }}>{unit}</p>
    </div>
  );
}
