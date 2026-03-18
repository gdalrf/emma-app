import { useRef, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  sensors, vessels, pollutants, pollutantColors, pollutantType, pollutantLabel,
  pollutantLimits, sensorReadings, vesselEmissions, getPortKPIs,
} from '../data/mockData';
import { PORT_BASELINE, YOY_TREND, SHORE_POWER_IMPACT } from '../data/investmentData';

export default function ReportGenerator() {
  const [period, setPeriod]       = useState(12);
  const [exporting, setExp]       = useState(false);
  const [fundingExp, setFundingExp] = useState(false);
  const reportRef                 = useRef(null);

  const kpi = getPortKPIs(period);

  // Monthly port-wide aggregates
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
      NO2: +(reads.reduce((a, r) => a + r.NO2, 0) / reads.length).toFixed(1),
      'PM2.5': +(reads.reduce((a, r) => a + r['PM2.5'], 0) / reads.length).toFixed(1),
    };
  }).sort((a, b) => b.NO2 - a.NO2);

  // Pollutant share pie
  const pieData = pollutants.slice(0, 6).map(p => ({
    name: p,
    value: +(months.reduce((a, m) => a + m[p], 0) / months.length).toFixed(2),
  }));

  // Source breakdown chart data (shipping / road / background)
  const sourceBreakdownData = ['NOx', 'NO2', 'PM25', 'PM10', 'SO2'].map(p => ({
    name: p === 'PM25' ? 'PM2.5' : p,
    Shipping:   PORT_BASELINE[p].shipping,
    Road:       PORT_BASELINE[p].road,
    Background: PORT_BASELINE[p].background,
  }));

  async function handleDownloadPDF() {
    setExp(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0a1628', scale: 1.5, useCORS: true, logging: false,
      });
      const img  = canvas.toDataURL('image/png');
      const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
    } catch (err) { console.error(err); }
    setExp(false);
  }

  async function handleFundingPDF() {
    setFundingExp(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
      const W = 210, M = 18;

      // Page 1 — Header
      pdf.setFillColor(6, 14, 25);
      pdf.rect(0, 0, W, 32, 'F');
      pdf.setFillColor(0, 194, 168);
      pdf.rect(0, 0, 4, 32, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text('EMMA — Funding Evidence Pack', M, 13);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Plymouth Port Authority · Baseline Emissions Evidence', M, 22);
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}`, W - M, 22, { align:'right' });

      let y = 45;

      // Intro
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Purpose of this Document', M, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      const intro = `This Evidence Pack provides baseline emissions data for Plymouth Port Authority's funding applications under the UK Shared Prosperity Fund (UKSPF), Clean Maritime Plan, and DEFRA Air Quality Grant schemes. Data is drawn from ${sensors.length} continuously operating sensor stations across Plymouth Harbour.`;
      const introLines = pdf.splitTextToSize(intro, W - M * 2);
      pdf.text(introLines, M, y);
      y += introLines.length * 5 + 10;

      // Section 1 — Source Attribution
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(29, 111, 164);
      pdf.text('1. Baseline Emissions by Source', M, y);
      y += 8;

      // Table header
      pdf.setFillColor(10, 22, 40);
      pdf.rect(M, y, W - M * 2, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const cols = [M + 5, M + 40, M + 80, M + 115, M + 148];
      pdf.text('Pollutant', cols[0], y + 5);
      pdf.text('Shipping (t/yr)', cols[1], y + 5);
      pdf.text('Road (t/yr)', cols[2], y + 5);
      pdf.text('Background (t/yr)', cols[3], y + 5);
      pdf.text('Total (t/yr)', cols[4], y + 5);
      y += 8;

      Object.entries(PORT_BASELINE).forEach(([pollutant, data], i) => {
        pdf.setFillColor(i % 2 === 0 ? 241 : 248, i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 249 : 252);
        pdf.rect(M, y, W - M * 2, 7, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text(pollutant, cols[0], y + 5);
        pdf.setTextColor(29, 111, 164);
        pdf.text(data.shipping.toLocaleString(), cols[1], y + 5);
        pdf.setTextColor(71, 85, 105);
        pdf.text(data.road.toLocaleString(), cols[2], y + 5);
        pdf.text(data.background.toLocaleString(), cols[3], y + 5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        pdf.text(data.total.toLocaleString(), cols[4], y + 5);
        y += 7;
      });

      y += 8;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Source: EMMA sensor network · NAEI shipping inventory · DEFRA road transport model', M, y);

      // Section 2 — YoY Trend
      y += 14;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(29, 111, 164);
      pdf.text('2. Year-on-Year Trend (Index: 2022 = 100)', M, y);
      y += 8;

      // YoY table
      pdf.setFillColor(10, 22, 40);
      pdf.rect(M, y, W - M * 2, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const yCols = [M + 5, M + 35, M + 65, M + 90, M + 115, M + 140];
      ['Year','NOx','NO2','PM2.5','PM10','SO2'].forEach((h, j) => pdf.text(h, yCols[j], y + 5));
      y += 8;

      YOY_TREND.forEach((row, i) => {
        pdf.setFillColor(i % 2 === 0 ? 241 : 248, i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 249 : 252);
        pdf.rect(M, y, W - M * 2, 7, 'F');
        pdf.setFont('helvetica', i === YOY_TREND.length - 1 ? 'bold' : 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text(row.year, yCols[0], y + 5);
        [row.NOx, row.NO2, row.PM25, row.PM10, row.SO2].forEach((v, j) => {
          const trend = v < 100 ? [16, 185, 129] : v > 102 ? [239, 68, 68] : [100, 116, 139];
          pdf.setTextColor(...trend);
          pdf.text(String(v), yCols[j + 1], y + 5);
        });
        y += 7;
      });

      y += 8;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Index 100 = 2022 annual mean. Values <100 indicate improvement.', M, y);

      // Section 3 — Before/After case study
      y += 14;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(29, 111, 164);
      pdf.text('3. Shore Power Intervention — Projected Impact (NOx Index)', M, y);
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      const caseText = 'Modelled scenario based on shore power (cold ironing) installation at Millbay Ferry Terminal. Projected 38–42% reduction in NOx hoteling emissions. Before/after values are indexed relative to January baseline.';
      const caseLines = pdf.splitTextToSize(caseText, W - M * 2);
      pdf.text(caseLines, M, y);
      y += caseLines.length * 5 + 6;

      // Simple before/after table
      pdf.setFillColor(10, 22, 40);
      pdf.rect(M, y, W - M * 2, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      const bCols = [M + 5, M + 40, M + 80, M + 120];
      ['Month', 'Before (index)', 'After (index)', 'Reduction'].forEach((h, j) => pdf.text(h, bCols[j], y + 5));
      y += 8;

      SHORE_POWER_IMPACT.forEach((row, i) => {
        if (i % 3 !== 0) return; // sample every 3rd month to fit
        pdf.setFillColor(i % 2 === 0 ? 241 : 248, i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 249 : 252);
        pdf.rect(M, y, W - M * 2, 7, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text(row.month, bCols[0], y + 5);
        pdf.text(String(row.before), bCols[1], y + 5);
        pdf.setTextColor(16, 185, 129);
        pdf.text(String(row.after), bCols[2], y + 5);
        const reductionPct = (((row.before - row.after) / row.before) * 100).toFixed(0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`-${reductionPct}%`, bCols[3], y + 5);
        y += 7;
      });

      // Footer
      pdf.setFillColor(6, 14, 25);
      pdf.rect(0, 283, W, 14, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.text(
        'EMMA Funding Evidence Pack · Plymouth Port Authority · For external funding submission use · EMMA v2.4.1',
        W / 2, 290, { align: 'center' }
      );

      pdf.save(`EMMA_FundingEvidencePack_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) { console.error(err); }
    setFundingExp(false);
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
          <p className="text-sm" style={{ color:'#64748b' }}>Plymouth Port Authority — Emissions Compliance Report</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border:'1px solid rgba(29,111,164,0.4)' }}>
            {[3, 6, 12].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1.5 text-xs font-medium transition"
                style={{ background: period===p ? '#1d6fa4' : '#0a1628', color: period===p ? '#fff' : '#64748b' }}>
                {p}m
              </button>
            ))}
          </div>
          <button onClick={handleFundingPDF} disabled={fundingExp}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: fundingExp ? '#0a4d3a' : 'rgba(0,194,168,0.2)', border:'1px solid rgba(0,194,168,0.4)', color:'#00c2a8' }}>
            {fundingExp ? '⏳ Generating…' : '📄 Funding Evidence Pack'}
          </button>
          <button onClick={handleDownloadPDF} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: exporting ? '#155880' : '#1d6fa4', boxShadow:'0 4px 12px rgba(29,111,164,0.4)' }}>
            {exporting ? '⏳ Generating…' : '⬇ Download Full PDF'}
          </button>
        </div>
      </div>

      {/* === REPORT BODY === */}
      <div ref={reportRef} className="space-y-6 rounded-xl p-6"
        style={{ background:'#0a1628', border:'1px solid rgba(29,111,164,0.3)' }}>

        {/* Report header */}
        <div className="border-b pb-6" style={{ borderColor:'rgba(29,111,164,0.3)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white"
                  style={{ background:'linear-gradient(135deg, #1d6fa4, #00c2a8)' }}>E</div>
                <div>
                  <p className="text-lg font-bold text-white">EMMA — Emissions Report</p>
                  <p className="text-xs" style={{ color:'#64748b' }}>Plymouth Port Authority</p>
                </div>
              </div>
              <p className="text-sm" style={{ color:'#94a3b8' }}>
                <strong style={{ color:'#fff' }}>Reporting Period:</strong> Last {period} months
              </p>
              <p className="text-sm" style={{ color:'#94a3b8' }}>
                <strong style={{ color:'#fff' }}>Generated:</strong>{' '}
                {new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}
              </p>
              <p className="text-sm" style={{ color:'#94a3b8' }}>
                <strong style={{ color:'#fff' }}>Prepared by:</strong> Harbour Master — Class A Operator
              </p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background:'rgba(0,194,168,0.15)', color:'#00c2a8', border:'1px solid rgba(0,194,168,0.3)' }}>
                DRAFT — CONFIDENTIAL
              </span>
            </div>
          </div>
        </div>

        {/* 1. Executive Summary */}
        <div>
          <SectionTitle>1. Executive Summary</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <KPIBox label="Avg NO₂" value={kpi.avgNO2} unit="µg/m³" color="#f59e0b" />
            <KPIBox label="Avg PM2.5" value={kpi.avgPM25} unit="µg/m³" color="#a78bfa" />
            <KPIBox label="Avg PM10" value={kpi.avgPM10} unit="µg/m³" color="#6366f1" />
            <KPIBox label="Vessels" value={kpi.activeVessels} unit="monitored" color="#8b5cf6" />
          </div>
          <div className="mt-3 p-4 rounded-lg text-sm leading-relaxed" style={{ background:'#060e19', color:'#94a3b8' }}>
            <p>
              This report summarises port-wide emissions data collected across {sensors.length} sensor locations
              at Plymouth Harbour over the {period}-month reporting period. A total of {kpi.activeVessels} vessels
              were tracked, collectively logging {kpi.totalMiles.toLocaleString()} nautical miles. Average NO₂
              concentrations of {kpi.avgNO2} µg/m³ are measured directly at harbour sensors (UK annual mean limit: 40 µg/m³).
              PM2.5 levels of {kpi.avgPM25} µg/m³ are within the WHO interim target of 15 µg/m³.
              SO₂ ({kpi.avgSO2} µg/m³) is a modelled estimate derived from vessel fuel type and activity data.
            </p>
          </div>
        </div>

        {/* 2. Emissions Timeline */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>2. Emissions Timeline — All Sensors</SectionTitle>
            <button onClick={() => downloadChart('chart-timeline', 'Emissions_Timeline')}
              className="text-xs px-2 py-1 rounded transition"
              style={{ color:'#60a5fa', background:'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <div id="chart-timeline" className="mt-3 p-3 rounded-lg" style={{ background:'#060e19' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={months} margin={{ top:4, right:16, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.15)" />
                <XAxis dataKey="label" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0a1628', border:'1px solid #1d6fa4', borderRadius:8, fontSize:11 }} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                {['NO2','NO','PM2.5','PM10'].map(p => (
                  <Line key={p} type="monotone" dataKey={p} name={pollutantLabel[p]}
                    stroke={pollutantColors[p]} strokeWidth={1.8} dot={false}
                    strokeDasharray={pollutantType[p] !== 'measured' ? '5 3' : undefined} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. PM2.5 / PM10 bar chart */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>3. Monthly PM2.5 &amp; PM10 Concentrations</SectionTitle>
            <button onClick={() => downloadChart('chart-pm', 'PM_Monthly')}
              className="text-xs px-2 py-1 rounded transition"
              style={{ color:'#60a5fa', background:'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <div id="chart-pm" className="mt-3 p-3 rounded-lg" style={{ background:'#060e19' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={months} margin={{ top:0, right:8, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.12)" />
                <XAxis dataKey="label" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0a1628', border:'1px solid #a78bfa', borderRadius:6, fontSize:11 }} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                <Bar dataKey="PM2.5" name="PM2.5 (measured)" fill="#a78bfa" radius={[3,3,0,0]} />
                <Bar dataKey="PM10"  name="PM10 (measured)"  fill="#6366f1" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Pollutant mix pie */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>4. Pollutant Distribution</SectionTitle>
            <button onClick={() => downloadChart('chart-pie', 'Pollutant_Distribution')}
              className="text-xs px-2 py-1 rounded transition"
              style={{ color:'#60a5fa', background:'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <div id="chart-pie" className="mt-3 p-3 rounded-lg flex justify-center" style={{ background:'#060e19' }}>
            <PieChart width={380} height={200}>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke:'#64748b' }} fontSize={11}>
                {pieData.map((e, i) => <Cell key={i} fill={pollutantColors[e.name] || '#60a5fa'} />)}
              </Pie>
              <Tooltip contentStyle={{ background:'#0a1628', border:'1px solid #1d6fa4', borderRadius:6, fontSize:11 }} />
            </PieChart>
          </div>
        </div>

        {/* 5. Vessel emissions table */}
        <div>
          <SectionTitle>5. Vessel Emissions Summary</SectionTitle>
          <div className="mt-3 rounded-lg overflow-hidden" style={{ border:'1px solid rgba(29,111,164,0.2)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background:'#060e19' }}>
                  {['Vessel','Type','Flag','Miles (nm)','Avg NO₂ (µg/m³)','Avg PM2.5 (µg/m³)'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color:'#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vesselSummary.map((v, i) => (
                  <tr key={v.name} style={{ background: i%2===0 ? 'transparent' : '#060e1940', borderBottom:'1px solid rgba(29,111,164,0.08)' }}>
                    <td className="px-3 py-2 font-medium text-white">{v.name}</td>
                    <td className="px-3 py-2" style={{ color:'#94a3b8' }}>{vessels[i]?.type}</td>
                    <td className="px-3 py-2 font-mono" style={{ color:'#64748b' }}>{vessels[i]?.flag}</td>
                    <td className="px-3 py-2 font-mono text-right" style={{ color:'#60a5fa' }}>{v.miles.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-right font-bold" style={{ color:'#f59e0b' }}>{v.NO2}</td>
                    <td className="px-3 py-2 font-mono text-right" style={{ color:'#a78bfa' }}>{v['PM2.5']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Regulatory compliance */}
        <div>
          <SectionTitle>6. Regulatory Compliance</SectionTitle>
          <div className="mt-3 space-y-2">
            {[
              { pollutant:'NO₂',   limit:'40 µg/m³',  actual:`${kpi.avgNO2} µg/m³`,  ok: kpi.avgNO2 < 40,   ref:'UK annual mean limit' },
              { pollutant:'PM2.5', limit:'20 µg/m³',  actual:`${kpi.avgPM25} µg/m³`, ok: kpi.avgPM25 < 20,  ref:'UK annual mean limit (2024)' },
              { pollutant:'PM10',  limit:'40 µg/m³',  actual:`${kpi.avgPM10} µg/m³`, ok: kpi.avgPM10 < 40,  ref:'UK annual mean limit' },
              { pollutant:'SO₂ (modelled)', limit:'125 µg/m³', actual:`${kpi.avgSO2} µg/m³`, ok: kpi.avgSO2 < 125, ref:'UK 24-hr mean · MARPOL Annex VI' },
            ].map(row => (
              <div key={row.pollutant} className="flex items-center justify-between rounded-lg px-4 py-2.5"
                style={{ background:'#060e19', border:`1px solid ${row.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.3)'}` }}>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${row.ok ? 'text-green-400' : 'text-red-400'}`}>{row.ok ? '✓' : '✗'}</span>
                  <span className="text-sm font-medium text-white">{row.pollutant}</span>
                  <span className="text-xs" style={{ color:'#64748b' }}>Limit: {row.limit} ({row.ref})</span>
                </div>
                <span className="text-sm font-bold" style={{ color: row.ok ? '#10b981' : '#ef4444' }}>{row.actual}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Baseline Emissions by Source */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>7. Baseline Emissions by Source — Plymouth Port Area</SectionTitle>
            <button onClick={() => downloadChart('chart-source', 'Source_Breakdown')}
              className="text-xs px-2 py-1 rounded transition"
              style={{ color:'#60a5fa', background:'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <p className="text-xs mt-2 mb-3" style={{ color:'#64748b' }}>
            Annual emissions (tonnes/yr) attributed by source sector. Shipping accounts for the majority of NOx and SO₂ in the port area. SO₂ values are modelled estimates.
          </p>
          <div id="chart-source" className="p-3 rounded-lg" style={{ background:'#060e19' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceBreakdownData} margin={{ top:4, right:16, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.12)" />
                <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0a1628', border:'1px solid #1d6fa4', borderRadius:8, fontSize:11 }} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                <Bar dataKey="Shipping"   stackId="a" fill="#1d6fa4"  radius={[0,0,0,0]} />
                <Bar dataKey="Road"       stackId="a" fill="#f59e0b"  radius={[0,0,0,0]} />
                <Bar dataKey="Background" stackId="a" fill="#475569"  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Source breakdown mini table */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {[
              { label:'Shipping', pct:'60–89%', color:'#1d6fa4', note:'Dominant for NOx, SO₂' },
              { label:'Road Traffic', pct:'3–30%', color:'#f59e0b', note:'Dominant for PM2.5' },
              { label:'Background', pct:'8–12%', color:'#475569', note:'Marine aerosol, other' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3" style={{ background:'#060e19', borderLeft:`3px solid ${s.color}` }}>
                <p className="font-semibold text-white mb-0.5">{s.label}</p>
                <p className="font-bold text-lg" style={{ color:s.color }}>{s.pct}</p>
                <p style={{ color:'#64748b' }}>{s.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Year-on-Year Trend */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>8. Year-on-Year Emissions Trend (Index: 2022 = 100)</SectionTitle>
            <button onClick={() => downloadChart('chart-yoy', 'YoY_Trend')}
              className="text-xs px-2 py-1 rounded transition"
              style={{ color:'#60a5fa', background:'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <p className="text-xs mt-2 mb-3" style={{ color:'#64748b' }}>
            Indexed annual means relative to 2022 baseline. Values below 100 indicate year-on-year improvement.
          </p>
          <div id="chart-yoy" className="p-3 rounded-lg" style={{ background:'#060e19' }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={YOY_TREND} margin={{ top:4, right:16, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.12)" />
                <XAxis dataKey="year" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 115]} tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0a1628', border:'1px solid #1d6fa4', borderRadius:8, fontSize:11 }} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                {/* Baseline reference line at 100 */}
                <Line type="monotone" dataKey="NOx"  name="NOx (derived)"    stroke="#ef4444" strokeWidth={2} dot={{ r:3 }} strokeDasharray="5 3" />
                <Line type="monotone" dataKey="NO2"  name="NO₂ (measured)"   stroke="#f59e0b" strokeWidth={2} dot={{ r:3 }} />
                <Line type="monotone" dataKey="PM25" name="PM2.5 (measured)"  stroke="#a78bfa" strokeWidth={2} dot={{ r:3 }} />
                <Line type="monotone" dataKey="SO2"  name="SO₂ (modelled)"   stroke="#60a5fa" strokeWidth={2} dot={{ r:3 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              { label:'NOx 5yr trend', value:'-11 pts', color:'#ef4444' },
              { label:'NO₂ 5yr trend', value:'-13 pts', color:'#f59e0b' },
              { label:'PM2.5 5yr trend', value:'-10 pts', color:'#a78bfa' },
              { label:'SO₂ 5yr trend', value:'-24 pts', color:'#60a5fa' },
            ].map(t => (
              <div key={t.label} className="rounded-lg p-2.5 text-center" style={{ background:'#060e19' }}>
                <p style={{ color:'#64748b' }}>{t.label}</p>
                <p className="font-bold text-sm mt-0.5" style={{ color:t.color }}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 9. Before / After Comparison */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>9. Before / After — Shore Power Intervention (NOx Index)</SectionTitle>
            <button onClick={() => downloadChart('chart-beforeafter', 'Before_After')}
              className="text-xs px-2 py-1 rounded transition"
              style={{ color:'#60a5fa', background:'rgba(29,111,164,0.15)' }}>
              ⬇ PNG
            </button>
          </div>
          <p className="text-xs mt-2 mb-3" style={{ color:'#64748b' }}>
            Modelled impact of shore power installation at Millbay Ferry Terminal. Demonstrates the evidence basis for funding applications.
          </p>
          <div id="chart-beforeafter" className="p-3 rounded-lg" style={{ background:'#060e19' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={SHORE_POWER_IMPACT} margin={{ top:4, right:16, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,111,164,0.12)" />
                <XAxis dataKey="month" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, 110]} tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:'#0a1628', border:'1px solid #1d6fa4', borderRadius:8, fontSize:11 }} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                <Bar dataKey="before" name="Before intervention" fill="rgba(239,68,68,0.7)" radius={[3,3,0,0]} />
                <Bar dataKey="after"  name="After shore power"   fill="rgba(0,194,168,0.7)"  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 p-3 rounded-lg flex items-center gap-4" style={{ background:'rgba(0,194,168,0.07)', border:'1px solid rgba(0,194,168,0.25)' }}>
            <span style={{ fontSize:24, fontWeight:700, color:'#00c2a8' }}>~39%</span>
            <div className="text-xs" style={{ color:'#94a3b8' }}>
              <p className="font-semibold text-white">Projected NOx reduction at Millbay berths</p>
              <p>Based on IVL / Port of Gothenburg cold-ironing reference study · Payback 8 years at £2.8M capital cost</p>
            </div>
          </div>
        </div>

        {/* Report footer */}
        <div className="border-t pt-4 text-xs" style={{ borderColor:'rgba(29,111,164,0.2)', color:'#475569' }}>
          <p>
            This report has been automatically generated by EMMA v2.4.1. Data is based on modelled emissions estimates
            from {sensors.length} sensor locations. All values are indicative; refer to certified measurement records for
            regulatory submissions. Plymouth Port Authority · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-bold text-white flex items-center gap-2">
      <span className="w-1 h-4 rounded-full inline-block" style={{ background:'#1d6fa4' }} />
      {children}
    </h2>
  );
}

function KPIBox({ label, value, unit, color }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background:'#060e19' }}>
      <p className="text-xs mb-1" style={{ color:'#64748b' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs" style={{ color:'#475569' }}>{unit}</p>
    </div>
  );
}
