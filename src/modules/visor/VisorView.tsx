/* VISOR — molecular structure + alignment ribbon + mutation table */
import { useState } from 'react'
import { PRISM_DATA } from '../../data/mock'

// ─── Molecule ────────────────────────────────────────────────────────────────

interface MoleculeProps {
  selectedSite: number | null
  setSelectedSite: (site: number | null) => void
}

function Molecule({ selectedSite, setSelectedSite }: MoleculeProps) {
  const cx = 200, cy = 200
  const chains = [0, 120, 240].map(angle => {
    const points: [number, number][] = []
    for (let t = 0; t <= 1; t += 0.02) {
      const r = 30 + 100 * Math.sin(t * Math.PI * 3.5) * (0.5 + 0.5 * Math.cos(t * Math.PI * 2))
      const θ = (angle + t * 360) * Math.PI / 180
      const wobble = 15 * Math.sin(t * Math.PI * 7)
      const x = cx + (r + wobble) * Math.cos(θ) * 0.55
      const y = cy - 120 + t * 240 + 10 * Math.sin(t * Math.PI * 4)
      points.push([x, y])
    }
    return points
  })

  const sitePositions: Record<number, [number, number]> = {
    226: [240, 120],
    193: [170, 160],
    158: [220, 200],
    144: [160, 250],
    98:  [250, 310],
  }

  const chainColors = ['var(--signal-cool)', 'var(--signal-violet)', 'var(--signal-phos)']

  return (
    <svg viewBox="0 0 400 440" className="molecule-svg">
      <defs>
        <radialGradient id="molGlow" cx=".5" cy=".5" r=".6">
          <stop offset="0%" stopColor="rgba(158,242,119,.15)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="400" height="440" fill="url(#molGlow)" />

      {/* Trimer chains */}
      {chains.map((pts, i) => (
        <polyline
          key={i}
          points={pts.map(p => p.join(',')).join(' ')}
          fill="none"
          stroke={chainColors[i]}
          strokeWidth="2"
          strokeOpacity=".55"
          strokeLinecap="round"
        />
      ))}

      {/* Backbone dots */}
      {chains.map((pts, i) =>
        pts.filter((_, j) => j % 4 === 0).map(([x, y], j) => (
          <circle
            key={`${i}-${j}`}
            cx={x}
            cy={y}
            r="1.5"
            fill={chainColors[i]}
            opacity=".7"
          />
        ))
      )}

      {/* Mutation sites */}
      {PRISM_DATA.mutations.map(m => {
        const pos = sitePositions[m.site]
        if (!pos) return null
        const [x, y] = pos
        const active = selectedSite === m.site
        const color =
          m.impact === 'high' ? 'var(--signal-hot)'
          : m.impact === 'mid' ? 'var(--signal-warm)'
          : 'var(--signal-cool)'
        return (
          <g key={m.site} style={{ cursor: 'pointer' }} onClick={() => setSelectedSite(m.site === selectedSite ? null : m.site)}>
            <circle cx={x} cy={y} r={active ? 18 : 12} fill={color} opacity=".15" />
            <circle cx={x} cy={y} r={active ? 10 : 7}  fill={color} opacity=".4" />
            <circle cx={x} cy={y} r={active ? 5 : 3.5} fill={color} />
            <text x={x + 12} y={y + 3} fill="#e7ecf2" fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="500">
              {m.wt}{m.site}{m.mut}
            </text>
          </g>
        )
      })}

      {/* Axes indicator */}
      <g fontFamily="JetBrains Mono, monospace" fontSize="8" fill="#6f7e91" letterSpacing="1">
        <text x="16" y="24">HA TRIMER · A/NSK/0047/2026</text>
        <text x="16" y="36">PDB · HOMOL 7XQ4 (ESM-2 FOLD)</text>
        <text x="16" y="420">STALK</text>
        <text x="16" y="60">RBD</text>
      </g>
    </svg>
  )
}

// ─── AlignmentRibbon ─────────────────────────────────────────────────────────

interface AlignmentRibbonProps {
  selectedSite: number | null
  setSelectedSite: (site: number | null) => void
}

function AlignmentRibbon({ selectedSite, setSelectedSite }: AlignmentRibbonProps) {
  const cellW = 16, cellH = 22, rows = 4
  const perRow = Math.ceil(PRISM_DATA.alignment.length / rows)

  return (
    <div className="align-ribbon">
      {Array.from({ length: rows }).map((_, ri) => {
        const slice = PRISM_DATA.alignment.slice(ri * perRow, (ri + 1) * perRow)
        return (
          <svg key={ri} viewBox={`0 0 ${perRow * cellW + 30} ${cellH + 20}`} className="align-row">
            <text x="0" y={cellH + 12} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">
              {(ri * perRow + 1).toString().padStart(3, '0')}
            </text>
            {slice.map((c, i) => {
              const x = 24 + i * cellW
              const isHigh = c.highlight
              const fill = isHigh
                ? 'rgba(255,107,74,.25)'
                : c.ss === 'helix' ? 'rgba(176,139,255,.12)'
                : c.ss === 'sheet' ? 'rgba(76,201,240,.12)'
                : 'rgba(158,242,119,.06)'
              const isSel = selectedSite === c.idx
              return (
                <g
                  key={i}
                  style={{ cursor: isHigh ? 'pointer' : 'default' }}
                  onClick={() => isHigh && setSelectedSite(c.idx === selectedSite ? null : c.idx)}
                >
                  <rect
                    x={x}
                    y={2}
                    width={cellW - 1}
                    height={cellH}
                    fill={fill}
                    stroke={isSel ? 'var(--signal-phos)' : 'none'}
                    strokeWidth="1.2"
                  />
                  <text
                    x={x + cellW / 2}
                    y={cellH - 3}
                    textAnchor="middle"
                    fill={isHigh ? 'var(--signal-hot)' : '#a6b2c2'}
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="10"
                    fontWeight={isHigh ? 600 : 400}
                  >
                    {c.aa}
                  </text>
                  {isHigh && (
                    <text
                      x={x + cellW / 2}
                      y={cellH + 14}
                      textAnchor="middle"
                      fill="var(--signal-hot)"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="7"
                    >
                      {c.idx}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )
      })}
      <div className="align-legend mono mute">
        <span><i style={{ background: 'rgba(176,139,255,.35)' }} />helix</span>
        <span><i style={{ background: 'rgba(76,201,240,.35)' }} />sheet</span>
        <span><i style={{ background: 'rgba(158,242,119,.25)' }} />loop</span>
        <span><i style={{ background: 'rgba(255,107,74,.5)' }} />antigenic site</span>
      </div>
    </div>
  )
}

// ─── MutationTable ───────────────────────────────────────────────────────────

interface MutationTableProps {
  selectedSite: number | null
  setSelectedSite: (site: number | null) => void
}

function MutationTable({ selectedSite, setSelectedSite }: MutationTableProps) {
  return (
    <div className="mut-table">
      <div className="mut-head mono mute">
        <span>SITE</span>
        <span>WT→MUT</span>
        <span>KOEL</span>
        <span>ESM-2</span>
        <span>FREQ</span>
        <span>FIRST</span>
        <span>Δ</span>
      </div>
      {PRISM_DATA.mutations.map(m => {
        const active = selectedSite === m.site
        return (
          <button
            key={m.site}
            className={'mut-row ' + (active ? 'active' : '')}
            onClick={() => setSelectedSite(m.site === selectedSite ? null : m.site)}
          >
            <span className="mono">{m.site}</span>
            <span className="mono" style={{ color: 'var(--fg)' }}>{m.wt}→<b style={{ color: 'var(--signal-hot)' }}>{m.mut}</b></span>
            <span className="mono tnum">{m.koel.toFixed(1)}</span>
            <span className="mono tnum">{m.esm.toFixed(1)}</span>
            <span className="mono tnum">{(m.freq * 100).toFixed(0)}%</span>
            <span className="mono mute">{m.first}</span>
            <span>
              <span
                className={'chip ' + (m.impact === 'high' ? 'hot' : m.impact === 'mid' ? 'warm' : 'cool')}
                style={{ padding: '1px 5px' }}
              >
                <i />
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── VisorView ───────────────────────────────────────────────────────────────

export default function VisorView() {
  const [site, setSite] = useState<number | null>(226)

  return (
    <div className="visor-view">
      <div className="panel" style={{ gridArea: 'mol' }}>
        <div className="panel-head">
          <span className="title"><b>VISOR</b>  /  HA trimer · ESM-2 homolog</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>confidence · pLDDT 82.1</span>
        </div>
        <div className="panel-body flush" style={{ display: 'grid', placeItems: 'center' }}>
          <Molecule selectedSite={site} setSelectedSite={setSite} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'align' }}>
        <div className="panel-head">
          <span className="title"><b>ALIGNMENT</b>  /  HA1 · 1–60 aa · ref A/HK/4801/2014</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>5 antigenic sites flagged</span>
        </div>
        <div className="panel-body">
          <AlignmentRibbon selectedSite={site} setSelectedSite={setSite} />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'muts' }}>
        <div className="panel-head">
          <span className="title"><b>MUTATIONS</b>  /  antigenic + structural</span>
        </div>
        <div className="panel-body flush">
          <MutationTable selectedSite={site} setSelectedSite={setSite} />
        </div>
      </div>
    </div>
  )
}
