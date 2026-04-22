/* FORECAST — R(t) fan chart + incidence + scenario builder */
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { useAppStore } from '../../store'
import { PRISM_DATA } from '../../data/mock'
import { staggerItem } from '../../motion'

// ─── types ───────────────────────────────────────────────────────────────────

type ScenarioId = 'baseline' | 'intervention' | 'surge'

// ─── FanChart ────────────────────────────────────────────────────────────────

interface FanChartProps {
  scenario: ScenarioId
}

function FanChart({ scenario }: FanChartProps) {
  const fc = PRISM_DATA.forecast
  const W = 800, H = 280, PAD_L = 50, PAD_R = 20, PAD_T = 20, PAD_B = 30
  const n = fc.weeks

  const xForI = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R)
  const yForV = (v: number) => {
    const vMin = 0.3, vMax = 2.0
    return (H - PAD_B) - ((v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B)
  }

  const adjust = (v: number): number => {
    if (scenario === 'baseline') return v
    if (scenario === 'intervention') return v * 0.82
    if (scenario === 'surge') return v * 1.15
    return v
  }

  const medianPts = fc.median
    .map((v, i) => `${xForI(i)},${yForV(i >= fc.now ? adjust(v) : v)}`)
    .join(' ')

  const band = (vs: [number, number][], i: number) =>
    `${xForI(i)},${yForV(i >= fc.now ? adjust(vs[i][0]) : vs[i][0])}`
  const bandRev = (vs: [number, number][], i: number) =>
    `${xForI(i)},${yForV(i >= fc.now ? adjust(vs[i][1]) : vs[i][1])}`

  const buildBand = (vs: [number, number][]): string => {
    let lo = '', hi = ''
    for (let i = 0; i < n; i++) { lo += (i ? ' L ' : 'M ') + band(vs, i) }
    for (let i = n - 1; i >= 0; i--) { hi += ' L ' + bandRev(vs, i) }
    return lo + hi + ' Z'
  }

  const medianPtsArr = medianPts.split(' ')

  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    // Fade in CI bands
    const bands = el.querySelectorAll('path')
    gsap.fromTo(bands, { opacity: 0 }, { opacity: 1, duration: 0.7, stagger: 0.1, ease: 'power2.out', delay: 0.2 })
    // Draw-on median polylines
    const lines = el.querySelectorAll('polyline')
    lines.forEach(line => {
      const len = line.getTotalLength?.() ?? 400
      gsap.fromTo(line,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', delay: 0.4 },
      )
    })
  }, [scenario])

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="fan-svg">
      {/* Grid */}
      {[0.5, 1.0, 1.5, 2.0].map(v => (
        <g key={v}>
          <line x1={PAD_L} y1={yForV(v)} x2={W - PAD_R} y2={yForV(v)} stroke="#1a2430" strokeDasharray="2 3" />
          <text x={PAD_L - 6} y={yForV(v) + 3} textAnchor="end" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">{v.toFixed(1)}</text>
        </g>
      ))}

      {/* R=1 critical */}
      <line x1={PAD_L} y1={yForV(1.0)} x2={W - PAD_R} y2={yForV(1.0)} stroke="var(--signal-hot)" strokeWidth="1" strokeDasharray="4 3" opacity=".5" />
      <text x={W - PAD_R - 4} y={yForV(1.0) - 4} textAnchor="end" fill="var(--signal-hot)" fontFamily="JetBrains Mono, monospace" fontSize="9">R=1 critical</text>

      {/* 95 band */}
      <path d={buildBand(fc.p95)} fill="rgba(176,139,255,.12)" />
      {/* 80 band */}
      <path d={buildBand(fc.p80)} fill="rgba(176,139,255,.22)" />
      {/* 50 band */}
      <path d={buildBand(fc.p50)} fill="rgba(176,139,255,.36)" />

      {/* Median split observed/forecast */}
      <polyline points={medianPtsArr.slice(0, fc.now + 1).join(' ')} fill="none" stroke="var(--signal-phos)" strokeWidth="1.8" />
      <polyline points={medianPtsArr.slice(fc.now).join(' ')} fill="none" stroke="var(--signal-phos)" strokeWidth="1.8" strokeDasharray="4 3" />

      {/* NOW line */}
      <line x1={xForI(fc.now)} y1={PAD_T} x2={xForI(fc.now)} y2={H - PAD_B} stroke="var(--signal-phos)" strokeWidth="1" opacity=".7" />
      <text x={xForI(fc.now) + 4} y={PAD_T + 10} fill="var(--signal-phos)" fontFamily="JetBrains Mono, monospace" fontSize="10">NOW · 2026-W16</text>

      {/* X ticks */}
      {[0, 6, 12, 13, 19, 25].map((idx, k) => (
        <g key={idx}>
          <line x1={xForI(idx)} y1={H - PAD_B} x2={xForI(idx)} y2={H - PAD_B + 4} stroke="#48576a" />
          <text x={xForI(idx)} y={H - PAD_B + 15} textAnchor="middle" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">
            {['W04', 'W10', 'W16', 'W17', 'W23', 'W29'][k]}
          </text>
        </g>
      ))}

      {/* Y axis label */}
      <text x="10" y={H / 2} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9" transform={`rotate(-90 10 ${H / 2})`} letterSpacing="1">EFFECTIVE R(t)</text>

      {/* Legend */}
      <g fontFamily="JetBrains Mono, monospace" fontSize="9" transform={`translate(${W - 160} ${PAD_T + 20})`}>
        <rect x="0" y="0"  width="10" height="8" fill="rgba(176,139,255,.36)" /><text x="14" y="7"  fill="#a6b2c2">50% CI</text>
        <rect x="0" y="12" width="10" height="8" fill="rgba(176,139,255,.22)" /><text x="14" y="19" fill="#a6b2c2">80% CI</text>
        <rect x="0" y="24" width="10" height="8" fill="rgba(176,139,255,.12)" /><text x="14" y="31" fill="#a6b2c2">95% CI</text>
      </g>
    </svg>
  )
}

// ─── IncidenceChart ───────────────────────────────────────────────────────────

interface IncidenceChartProps {
  scenario: ScenarioId
}

function IncidenceChart({ scenario }: IncidenceChartProps) {
  const inc = PRISM_DATA.incidence
  const W = 800, H = 160, PAD_L = 50, PAD_R = 20, PAD_T = 15, PAD_B = 25
  const n = inc.fit.length

  const xForI = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R)
  const adjust = (v: number): number =>
    scenario === 'intervention' ? v * 0.7
    : scenario === 'surge' ? v * 1.35
    : v
  const vMax = 160
  const yForV = (v: number) => (H - PAD_B) - (v / vMax) * (H - PAD_T - PAD_B)
  const fitPts = inc.fit.map((v, i) => `${xForI(i)},${yForV(i >= 13 ? adjust(v) : v)}`).join(' ')
  const fitPtsArr = fitPts.split(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="inc-svg">
      {[0, 40, 80, 120, 160].map(v => (
        <g key={v}>
          <line x1={PAD_L} y1={yForV(v)} x2={W - PAD_R} y2={yForV(v)} stroke="#1a2430" strokeDasharray="2 3" />
          <text x={PAD_L - 6} y={yForV(v) + 3} textAnchor="end" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">{v}</text>
        </g>
      ))}

      {/* Observed bars */}
      {inc.obs.map((v, i) =>
        v !== null ? (
          <rect key={i} x={xForI(i) - 7} y={yForV(v)} width="14" height={(H - PAD_B) - yForV(v)} fill="rgba(76,201,240,.6)" />
        ) : null
      )}

      {/* Fit line */}
      <polyline points={fitPtsArr.slice(0, 14).join(' ')} fill="none" stroke="var(--signal-cool)" strokeWidth="1.8" />
      <polyline points={fitPtsArr.slice(13).join(' ')} fill="none" stroke="var(--signal-cool)" strokeWidth="1.8" strokeDasharray="3 3" />

      <line x1={xForI(13)} y1={PAD_T} x2={xForI(13)} y2={H - PAD_B} stroke="var(--signal-phos)" opacity=".6" />
      <text x="10" y={H / 2} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9" transform={`rotate(-90 10 ${H / 2})`} letterSpacing="1">ILI / 100K</text>
    </svg>
  )
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

interface ScenariosProps {
  scenario: ScenarioId
  setScenario: (id: ScenarioId) => void
}

function Scenarios({ scenario, setScenario }: ScenariosProps) {
  const opts: { id: ScenarioId; label: string; peak: string; risk: string }[] = [
    { id: 'baseline',     label: 'Baseline · no action',              peak: '96 ILI / 100k · 2026-W21',  risk: 'moderate' },
    { id: 'intervention', label: 'Intervention · antivirals + nudge', peak: '67 ILI / 100k · 2026-W19',  risk: 'low'      },
    { id: 'surge',        label: 'Surge · no response',               peak: '130 ILI / 100k · 2026-W22', risk: 'high'     },
  ]

  return (
    <div className="scenarios">
      {opts.map((o, i) => (
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

// ─── ForecastView ─────────────────────────────────────────────────────────────

export default function ForecastView() {
  const selected = useAppStore(s => s.selected)
  const [scenario, setScenario] = useState<ScenarioId>('baseline')

  return (
    <div className="forecast-view">
      <div className="panel" style={{ gridArea: 'fan' }}>
        <div className="panel-head">
          <span className="title"><b>FORECAST</b>  /  R(t) · 500-draw ensemble · 13W horizon</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>model · episplat-v3.1 · backtest MAE 0.11</span>
        </div>
        <div className="panel-body flush" style={{ padding: 14 }}>
          <FanChart scenario={scenario} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'inc' }}>
        <div className="panel-head">
          <span className="title"><b>INCIDENCE</b>  /  ILI per 100k · {selected?.iso ?? 'global'}</span>
        </div>
        <div className="panel-body flush" style={{ padding: 14 }}>
          <IncidenceChart scenario={scenario} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'scen' }}>
        <div className="panel-head">
          <span className="title"><b>SCENARIOS</b>  /  counterfactual branches</span>
        </div>
        <div className="panel-body">
          <Scenarios scenario={scenario} setScenario={setScenario} />
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
            <div className="caps mute" style={{ marginBottom: 10 }}>Drivers</div>
            <div className="driver"><span>Clade fitness</span><div className="driver-bar"><div style={{ width: '72%', background: 'var(--signal-hot)' }} /></div><span className="mono">+0.24</span></div>
            <div className="driver"><span>Mobility</span><div className="driver-bar"><div style={{ width: '48%', background: 'var(--signal-warm)' }} /></div><span className="mono">+0.08</span></div>
            <div className="driver"><span>Wastewater</span><div className="driver-bar"><div style={{ width: '62%', background: 'var(--signal-hot)' }} /></div><span className="mono">+0.18</span></div>
            <div className="driver"><span>Immunity</span><div className="driver-bar"><div style={{ width: '34%', background: 'var(--signal-cool)' }} /></div><span className="mono">−0.12</span></div>
            <div className="driver"><span>Antigenic drift</span><div className="driver-bar"><div style={{ width: '56%', background: 'var(--signal-warm)' }} /></div><span className="mono">+0.14</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
