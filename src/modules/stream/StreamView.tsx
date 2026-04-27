/* STREAM — phylogenetic Sankey + root-to-tip scatter */
import { useAppStore } from '../../store'
import { PRISM_DATA } from '../../data/mock'
import { CLADE_COLORS } from '../../types/domain'

// ─── helpers ─────────────────────────────────────────────────────────────────

const cladeColor = (c: string): string => CLADE_COLORS[c] ?? 'var(--fg-mute)'

// ─── PhyloTree ───────────────────────────────────────────────────────────────

interface PhyloTreeProps {
  selectedClade: string | null
  setSelectedClade: (clade: string | null) => void
}

function PhyloTree({ selectedClade, setSelectedClade }: PhyloTreeProps) {
  const nodes = PRISM_DATA.tree.nodes
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const edges = nodes
    .filter(n => n.parent)
    .map(n => ({ a: byId[n.parent!], b: n }))

  return (
    <svg viewBox="0 0 300 240" className="phylo-svg">
      {edges.map((e, i) => (
        <g key={i}>
          <line x1={e.a.x} y1={e.a.y} x2={e.a.x} y2={e.b.y} stroke="#22303f" strokeWidth="1" />
          <line x1={e.a.x} y1={e.b.y} x2={e.b.x} y2={e.b.y} stroke="#22303f" strokeWidth="1" />
        </g>
      ))}

      {/* Reassortment bridges — dashed curves for segment swap events */}
      {PRISM_DATA.tree.reassortmentBridges.map((br, i) => {
        const nFrom = byId[br.from]
        const nTo = byId[br.to]
        if (!nFrom || !nTo) return null
        const mx = (nFrom.x + nTo.x) / 2 + 30
        const my = (nFrom.y + nTo.y) / 2
        return (
          <g key={'rb' + i}>
            <path
              d={`M ${nFrom.x} ${nFrom.y} Q ${mx} ${my} ${nTo.x} ${nTo.y}`}
              fill="none"
              stroke="var(--signal-pink)"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.65"
            />
            <text
              x={mx - 4}
              y={my - 6}
              fill="var(--signal-pink)"
              fontFamily="JetBrains Mono, monospace"
              fontSize="7"
              opacity="0.8"
            >
              {br.segment}
            </text>
          </g>
        )
      })}

      {nodes.filter(n => n.leaf).map(n => {
        const active = selectedClade === n.clade
        return (
          <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedClade(n.clade)}>
            <circle cx={n.x} cy={n.y} r={active ? 5 : 3.5} fill={cladeColor(n.clade)} />
            {active && (
              <circle
                cx={n.x}
                cy={n.y}
                r="8"
                fill="none"
                stroke={cladeColor(n.clade)}
                strokeWidth="0.6"
                opacity=".5"
              />
            )}
            <text
              x={n.x + 8}
              y={n.y + 3.5}
              fill={active ? '#e7ecf2' : '#a6b2c2'}
              fontFamily="JetBrains Mono, monospace"
              fontSize="8"
              letterSpacing="0.3"
            >
              {n.clade}
            </text>
          </g>
        )
      })}
      <text x="4" y="14" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="7" letterSpacing="1">TREETIME · ROOT</text>
    </svg>
  )
}

// ─── Sankey ──────────────────────────────────────────────────────────────────

interface SankeyProps {
  selectedClade: string | null
  setSelectedClade: (clade: string | null) => void
}

function Sankey({ selectedClade, setSelectedClade }: SankeyProps) {
  const W = 600, H = 260

  const cols = [
    { x: 40,  label: 'ORIGIN' },
    { x: 300, label: 'INTERMEDIATE' },
    { x: 560, label: 'DESTINATION' },
  ]

  // Classify nodes into strict 3-column layout:
  // Origin = nodes that only appear as 'from' (never as 'to')
  // Destination = nodes that only appear as 'to' (never as 'from')
  // Intermediate = nodes that appear as both 'from' and 'to'
  const allFrom = new Set(PRISM_DATA.sankey.map(f => f.from))
  const allTo   = new Set(PRISM_DATA.sankey.map(f => f.to))
  const originNodes = [...allFrom].filter(n => !allTo.has(n))
  const destNodes   = [...allTo].filter(n => !allFrom.has(n))
  const midNodes    = [...allFrom].filter(n => allTo.has(n))

  const nodeY = (nodes: string[]): Record<string, number> => {
    const gap = H / (nodes.length + 1)
    return Object.fromEntries(nodes.map((n, i) => [n, (i + 1) * gap]))
  }
  const originY = nodeY(originNodes)
  const midY    = nodeY(midNodes)
  const destY   = nodeY(destNodes)

  // Hop1: origin → intermediate, Hop2: intermediate → destination
  const hop1 = PRISM_DATA.sankey.filter(f => originNodes.includes(f.from) && midNodes.includes(f.to))
  const hop2 = PRISM_DATA.sankey.filter(f => midNodes.includes(f.from) && destNodes.includes(f.to))

  // PS-driven width: higher persistence score = thicker flow bands
  const scale = (v: number, ps: number = 0.5) => (v / 5) * (0.6 + ps * 0.8)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sankey-svg">
      {/* Column labels */}
      {cols.map((c, i) => (
        <text key={i} x={c.x} y={16} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1">{c.label}</text>
      ))}

      {/* Node bars */}
      {originNodes.map(n => (
        <g key={'o' + n}>
          <rect x={cols[0].x - 2} y={originY[n] - 20} width="4" height="40" fill="#48576a" />
          <text x={cols[0].x - 8} y={originY[n] + 3} textAnchor="end" fill="#a6b2c2" fontFamily="JetBrains Mono, monospace" fontSize="9">{n}</text>
        </g>
      ))}
      {midNodes.map(n => (
        <g key={'m' + n}>
          <rect x={cols[1].x - 2} y={midY[n] - 40} width="4" height="80" fill="#48576a" />
          <text x={cols[1].x + 8} y={midY[n] + 3} fill="#a6b2c2" fontFamily="JetBrains Mono, monospace" fontSize="9">{n}</text>
        </g>
      ))}
      {destNodes.map(n => (
        <g key={'d' + n}>
          <rect x={cols[2].x - 2} y={destY[n] - 30} width="4" height="60" fill="#48576a" />
          <text x={cols[2].x + 8} y={destY[n] + 3} fill="#a6b2c2" fontFamily="JetBrains Mono, monospace" fontSize="9">{n}</text>
        </g>
      ))}

      {/* Flow bands */}
      {[...hop1, ...hop2].map((f, i) => {
        const isHop1 = hop1.includes(f)
        const x1 = isHop1 ? cols[0].x + 2 : cols[1].x + 2
        const x2 = isHop1 ? cols[1].x - 2 : cols[2].x - 2
        const y1 = isHop1 ? originY[f.from] : midY[f.from]
        const y2 = isHop1 ? midY[f.to]      : destY[f.to]
        const t  = scale(f.value, f.ps)
        const cx1 = x1 + (x2 - x1) * 0.45
        const cx2 = x1 + (x2 - x1) * 0.55
        const active = selectedClade === f.clade
        const dimmed = selectedClade && !active
        return (
          <path
            key={i}
            d={`M ${x1} ${y1 - t / 2} C ${cx1} ${y1 - t / 2}, ${cx2} ${y2 - t / 2}, ${x2} ${y2 - t / 2}
                L ${x2} ${y2 + t / 2} C ${cx2} ${y2 + t / 2}, ${cx1} ${y1 + t / 2}, ${x1} ${y1 + t / 2} Z`}
            fill={cladeColor(f.clade)}
            opacity={dimmed ? 0.1 : active ? 0.85 : 0.55}
            style={{ cursor: 'pointer', transition: 'opacity .2s' }}
            onClick={() => setSelectedClade(f.clade === selectedClade ? null : f.clade)}
          />
        )
      })}
    </svg>
  )
}

// ─── RootToTip ───────────────────────────────────────────────────────────────

interface RootToTipProps {
  selectedClade: string | null
}

function RootToTip({ selectedClade: _selectedClade }: RootToTipProps) {
  const W = 600, H = 180, PAD = 30
  const pts = PRISM_DATA.rootToTip
  const tMin = 2022, tMax = 2025.5
  const dMin = 0, dMax = 0.012
  const tx = (t: number) => PAD + ((t - tMin) / (tMax - tMin)) * (W - PAD * 2)
  const dy = (d: number) => (H - PAD) - ((d - dMin) / (dMax - dMin)) * (H - PAD * 2)

  // Regression: divergence = slope * (t - 2022) + intercept
  const slope = 0.0028, intercept = 0.0005
  const xs = [tMin, tMax]
  const ys = xs.map(x => slope * (x - 2022) + intercept)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rtt-svg">
      {/* Axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#22303f" strokeWidth="1" />
      <line x1={PAD} y1={PAD / 2} x2={PAD} y2={H - PAD} stroke="#22303f" strokeWidth="1" />
      {[2022, 2023, 2024, 2025].map(t => (
        <g key={t}>
          <line x1={tx(t)} y1={H - PAD} x2={tx(t)} y2={H - PAD + 3} stroke="#48576a" strokeWidth="1" />
          <text x={tx(t)} y={H - PAD + 13} textAnchor="middle" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="8">{t}</text>
        </g>
      ))}
      {[0, 0.004, 0.008, 0.012].map(d => (
        <g key={d}>
          <line x1={PAD - 3} y1={dy(d)} x2={PAD} y2={dy(d)} stroke="#48576a" strokeWidth="1" />
          <text x={PAD - 6} y={dy(d) + 3} textAnchor="end" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="8">{d.toFixed(3)}</text>
        </g>
      ))}

      {/* Regression line */}
      <line
        x1={tx(xs[0])} y1={dy(ys[0])}
        x2={tx(xs[1])} y2={dy(ys[1])}
        stroke="var(--signal-phos)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.6"
      />

      {/* Points */}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={tx(p.t)}
          cy={dy(p.d)}
          r={p.highlight ? 3.5 : 1.8}
          fill={p.highlight ? 'var(--signal-pink)' : 'var(--signal-cool)'}
          opacity={p.highlight ? 1 : 0.55}
        />
      ))}

      {/* Stats */}
      <g fontFamily="JetBrains Mono, monospace" fontSize="9">
        <text x={W - PAD - 2} y={PAD + 8} textAnchor="end" fill="#a6b2c2">n = <tspan fill="#e7ecf2">47</tspan></text>
        <text x={W - PAD - 2} y={PAD + 22} textAnchor="end" fill="#a6b2c2">R² = <tspan fill="#e7ecf2">0.64</tspan></text>
        <text x={W - PAD - 2} y={PAD + 36} textAnchor="end" fill="#a6b2c2">μ = <tspan fill="#e7ecf2">3.4e−3</tspan> subs/site/yr</text>
      </g>

      {/* Axis labels */}
      <text x={W / 2} y={H - 4} textAnchor="middle" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1">SAMPLING DATE →</text>
      <text x={10} y={H / 2} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1" transform={`rotate(-90 10 ${H / 2})`}>ROOT DIVERGENCE →</text>
    </svg>
  )
}

// ─── CladeInspector ──────────────────────────────────────────────────────────

interface CladeInspectorProps {
  clade: string | null
}

function CladeInspector({ clade }: CladeInspectorProps) {
  const { setModule, setSelected } = useAppStore()
  const info = PRISM_DATA.clades.find(c => c.id === clade)
  if (!info) return (
    <div className="panel-body" style={{ color: 'var(--fg-mute)', fontSize: 12 }}>
      Select a clade in the tree or a flow band in the Sankey.
    </div>
  )

  const chipCls: Record<string, string> = {
    '3C.2a1b': 'violet',
    '3C.2a1b.2a': 'phos',
    '3C.3a': 'cool',
    'B.1.7.2': 'pink',
  }

  return (
    <div className="panel-body">
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <span className={'chip ' + (chipCls[clade!] ?? '')}><i />{clade}</span>
        <span className="mono mute" style={{ fontSize: 11 }}>origin: {info.origin}</span>
      </div>
      <div className="serif" style={{ fontSize: 20, lineHeight: 1.2, marginBottom: 12, maxWidth: 420 }}>
        A <em style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>
          {info.fitness > 0.1 ? 'rapidly expanding' : info.fitness > 0 ? 'expanding' : 'declining'}
        </em> clade, n = {info.n} sequences.
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-dim)', lineHeight: 1.8 }}>
        <div>ORIGIN       <b style={{ color: 'var(--fg)' }}>{info.origin}</b></div>
        <div>SEQUENCES    <b style={{ color: 'var(--fg)' }}>{info.n}</b></div>
        <div>FITNESS      <b style={{ color: info.fitness > 0 ? 'var(--signal-hot)' : 'var(--signal-cool)' }}>{info.fitness >= 0 ? '+' : ''}{info.fitness.toFixed(2)}</b></div>
        <div>FIRST SEEN   <b style={{ color: 'var(--fg)' }}>2022-01-14</b></div>
        <div>LAST SEEN    <b style={{ color: 'var(--fg)' }}>2026-04-18</b></div>
        <div>MUTATIONS    <b style={{ color: 'var(--fg)' }}>HA-226 · HA-193 · HA-158</b></div>
      </div>
      <div className="row" style={{ marginTop: 14, gap: 6 }}>
        <button className="btn" onClick={() => setModule('molecule')}>Open in VISOR →</button>
        <button className="btn" onClick={() => {
          const region = PRISM_DATA.regions.find(r => r.clade === clade)
          if (region) setSelected(region)
          setModule('compass')
        }}>Jump to region →</button>
      </div>
    </div>
  )
}

// ─── StreamView ──────────────────────────────────────────────────────────────

export default function StreamView() {
  const selectedClade = useAppStore(s => s.selectedClade)
  const setSelectedClade = useAppStore(s => s.setSelectedClade)

  const handleClade = (c: string | null) => setSelectedClade(c)

  return (
    <div className="stream-view">
      <div className="panel" style={{ gridArea: 'tree' }}>
        <div className="panel-head">
          <span className="title"><b>TREETIME</b>  /  phylogenetic tree</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>n=944 · clock 3.4e−3</span>
        </div>
        <div className="panel-body flush" style={{ padding: 14 }}>
          <PhyloTree selectedClade={selectedClade} setSelectedClade={handleClade} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'sank' }}>
        <div className="panel-head">
          <span className="title"><b>STREAM</b>  /  clade flow · 2022 → 2026</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>brush tree to filter</span>
        </div>
        <div className="panel-body flush" style={{ padding: 14 }}>
          <Sankey selectedClade={selectedClade} setSelectedClade={handleClade} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'rtt' }}>
        <div className="panel-head">
          <span className="title"><b>ROOT-TO-TIP</b>  /  molecular clock</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>n=47 · R²=0.64</span>
        </div>
        <div className="panel-body flush" style={{ padding: 14 }}>
          <RootToTip selectedClade={selectedClade} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'insp' }}>
        <div className="panel-head">
          <span className="title"><b>CLADE</b>  /  inspector</span>
        </div>
        <CladeInspector clade={selectedClade} />
      </div>
    </div>
  )
}
