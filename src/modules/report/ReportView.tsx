import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePrismData } from '../../api/PrismDataProvider'
import { useReportGenerate, useReportHistory, useReport, downloadReportExport } from '../../api/queries'
import type {
  ReportData, ReportForecastBlock, ReportPhyloBlock,
  ReportVirsiftBlock, ReportActionItem, ReportAnomalyRow,
} from '../../types/domain'

// ─── FanChart (inline SVG, uses forecast block data) ─────────────────────────

function ReportFanChart({ forecast }: { forecast: ReportForecastBlock }) {
  const PRISM_DATA = usePrismData()
  const fc = forecast.rt_median ? {
    median: forecast.rt_median,
    p50: forecast.rt_p50 as [number, number][],
    p80: forecast.rt_p80 as [number, number][],
    p95: forecast.rt_p95 as [number, number][],
    now: forecast.rt_now ?? 0,
  } : PRISM_DATA.forecast

  const W = 560, H = 120
  const pad = { l: 30, r: 10, t: 10, b: 20 }
  const n = fc.median.length
  if (n === 0) return null
  const yMax = 1.8, yMin = -0.5
  const xScale = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r)
  const yScale = (v: number) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b)

  const polyPts = (arr: [number, number][], dir: 'top' | 'bot') =>
    arr.map((v, i) => `${xScale(i)},${yScale(dir === 'top' ? v[1] : v[0])}`).join(' ')
  const medianPath = fc.median.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`).join(' ')
  const nowX = xScale(fc.now)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', height: H }}>
      <polygon points={`${polyPts(fc.p95, 'top')} ${polyPts([...fc.p95].reverse(), 'bot')}`} fill="rgba(158,242,119,.07)" />
      <polygon points={`${polyPts(fc.p80, 'top')} ${polyPts([...fc.p80].reverse(), 'bot')}`} fill="rgba(158,242,119,.11)" />
      <polygon points={`${polyPts(fc.p50, 'top')} ${polyPts([...fc.p50].reverse(), 'bot')}`} fill="rgba(158,242,119,.18)" />
      <path d={medianPath} fill="none" stroke="var(--signal-phos)" strokeWidth="1.5" strokeDasharray={`${(nowX - 30)} 0 0 1000`} />
      <line x1={nowX} y1={pad.t} x2={nowX} y2={H - pad.b} stroke="rgba(255,255,255,.2)" strokeWidth="1" />
      <text x={nowX + 3} y={pad.t + 8} fill="rgba(255,255,255,.4)" fontSize="8" fontFamily="JetBrains Mono">NOW</text>
      <line x1={pad.l} y1={yScale(1)} x2={W - pad.r} y2={yScale(1)} stroke="rgba(255,107,74,.3)" strokeWidth="0.5" strokeDasharray="3 3" />
      {forecast.has_seir && (
        <text x={W - pad.r - 2} y={H - pad.b - 4} fill="rgba(158,242,119,.4)" fontSize="7" fontFamily="JetBrains Mono" textAnchor="end">
          SEIR R₀={forecast.seir_r0?.toFixed(2)}
        </text>
      )}
    </svg>
  )
}

// ─── Report Sections ─────────────────────────────────────────────────────────

function MetricsSection({ report, sectionNum }: { report: ReportData; sectionNum: string }) {
  return (
    <div className="paper-section">
      <div className="paper-section-num">{sectionNum}</div>
      <div>
        <h2>At a glance</h2>
        <div className="paper-metrics" style={{ gridTemplateColumns: `repeat(${Math.min(report.metrics.length, 5)}, 1fr)` }}>
          {report.metrics.slice(0, 5).map(m => (
            <div key={m.label}>
              <div className="caps-serif">{m.label}</div>
              <div className="paper-metric-val" style={{ fontSize: m.value.length > 6 ? 20 : 30 }}>
                {m.value}{m.unit && <span>{m.unit}</span>}
              </div>
            </div>
          ))}
        </div>
        {report.metrics.length > 5 && (
          <div className="paper-metrics" style={{ gridTemplateColumns: `repeat(${report.metrics.length - 5}, 1fr)`, marginTop: 12 }}>
            {report.metrics.slice(5).map(m => (
              <div key={m.label}>
                <div className="caps-serif">{m.label}</div>
                <div className="paper-metric-val" style={{ fontSize: m.value.length > 6 ? 20 : 30 }}>
                  {m.value}{m.unit && <span>{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EvidenceBody({ text }: { text: string }) {
  const parts = text.split(/(\b\d+\.\d+\b|\b[A-Z]\d+[A-Z]\b)/)
  return (
    <div className="paper-ev-body">
      {parts.map((p, i) =>
        /^\d+\.\d+$/.test(p) || /^[A-Z]\d+[A-Z]$/.test(p)
          ? <span key={i} className="mono">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </div>
  )
}

function EvidenceSection({ report, sectionNum }: { report: ReportData; sectionNum: string }) {
  const kindIcon: Record<string, string> = {
    clinical: '🏥', genomic: '🧬', wastewater: '💧', mobility: '✈️', avian: '🐦',
  }
  return (
    <div className="paper-section">
      <div className="paper-section-num">{sectionNum}</div>
      <div>
        <h2>Evidence</h2>
        <div className="paper-evidence">
          {report.evidence.map((ev, i) => (
            <div key={i} className="paper-ev-row">
              <div className="paper-ev-src">{kindIcon[ev.kind] || '📊'} {ev.source}</div>
              <EvidenceBody text={ev.body} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ForecastSection({ report, sectionNum }: { report: ReportData; sectionNum: string }) {
  const fc = report.forecast
  if (!fc) return null
  return (
    <div className="paper-section">
      <div className="paper-section-num">{sectionNum}</div>
      <div>
        <h2>Forecast · {fc.horizon_weeks}-week horizon</h2>
        <div className="paper-forecast">
          <ReportFanChart forecast={fc} />
        </div>
        <div className="paper-note">
          Current R(t) median: <span className="mono">{fc.current_rt_median.toFixed(2)}</span> ·
          95% CI: <span className="mono">[{fc.current_rt_ci[0]?.toFixed(2)}, {fc.current_rt_ci[1]?.toFixed(2)}]</span>
          {fc.crossover_week && <> · R=1 crossover at <span className="mono">{fc.crossover_week}</span></>}
        </div>
        {(fc.peak_incidence_baseline > 0 || fc.peak_incidence_surge > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 14 }}>
            <div style={{ borderTop: '2px solid #74684c', paddingTop: 8 }}>
              <div className="caps-serif" style={{ marginBottom: 4 }}>Baseline</div>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: 22 }}>
                Peak {fc.peak_incidence_baseline.toFixed(0)}
              </div>
              <div className="paper-note">at {fc.peak_week}</div>
            </div>
            <div style={{ borderTop: '2px solid #b5423a', paddingTop: 8 }}>
              <div className="caps-serif" style={{ marginBottom: 4 }}>Surge</div>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: 22, color: '#b5423a' }}>
                Peak {fc.peak_incidence_surge.toFixed(0)}
              </div>
              <div className="paper-note">+20% transmission</div>
            </div>
            <div style={{ borderTop: '2px solid #4a8f5e', paddingTop: 8 }}>
              <div className="caps-serif" style={{ marginBottom: 4 }}>Intervention</div>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: 22, color: '#4a8f5e' }}>
                Peak {fc.peak_incidence_intervention.toFixed(0)}
              </div>
              <div className="paper-note">−20% transmission</div>
            </div>
          </div>
        )}
        {fc.has_seir && fc.seir_r0 && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,0,0,.03)', borderRadius: 2 }}>
            <div className="caps-serif" style={{ marginBottom: 6 }}>SEIR Model Parameters</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
              <div>R₀ = <b>{fc.seir_r0.toFixed(3)}</b></div>
              <div>β = <b>{fc.seir_beta?.toFixed(4)}</b></div>
              <div>σ = <b>{fc.seir_sigma?.toFixed(4)}</b> ({(1 / (fc.seir_sigma || 1)).toFixed(1)}d inc.)</div>
              <div>γ = <b>{fc.seir_gamma?.toFixed(4)}</b> ({(1 / (fc.seir_gamma || 1)).toFixed(1)}d inf.)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PhyloSection({ phylo, sectionNum }: { phylo: ReportPhyloBlock; sectionNum: string }) {
  return (
    <div className="paper-section">
      <div className="paper-section-num">{sectionNum}</div>
      <div>
        <h2>Phylogenetic context</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={{ borderTop: '1px solid #b5ae9e', paddingTop: 8 }}>
            <div className="caps-serif">Clade</div>
            <div className="paper-metric-val" style={{ fontSize: 20 }}>{phylo.clade}</div>
          </div>
          <div style={{ borderTop: '1px solid #b5ae9e', paddingTop: 8 }}>
            <div className="caps-serif">Fitness</div>
            <div className="paper-metric-val" style={{ fontSize: 26, color: phylo.fitness > 0.1 ? '#b5423a' : '#1a1a17' }}>
              {phylo.fitness > 0 ? '+' : ''}{phylo.fitness.toFixed(2)}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #b5ae9e', paddingTop: 8 }}>
            <div className="caps-serif">Sequences</div>
            <div className="paper-metric-val" style={{ fontSize: 26 }}>{phylo.n_sequences}</div>
          </div>
          <div style={{ borderTop: '1px solid #b5ae9e', paddingTop: 8 }}>
            <div className="caps-serif">Origin</div>
            <div className="paper-metric-val" style={{ fontSize: 20 }}>{phylo.origin}</div>
          </div>
        </div>
        {phylo.mutations.length > 0 && (
          <div className="paper-body-text">
            High-impact HA mutations: {phylo.mutations.map((m, i) => (
              <span key={i}><span className="mono">{m}</span>{i < phylo.mutations.length - 1 ? ', ' : '.'}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VirsiftSection({ virsift, sectionNum }: { virsift: ReportVirsiftBlock; sectionNum: string }) {
  const topEntries = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 4)

  return (
    <div className="paper-section">
      <div className="paper-section-num">{sectionNum}</div>
      <div>
        <h2>Dataset summary (VirSift)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={{ borderTop: '1px solid #b5ae9e', paddingTop: 8 }}>
            <div className="caps-serif">Source</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, marginTop: 4 }}>{virsift.filename}</div>
          </div>
          <div style={{ borderTop: '1px solid #b5ae9e', paddingTop: 8 }}>
            <div className="caps-serif">Sequences Active</div>
            <div className="paper-metric-val" style={{ fontSize: 26 }}>{virsift.sequences_active.toLocaleString()}</div>
          </div>
          <div style={{ borderTop: '1px solid #b5ae9e', paddingTop: 8 }}>
            <div className="caps-serif">Header Variant</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, marginTop: 4 }}>{virsift.header_variant}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div className="caps-serif" style={{ marginBottom: 6 }}>Top subtypes</div>
            {topEntries(virsift.subtypes).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '2px 0' }}>
                <span>{k}</span><b>{v.toLocaleString()}</b>
              </div>
            ))}
          </div>
          <div>
            <div className="caps-serif" style={{ marginBottom: 6 }}>Top segments</div>
            {topEntries(virsift.segments).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '2px 0' }}>
                <span>{k}</span><b>{v.toLocaleString()}</b>
              </div>
            ))}
          </div>
        </div>
        {virsift.date_range[0] && (
          <div className="paper-note" style={{ marginTop: 8 }}>
            Date range: <span className="mono">{virsift.date_range[0]}</span> → <span className="mono">{virsift.date_range[1]}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function AnomaliesSection({ anomalies, sectionNum }: { anomalies: ReportAnomalyRow[]; sectionNum: string }) {
  if (anomalies.length === 0) return null
  const tierColor: Record<string, string> = { T3: '#b5423a', T2: '#d4a843', T1: '#4a8f5e', T0: '#74684c' }
  return (
    <div className="paper-section">
      <div className="paper-section-num">{sectionNum}</div>
      <div>
        <h2>Active anomalies</h2>
        <div className="paper-evidence">
          {anomalies.map(a => (
            <div key={a.id} className="paper-ev-row">
              <div className="paper-ev-src" style={{ color: tierColor[a.tier] || '#74684c' }}>
                [{a.tier}] {a.status}
              </div>
              <div className="paper-ev-body">
                <b>{a.title}</b> — score <span className="mono">{(a.score * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActionsSection({ actions, sectionNum }: { actions: ReportActionItem[]; sectionNum: string }) {
  const priorityColor: Record<string, string> = { high: '#b5423a', normal: '#1a1a17', low: '#74684c' }
  return (
    <div className="paper-section">
      <div className="paper-section-num">{sectionNum}</div>
      <div>
        <h2>Recommended actions</h2>
        <ol className="paper-actions">
          {actions.map((a, i) => (
            <li key={i} style={{ color: priorityColor[a.priority] || '#1a1a17' }}>
              <b>{a.verb}</b> {a.body}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ─── Config Sidebar ──────────────────────────────────────────────────────────

function ConfigSidebar({
  regionId, setRegionId,
  reportType, setReportType,
  forecastSessionId, setForecastSessionId,
  virsiftSessionId, setVirsiftSessionId,
  onGenerate, generating,
  onLoadReport,
  currentReportId,
}: {
  regionId: string; setRegionId: (v: string) => void
  reportType: string; setReportType: (v: string) => void
  forecastSessionId: string; setForecastSessionId: (v: string) => void
  virsiftSessionId: string; setVirsiftSessionId: (v: string) => void
  onGenerate: () => void; generating: boolean
  onLoadReport: (reportId: string) => void
  currentReportId: string | null
}) {
  const PRISM_DATA = usePrismData()
  const history = useReportHistory()

  return (
    <div style={{
      width: 280, flexShrink: 0, padding: '20px 16px',
      background: 'var(--ink-1)', borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
    }}>
      <div className="mono" style={{ fontSize: 13, color: 'var(--signal-phos)', fontWeight: 600 }}>
        REPORT GENERATOR
      </div>

      <div>
        <label className="mono mute caps" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>Region</label>
        <select value={regionId} onChange={e => setRegionId(e.target.value)} style={{
          width: '100%', background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line)',
          padding: '6px 8px', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 3,
        }}>
          {PRISM_DATA.regions.map(r => (
            <option key={r.id} value={r.id}>{r.name} · {r.iso} · {r.tier}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mono mute caps" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>Report Type</label>
        <select value={reportType} onChange={e => setReportType(e.target.value)} style={{
          width: '100%', background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line)',
          padding: '6px 8px', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 3,
        }}>
          <option value="sitrep">Situation Report (SITREP)</option>
          <option value="weekly">Weekly Bulletin</option>
          <option value="outbreak">Outbreak Summary</option>
        </select>
      </div>

      <div>
        <label className="mono mute caps" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>
          Forecast Session ID <span style={{ opacity: 0.5 }}>(optional)</span>
        </label>
        <input value={forecastSessionId} onChange={e => setForecastSessionId(e.target.value)}
          placeholder="from SEIR module..."
          style={{
            width: '100%', background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line)',
            padding: '6px 8px', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 3, boxSizing: 'border-box',
          }} />
      </div>

      <div>
        <label className="mono mute caps" style={{ fontSize: 9, display: 'block', marginBottom: 4 }}>
          VirSift Session ID <span style={{ opacity: 0.5 }}>(optional)</span>
        </label>
        <input value={virsiftSessionId} onChange={e => setVirsiftSessionId(e.target.value)}
          placeholder="from VirSift module..."
          style={{
            width: '100%', background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line)',
            padding: '6px 8px', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 3, boxSizing: 'border-box',
          }} />
      </div>

      <button onClick={onGenerate} disabled={generating || !regionId} style={{
        width: '100%', padding: '10px 0',
        background: generating ? 'var(--ink-2)' : 'var(--signal-phos)',
        color: generating ? 'var(--fg-dim)' : '#000',
        border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600,
        fontFamily: 'var(--mono)', cursor: generating ? 'wait' : 'pointer',
      }}>
        {generating ? 'Generating...' : 'Generate Report'}
      </button>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
        <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 8 }}>EXPORT</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost" style={{ fontSize: 9, flex: 1 }} disabled={!currentReportId}
            onClick={() => currentReportId && downloadReportExport(currentReportId, 'csv')}>CSV</button>
          <button className="btn ghost" style={{ fontSize: 9, flex: 1 }} disabled={!currentReportId}
            onClick={() => currentReportId && downloadReportExport(currentReportId, 'json')}>JSON</button>
        </div>
      </div>

      {history.data && history.data.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
          <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 8 }}>RECENT REPORTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.data.slice(0, 5).map(h => (
              <div key={h.report_id} onClick={() => onLoadReport(h.report_id)} style={{
                padding: '6px 8px', background: 'var(--ink-2)', borderRadius: 2,
                fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer',
              }}>
                <div style={{ color: 'var(--fg)', marginBottom: 2 }}>{h.region_name}</div>
                <div className="mute">{h.report_type} · {h.tier} · {new Date(h.generated_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ReportView ──────────────────────────────────────────────────────────────

export default function ReportView() {
  const PRISM_DATA = usePrismData()
  const qc = useQueryClient()
  const generateMut = useReportGenerate()

  const [regionId, setRegionId] = useState(PRISM_DATA.regions[0]?.id ?? '')
  const [reportType, setReportType] = useState('sitrep')
  const [forecastSessionId, setForecastSessionId] = useState('')
  const [virsiftSessionId, setVirsiftSessionId] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null)
  const loadedReport = useReport(loadingReportId)

  const handleGenerate = async () => {
    const result = await generateMut.mutateAsync({
      region_id: regionId,
      report_type: reportType,
      forecast_session_id: forecastSessionId || undefined,
      virsift_session_id: virsiftSessionId || undefined,
    })
    setLoadingReportId(null)
    setReport(result)
    qc.invalidateQueries({ queryKey: ['report-history'] })
  }

  const handleLoadReport = (reportId: string) => {
    setLoadingReportId(reportId)
  }

  const displayReport = loadingReportId && loadedReport.data ? loadedReport.data : report

  const reportTypeLabel: Record<string, string> = {
    sitrep: 'Situation Report',
    weekly: 'Weekly Bulletin',
    outbreak: 'Outbreak Summary',
  }

  const hasPhylo = displayReport?.phylo != null
  const hasVirsift = displayReport?.virsift != null
  const hasAnomalies = (displayReport?.anomalies.length ?? 0) > 0

  const sn = (() => {
    let n = 1
    const next = () => String(n++).padStart(2, '0')
    return {
      metrics: next(),
      evidence: next(),
      forecast: displayReport?.forecast ? next() : '',
      phylo: hasPhylo ? next() : '',
      virsift: hasVirsift ? next() : '',
      anomalies: hasAnomalies ? next() : '',
      actions: next(),
      assessment: next(),
    }
  })()

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <ConfigSidebar
        regionId={regionId} setRegionId={setRegionId}
        reportType={reportType} setReportType={setReportType}
        forecastSessionId={forecastSessionId} setForecastSessionId={setForecastSessionId}
        virsiftSessionId={virsiftSessionId} setVirsiftSessionId={setVirsiftSessionId}
        onGenerate={handleGenerate} generating={generateMut.isPending}
        onLoadReport={handleLoadReport}
        currentReportId={displayReport?.report_id ?? null}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px', background: 'var(--bg)' }}>
        {generateMut.isError && (
          <div style={{ padding: 16, marginBottom: 20, background: 'rgba(255,107,74,.1)', borderRadius: 3, color: 'var(--signal-hot)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            Error: {(generateMut.error as Error).message}
          </div>
        )}

        {!displayReport ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', gap: 16 }}>
            <div className="mono" style={{ fontSize: 16, color: 'var(--fg-dim)' }}>No report generated yet</div>
            <div className="mono mute" style={{ fontSize: 11, maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
              Select a region from the sidebar and click Generate Report.
              The report will compile data from all active PRISM modules —
              surveillance metrics, forecast model outputs, phylogenetic context,
              and VirSift dataset summaries.
            </div>
          </div>
        ) : (
          <div className="paper-root">
            <div className="paper-header">
              <div className="paper-stamp">{displayReport.classification} · {displayReport.tier}</div>
              <div className="paper-meta">
                <div>{reportTypeLabel[displayReport.report_type] || displayReport.report_type} № <b>{displayReport.report_id}</b></div>
                <div>{new Date(displayReport.generated_at).toISOString().replace('T', ' · ').slice(0, 22)} UTC</div>
              </div>
            </div>

            <div className="paper-title">
              <div className="paper-kicker">{reportTypeLabel[displayReport.report_type] || displayReport.report_type}</div>
              <h1>{displayReport.region_name} · {displayReport.pathogen} · clade {displayReport.clade}</h1>
              <div className="paper-subtitle">{displayReport.subtitle}</div>
            </div>

            <div className="paper-pullquote">
              <div className="paper-pq-mark">&#10077;</div>
              <div className="paper-pq-body">{displayReport.pullquote}</div>
            </div>

            <MetricsSection report={displayReport} sectionNum={sn.metrics} />
            <EvidenceSection report={displayReport} sectionNum={sn.evidence} />
            <ForecastSection report={displayReport} sectionNum={sn.forecast} />
            {hasPhylo && <PhyloSection phylo={displayReport.phylo!} sectionNum={sn.phylo} />}
            {hasVirsift && <VirsiftSection virsift={displayReport.virsift!} sectionNum={sn.virsift} />}
            {hasAnomalies && <AnomaliesSection anomalies={displayReport.anomalies} sectionNum={sn.anomalies} />}
            <ActionsSection actions={displayReport.actions} sectionNum={sn.actions} />

            <div className="paper-section">
              <div className="paper-section-num">{sn.assessment}</div>
              <div>
                <h2>Assessment</h2>
                <p className="paper-body-text">
                  {displayReport.region_name} ({displayReport.country}) is currently classified at <b>{displayReport.tier}</b> with
                  multi-stream concordance at <b>{displayReport.confidence.toFixed(2)}</b>.
                  {displayReport.forecast?.has_seir && (
                    <> The SEIR model fitted R₀ of <span className="mono">{displayReport.forecast.seir_r0?.toFixed(3)}</span>,
                    consistent with {displayReport.forecast.seir_r0! > 1.2 ? 'active epidemic growth' : displayReport.forecast.seir_r0! > 1.0 ? 'marginal transmission increase' : 'sub-epidemic transmission'}.</>
                  )}
                  {displayReport.phylo && displayReport.phylo.fitness > 0.1 && (
                    <> Clade <span className="mono">{displayReport.phylo.clade}</span> shows a fitness advantage of +{displayReport.phylo.fitness.toFixed(2)}, warranting continued genomic surveillance.</>
                  )}
                </p>
              </div>
            </div>

            <div className="paper-footer">
              <div>PRISM · EpiSplat v3.1 · confidence {displayReport.confidence.toFixed(2)}</div>
              <div>{displayReport.analyst}</div>
              <div>{displayReport.report_id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
