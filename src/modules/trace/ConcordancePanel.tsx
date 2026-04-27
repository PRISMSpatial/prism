// ConcordancePanel — three-layer concordance visualization
// Shows clinical, genomic, and wastewater signal agreement as concentric arcs

import type { ConcordanceLayers } from '../../types/domain'

interface ConcordancePanelProps {
  layers: ConcordanceLayers
  regionId: string
}

const SIZE = 160
const CX = SIZE / 2
const CY = SIZE / 2
const LAYERS = [
  { key: 'clinical' as const,   label: 'Clinical',   color: '#4cc9f0', r: 55 },
  { key: 'genomic' as const,    label: 'Genomic',    color: '#b08bff', r: 42 },
  { key: 'wastewater' as const, label: 'Wastewater', color: '#ff8fb1', r: 29 },
]

function arcPath(cx: number, cy: number, r: number, fraction: number): string {
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + fraction * 2 * Math.PI
  const largeArc = fraction > 0.5 ? 1 : 0
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  if (fraction >= 0.999) {
    // Full circle: draw two semicircles
    const xMid = cx + r * Math.cos(startAngle + Math.PI)
    const yMid = cy + r * Math.sin(startAngle + Math.PI)
    return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${xMid} ${yMid} A ${r} ${r} 0 1 1 ${x1} ${y1}`
  }
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

export function ConcordancePanel({ layers, regionId }: ConcordancePanelProps) {
  return (
    <div style={{ padding: '10px 14px' }}>
      <div className="caps mute" style={{ fontSize: 9, marginBottom: 8 }}>THREE-LAYER CONCORDANCE · {regionId}</div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', maxWidth: SIZE }}>
        {/* Background rings */}
        {LAYERS.map(l => (
          <circle key={l.key + 'bg'} cx={CX} cy={CY} r={l.r} fill="none" stroke="#1a2430" strokeWidth="6" />
        ))}

        {/* Concordance arcs */}
        {LAYERS.map(l => (
          <path
            key={l.key}
            d={arcPath(CX, CY, l.r, layers[l.key])}
            fill="none"
            stroke={l.color}
            strokeWidth="6"
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}

        {/* Labels */}
        {LAYERS.map(l => (
          <text
            key={l.key + 'lbl'}
            x={CX + l.r + 8}
            y={CY - l.r + 14}
            fill="#6f7e91"
            fontFamily="JetBrains Mono, monospace"
            fontSize="8"
          >
            {l.label} {(layers[l.key] * 100).toFixed(0)}%
          </text>
        ))}

        {/* Center score */}
        <text
          x={CX}
          y={CY - 2}
          textAnchor="middle"
          fill="#e7ecf2"
          fontFamily="JetBrains Mono, monospace"
          fontSize="16"
          fontWeight="bold"
        >
          {((layers.clinical + layers.genomic + layers.wastewater) / 3 * 100).toFixed(0)}
        </text>
        <text
          x={CX}
          y={CY + 12}
          textAnchor="middle"
          fill="#6f7e91"
          fontFamily="JetBrains Mono, monospace"
          fontSize="8"
        >
          CONCORDANCE
        </text>
      </svg>
    </div>
  )
}
