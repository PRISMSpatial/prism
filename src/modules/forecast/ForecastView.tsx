/* FORECAST — SEIR compartmental model + R(t) fan chart + incidence + scenarios */
import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { useAppStore } from '../../store'
import { usePrismData } from '../../api/PrismDataProvider'
import { useForecastRun } from '../../api/queries'
import { staggerItem } from '../../motion'
import type { ForecastData, IncidenceData, ForecastRunResult, SEIRParams } from '../../types/domain'

type ScenarioId = 'baseline' | 'intervention' | 'surge'

// ─── FanChart ────────────────────────────────────────────────────────────────

function FanChart({ fc }: { fc: ForecastData }) {
  const W = 800, H = 280, PAD_L = 50, PAD_R = 20, PAD_T = 20, PAD_B = 30
  const n = fc.weeks

  const allVals = [...fc.median, ...fc.p95.flatMap(([a, b]) => [a, b])]
  const vMin = Math.max(0, Math.min(...allVals) - 0.1)
  const vMax = Math.max(...allVals) + 0.1

  const xForI = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R)
  const yForV = (v: number) => (H - PAD_B) - ((v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B)

  const medianPts = fc.median.map((v, i) => `${xForI(i)},${yForV(v)}`).join(' ')
  const medianPtsArr = medianPts.split(' ')

  const buildBand = (vs: [number, number][]): string => {
    let lo = '', hi = ''
    for (let i = 0; i < n; i++) { lo += (i ? ' L ' : 'M ') + `${xForI(i)},${yForV(vs[i][0])}` }
    for (let i = n - 1; i >= 0; i--) { hi += ' L ' + `${xForI(i)},${yForV(vs[i][1])}` }
    return lo + hi + ' Z'
  }

  const yTicks = useMemo(() => {
    const range = vMax - vMin
    const step = range > 2 ? 0.5 : range > 1 ? 0.25 : 0.1
    const ticks: number[] = []
    let v = Math.ceil(vMin / step) * step
    while (v <= vMax) { ticks.push(Math.round(v * 100) / 100); v += step }
    return ticks
  }, [vMin, vMax])

  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const bands = el.querySelectorAll('path')
    gsap.fromTo(bands, { opacity: 0 }, { opacity: 1, duration: 0.7, stagger: 0.1, ease: 'power2.out', delay: 0.2 })
    const lines = el.querySelectorAll('polyline')
    lines.forEach(line => {
      const len = line.getTotalLength?.() ?? 400
      gsap.fromTo(line,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', delay: 0.4 },
      )
    })
  }, [fc])

  const nowWeekLabel = `W${String(fc.now + 1).padStart(2, '0')}`

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="fan-svg">
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD_L} y1={yForV(v)} x2={W - PAD_R} y2={yForV(v)} stroke="#1a2430" strokeDasharray="2 3" />
          <text x={PAD_L - 6} y={yForV(v) + 3} textAnchor="end" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">{v.toFixed(1)}</text>
        </g>
      ))}

      {vMin <= 1.0 && vMax >= 1.0 && (
        <>
          <line x1={PAD_L} y1={yForV(1.0)} x2={W - PAD_R} y2={yForV(1.0)} stroke="var(--signal-hot)" strokeWidth="1" strokeDasharray="4 3" opacity=".5" />
          <text x={W - PAD_R - 4} y={yForV(1.0) - 4} textAnchor="end" fill="var(--signal-hot)" fontFamily="JetBrains Mono, monospace" fontSize="9">R=1 critical</text>
        </>
      )}

      <path d={buildBand(fc.p95)} fill="rgba(176,139,255,.12)" />
      <path d={buildBand(fc.p80)} fill="rgba(176,139,255,.22)" />
      <path d={buildBand(fc.p50)} fill="rgba(176,139,255,.36)" />

      <polyline points={medianPtsArr.slice(0, fc.now + 1).join(' ')} fill="none" stroke="var(--signal-phos)" strokeWidth="1.8" />
      <polyline points={medianPtsArr.slice(fc.now).join(' ')} fill="none" stroke="var(--signal-phos)" strokeWidth="1.8" strokeDasharray="4 3" />

      <line x1={xForI(fc.now)} y1={PAD_T} x2={xForI(fc.now)} y2={H - PAD_B} stroke="var(--signal-phos)" strokeWidth="1" opacity=".7" />
      <text x={xForI(fc.now) + 4} y={PAD_T + 10} fill="var(--signal-phos)" fontFamily="JetBrains Mono, monospace" fontSize="10">NOW · {nowWeekLabel}</text>

      {[0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1].map(idx => (
        <g key={idx}>
          <line x1={xForI(idx)} y1={H - PAD_B} x2={xForI(idx)} y2={H - PAD_B + 4} stroke="#48576a" />
          <text x={xForI(idx)} y={H - PAD_B + 15} textAnchor="middle" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">
            W{String(idx + 1).padStart(2, '0')}
          </text>
        </g>
      ))}

      <text x="10" y={H / 2} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9" transform={`rotate(-90 10 ${H / 2})`} letterSpacing="1">EFFECTIVE R(t)</text>

      <g fontFamily="JetBrains Mono, monospace" fontSize="9" transform={`translate(${W - 160} ${PAD_T + 20})`}>
        <rect x="0" y="0" width="10" height="8" fill="rgba(176,139,255,.36)" /><text x="14" y="7" fill="#a6b2c2">50% CI</text>
        <rect x="0" y="12" width="10" height="8" fill="rgba(176,139,255,.22)" /><text x="14" y="19" fill="#a6b2c2">80% CI</text>
        <rect x="0" y="24" width="10" height="8" fill="rgba(176,139,255,.12)" /><text x="14" y="31" fill="#a6b2c2">95% CI</text>
      </g>
    </svg>
  )
}

// ─── IncidenceChart ──────────────────────────────────────────────────────────

function IncidenceChart({ inc, nowIdx }: { inc: IncidenceData; nowIdx: number }) {
  const W = 800, H = 160, PAD_L = 50, PAD_R = 20, PAD_T = 15, PAD_B = 25
  const n = inc.fit.length

  const allVals = [...inc.fit, ...inc.obs.filter((v): v is number => v !== null)]
  const vMax = Math.max(10, Math.ceil(Math.max(...allVals) / 10) * 10)

  const xForI = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R)
  const yForV = (v: number) => (H - PAD_B) - (v / vMax) * (H - PAD_T - PAD_B)

  const fitPts = inc.fit.map((v, i) => `${xForI(i)},${yForV(v)}`).join(' ')
  const fitPtsArr = fitPts.split(' ')

  const yTicks = useMemo(() => {
    const step = vMax > 200 ? 50 : vMax > 100 ? 40 : vMax > 50 ? 20 : 10
    const ticks: number[] = []
    for (let v = 0; v <= vMax; v += step) ticks.push(v)
    return ticks
  }, [vMax])

  const barW = Math.max(4, Math.min(14, (W - PAD_L - PAD_R) / n - 2))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="inc-svg">
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD_L} y1={yForV(v)} x2={W - PAD_R} y2={yForV(v)} stroke="#1a2430" strokeDasharray="2 3" />
          <text x={PAD_L - 6} y={yForV(v) + 3} textAnchor="end" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">{v}</text>
        </g>
      ))}

      {inc.obs.map((v, i) =>
        v !== null ? (
          <rect key={i} x={xForI(i) - barW / 2} y={yForV(v)} width={barW} height={Math.max(0, (H - PAD_B) - yForV(v))} fill="rgba(76,201,240,.6)" />
        ) : null
      )}

      <polyline points={fitPtsArr.slice(0, nowIdx + 2).join(' ')} fill="none" stroke="var(--signal-cool)" strokeWidth="1.8" />
      <polyline points={fitPtsArr.slice(nowIdx + 1).join(' ')} fill="none" stroke="var(--signal-cool)" strokeWidth="1.8" strokeDasharray="3 3" />

      <line x1={xForI(nowIdx)} y1={PAD_T} x2={xForI(nowIdx)} y2={H - PAD_B} stroke="var(--signal-phos)" opacity=".6" />
      <text x="10" y={H / 2} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9" transform={`rotate(-90 10 ${H / 2})`} letterSpacing="1">ILI / 100K</text>
    </svg>
  )
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

interface ScenarioMeta {
  id: ScenarioId
  label: string
  peak: string
  risk: string
}

function Scenarios({ scenario, setScenario, metas }: { scenario: ScenarioId; setScenario: (id: ScenarioId) => void; metas: ScenarioMeta[] }) {
  return (
    <div className="scenarios">
      {metas.map((o, i) => (
        <motion.button
          key={o.id}
          className={'scenario ' + (scenario === o.id ? 'active' : '')}
          onClick={() => setScenario(o.id)}
          variants={staggerItem}
          initial="initial"
          animate="animate"
          transition={{ delay: i * 0.06 }}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="row" style={{ gap: 8 }}>
            <span
              className="scenario-dot"
              style={{
                background:
                  o.id === 'intervention' ? 'var(--signal-phos)'
                  : o.id === 'surge' ? 'var(--signal-hot)'
                  : 'var(--signal-violet)',
              }}
            />
            <span className="scenario-label">{o.label}</span>
          </div>
          <div className="mono mute" style={{ fontSize: 10, marginTop: 6 }}>PEAK {o.peak}</div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              marginTop: 2,
              color:
                o.risk === 'high' ? 'var(--signal-hot)'
                : o.risk === 'low' ? 'var(--signal-phos)'
                : 'var(--signal-warm)',
            }}
          >
            RISK {o.risk.toUpperCase()}
          </div>
        </motion.button>
      ))}
    </div>
  )
}

// ─── SEIRParamsPanel ─────────────────────────────────────────────────────────

function SEIRParamsPanel({ params }: { params: SEIRParams }) {
  const rows = [
    { label: 'R₀ (basic)', value: params.R0.toFixed(3), color: params.R0 > 1 ? 'var(--signal-hot)' : 'var(--signal-phos)' },
    { label: 'β (transmission)', value: params.beta.toFixed(4), color: 'var(--fg)' },
    { label: 'σ (incubation⁻¹)', value: `${params.incubation_days.toFixed(1)}d`, color: 'var(--fg)' },
    { label: 'γ (infectious⁻¹)', value: `${params.infectious_days.toFixed(1)}d`, color: 'var(--fg)' },
    { label: 'I₀ (initial inf.)', value: Math.round(params.I0).toLocaleString(), color: 'var(--fg-dim)' },
    { label: 'E₀ (initial exp.)', value: Math.round(params.E0).toLocaleString(), color: 'var(--fg-dim)' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span className="mute">{r.label}</span>
          <span className="mono" style={{ color: r.color }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── InputPanel ──────────────────────────────────────────────────────────────

function InputPanel({ onRun, isRunning }: { onRun: (data: number[], pop: number, horizon: number) => void; isRunning: boolean }) {
  const [text, setText] = useState('')
  const [population, setPopulation] = useState('1000000')
  const [horizon, setHorizon] = useState('13')

  const parsedCounts = useMemo(() => {
    const lines = text.trim().split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    return lines.map(Number).filter(v => !isNaN(v) && v >= 0)
  }, [text])

  const canRun = parsedCounts.length >= 4 && Number(population) >= 1000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea
        className="mono"
        placeholder={"Weekly case counts\n(one per line or comma-separated)\ne.g. 120, 145, 190, 230..."}
        value={text}
        onChange={e => setText(e.target.value)}
        style={{
          background: 'var(--ink-1)', border: '1px solid var(--line)',
          color: 'var(--fg)', padding: 8, borderRadius: 3, fontSize: 11,
          height: 80, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace',
        }}
      />
      {parsedCounts.length > 0 && (
        <div className="mono mute" style={{ fontSize: 10 }}>
          {parsedCounts.length} weeks parsed
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="caps mute" style={{ fontSize: 9, marginBottom: 4 }}>POPULATION</div>
          <input
            className="mono"
            type="number"
            value={population}
            onChange={e => setPopulation(e.target.value)}
            style={{
              background: 'var(--ink-1)', border: '1px solid var(--line)',
              color: 'var(--fg)', padding: '5px 8px', borderRadius: 3,
              fontSize: 11, width: '100%', fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div className="caps mute" style={{ fontSize: 9, marginBottom: 4 }}>HORIZON (W)</div>
          <input
            className="mono"
            type="number"
            value={horizon}
            onChange={e => setHorizon(e.target.value)}
            min={4} max={52}
            style={{
              background: 'var(--ink-1)', border: '1px solid var(--line)',
              color: 'var(--fg)', padding: '5px 8px', borderRadius: 3,
              fontSize: 11, width: '100%', fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>
      </div>

      <motion.button
        disabled={!canRun || isRunning}
        onClick={() => canRun && onRun(parsedCounts, Number(population), Number(horizon))}
        whileHover={canRun ? { scale: 1.02 } : {}}
        whileTap={canRun ? { scale: 0.98 } : {}}
        style={{
          background: canRun ? 'var(--signal-phos)' : 'var(--ink-3)',
          color: canRun ? '#000' : 'var(--fg-dim)',
          border: 'none', padding: '8px 16px', borderRadius: 3,
          fontSize: 12, fontWeight: 600, cursor: canRun ? 'pointer' : 'not-allowed',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {isRunning ? 'FITTING SEIR MODEL...' : 'RUN SEIR MODEL'}
      </motion.button>
    </div>
  )
}

// ─── DriverPanel (SEIR-based) ────────────────────────────────────────────────

function DriverPanel({ params }: { params: SEIRParams | null }) {
  const selected = useAppStore(s => s.selected)
  const drivers = params
    ? [
        { label: 'Transmission β', pct: Math.min(100, (params.beta / 1.5) * 100), value: params.beta.toFixed(3), color: params.beta > 0.5 ? 'var(--signal-hot)' : 'var(--signal-warm)' },
        { label: 'Recovery γ', pct: Math.min(100, params.gamma * 500), value: `${params.infectious_days.toFixed(1)}d`, color: 'var(--signal-cool)' },
        { label: 'Incubation σ', pct: Math.min(100, params.sigma * 300), value: `${params.incubation_days.toFixed(1)}d`, color: 'var(--signal-warm)' },
        { label: 'Basic R₀', pct: Math.min(100, (params.R0 / 3) * 100), value: params.R0.toFixed(3), color: params.R0 > 1 ? 'var(--signal-hot)' : 'var(--signal-phos)' },
        { label: 'Fit quality', pct: Math.max(5, 100 - Math.min(100, params.fit_loss / 1000)), value: params.fit_loss < 500 ? 'good' : params.fit_loss < 5000 ? 'fair' : 'poor', color: params.fit_loss < 500 ? 'var(--signal-phos)' : params.fit_loss < 5000 ? 'var(--signal-warm)' : 'var(--signal-hot)' },
      ]
    : (() => {
        const sp = selected?.splat
        const cl = selected?.concordanceLayers
        if (!sp || !cl) return []
        const clAvg = (cl.clinical + cl.genomic + cl.wastewater) / 3
        return [
          { label: 'Clade fitness', pct: Math.round(sp.ps * 100), value: (sp.ps >= 0.5 ? '+' : '') + (sp.ps - 0.5).toFixed(2), color: sp.ps > 0.6 ? 'var(--signal-hot)' : 'var(--signal-warm)' },
          { label: 'Mobility', pct: Math.round(sp.tcc * 100), value: (sp.tcc >= 0.5 ? '+' : '') + (sp.tcc - 0.5).toFixed(2), color: sp.tcc > 0.6 ? 'var(--signal-warm)' : 'var(--signal-cool)' },
          { label: 'Wastewater', pct: Math.round(cl.wastewater * 100), value: (cl.wastewater >= 0.5 ? '+' : '') + (cl.wastewater - 0.5).toFixed(2), color: cl.wastewater > 0.7 ? 'var(--signal-hot)' : 'var(--signal-warm)' },
          { label: 'Immunity', pct: Math.round((1 - sp.eti) * 100), value: (sp.eti <= 0.5 ? '+' : '−') + Math.abs(sp.eti - 0.5).toFixed(2), color: sp.eti > 0.5 ? 'var(--signal-cool)' : 'var(--signal-phos)' },
          { label: 'Antigenic drift', pct: Math.round(sp.asMut * 100), value: (sp.asMut >= 0.5 ? '+' : '') + (sp.asMut - 0.5).toFixed(2), color: sp.asMut > 0.5 ? 'var(--signal-warm)' : 'var(--signal-cool)' },
          { label: 'Concordance', pct: Math.round(clAvg * 100), value: clAvg.toFixed(2), color: clAvg > 0.7 ? 'var(--signal-phos)' : clAvg > 0.4 ? 'var(--signal-warm)' : 'var(--signal-hot)' },
        ]
      })()

  return (
    <>
      {drivers.map(d => (
        <div key={d.label} className="driver">
          <span>{d.label}</span>
          <div className="driver-bar"><div style={{ width: `${d.pct}%`, background: d.color }} /></div>
          <span className="mono">{d.value}</span>
        </div>
      ))}
    </>
  )
}

// ─── ForecastView ────────────────────────────────────────────────────────────

export default function ForecastView() {
  const selected = useAppStore(s => s.selected)
  const [scenario, setScenario] = useState<ScenarioId>('baseline')
  const [seirResult, setSeirResult] = useState<ForecastRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const PRISM_DATA = usePrismData()

  const forecastRun = useForecastRun()

  const handleRun = (data: number[], pop: number, horizon: number) => {
    setError(null)
    forecastRun.mutate(
      { observed_weekly: data, population: pop, horizon_weeks: horizon, n_draws: 200 },
      {
        onSuccess: (result) => {
          setSeirResult(result)
          setScenario('baseline')
        },
        onError: (err: any) => {
          setError(err?.response?.data?.detail || err?.message || 'Model fitting failed')
        },
      },
    )
  }

  const activeScenario = seirResult?.scenarios[scenario]
  const fc: ForecastData = activeScenario?.forecast ?? PRISM_DATA.forecast
  const inc: IncidenceData = activeScenario?.incidence ?? PRISM_DATA.incidence
  const nowIdx = fc.now

  const scenarioMetas: ScenarioMeta[] = useMemo(() => {
    const weekLabel = (w: number) => `W${String(w + 1).padStart(2, '0')}`
    const riskFromPeak = (peak: number) => peak > 100 ? 'high' : peak > 50 ? 'moderate' : 'low'

    if (seirResult) {
      const s = seirResult.scenarios
      return [
        { id: 'baseline' as const, label: 'Baseline · no intervention', peak: `${s.baseline?.peak_incidence?.toFixed(0) ?? '?'} / 100k · ${weekLabel(s.baseline?.peak_week ?? 0)}`, risk: riskFromPeak(s.baseline?.peak_incidence ?? 0) },
        { id: 'intervention' as const, label: 'Intervention · β×0.80', peak: `${s.intervention?.peak_incidence?.toFixed(0) ?? '?'} / 100k · ${weekLabel(s.intervention?.peak_week ?? 0)}`, risk: riskFromPeak(s.intervention?.peak_incidence ?? 0) },
        { id: 'surge' as const, label: 'Surge · β×1.20', peak: `${s.surge?.peak_incidence?.toFixed(0) ?? '?'} / 100k · ${weekLabel(s.surge?.peak_week ?? 0)}`, risk: riskFromPeak(s.surge?.peak_incidence ?? 0) },
      ]
    }

    const peakInc = Math.max(...PRISM_DATA.incidence.fit)
    const peakWeek = PRISM_DATA.incidence.fit.indexOf(peakInc)
    const intPeak = Math.round(peakInc * 0.7)
    const surgePeak = Math.round(peakInc * 1.35)
    return [
      { id: 'baseline' as const, label: 'Baseline · no action', peak: `${Math.round(peakInc)} ILI / 100k · ${weekLabel(peakWeek)}`, risk: riskFromPeak(peakInc) },
      { id: 'intervention' as const, label: 'Intervention · antivirals + nudge', peak: `${intPeak} ILI / 100k · ${weekLabel(Math.max(0, peakWeek - 2))}`, risk: riskFromPeak(intPeak) },
      { id: 'surge' as const, label: 'Surge · no response', peak: `${surgePeak} ILI / 100k · ${weekLabel(Math.min(PRISM_DATA.incidence.fit.length - 1, peakWeek + 1))}`, risk: riskFromPeak(surgePeak) },
    ]
  }, [seirResult, PRISM_DATA.incidence.fit])

  const modelLabel = seirResult
    ? `SEIR · ${seirResult.scenarios.baseline?.valid_draws ?? 500}-draw ensemble · ${seirResult.horizon}W horizon`
    : `episplat-v3.1 · ensemble · ${PRISM_DATA.forecast.weeks}W horizon`

  const backtestMae = useMemo(() => {
    const obs = PRISM_DATA.incidence.obs
    const fit = PRISM_DATA.incidence.fit
    let sum = 0, count = 0
    for (let i = 0; i < obs.length; i++) {
      if (obs[i] !== null) { sum += Math.abs(obs[i]! - fit[i]); count++ }
    }
    return count > 0 ? sum / count : 0
  }, [PRISM_DATA.incidence])

  const maeLabel = seirResult
    ? `SEIR fit loss ${seirResult.params.fit_loss.toFixed(0)} · R₀ = ${seirResult.params.R0.toFixed(3)}`
    : `backtest MAE ${backtestMae.toFixed(2)}`

  return (
    <div className="forecast-view">
      <div className="panel" style={{ gridArea: 'fan' }}>
        <div className="panel-head">
          <span className="title"><b>FORECAST</b>  /  R(t) · {modelLabel}</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>model · {maeLabel}</span>
        </div>
        <div className="panel-body flush" style={{ padding: 14 }}>
          <FanChart fc={fc} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'inc' }}>
        <div className="panel-head">
          <span className="title"><b>INCIDENCE</b>  /  ILI per 100k · {selected?.iso ?? 'global'}</span>
        </div>
        <div className="panel-body flush" style={{ padding: 14 }}>
          <IncidenceChart inc={inc} nowIdx={nowIdx} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'scen' }}>
        <div className="panel-head">
          <span className="title"><b>{seirResult ? 'SEIR MODEL' : 'SCENARIOS'}</b>  /  {seirResult ? 'fit + project' : 'counterfactual branches'}</span>
        </div>
        <div className="panel-body" style={{ overflow: 'auto' }}>
          {!seirResult && (
            <>
              <div className="caps mute" style={{ marginBottom: 8 }}>Fit SEIR model</div>
              <InputPanel onRun={handleRun} isRunning={forecastRun.isPending} />
              {error && (
                <div className="mono" style={{ fontSize: 10, color: 'var(--signal-hot)', marginTop: 8 }}>{error}</div>
              )}
              <div style={{ borderTop: '1px solid var(--line-soft)', margin: '14px 0 10px' }} />
            </>
          )}

          {seirResult && (
            <>
              <div className="caps mute" style={{ marginBottom: 8 }}>Fitted Parameters</div>
              <SEIRParamsPanel params={seirResult.params} />
              <div style={{ borderTop: '1px solid var(--line-soft)', margin: '12px 0 10px' }} />
            </>
          )}

          <div className="caps mute" style={{ marginBottom: 10 }}>Scenarios</div>
          <Scenarios scenario={scenario} setScenario={setScenario} metas={scenarioMetas} />

          <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
            <div className="caps mute" style={{ marginBottom: 10 }}>{seirResult ? 'Model Parameters' : 'Drivers'}</div>
            <DriverPanel params={seirResult?.params ?? null} />
          </div>

          {seirResult && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
              <button
                className="mono mute"
                style={{
                  fontSize: 10, background: 'none', border: '1px solid var(--line)',
                  padding: '5px 10px', borderRadius: 3, cursor: 'pointer', color: 'var(--fg-dim)',
                }}
                onClick={() => { setSeirResult(null); setError(null) }}
              >
                RESET · return to demo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
