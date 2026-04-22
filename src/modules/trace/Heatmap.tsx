/* TRACE — Heatmap subcomponent */
import { PRISM_DATA } from '../../data/mock'
import type { Region, Metric } from '../../types/domain'

export interface SelectedCell {
  r: string
  m: string
  vals: number[]
  region: Region
  metric: Metric
}

interface HeatmapProps {
  selectedCell: SelectedCell | null
  setSelectedCell: (cell: SelectedCell) => void
  onOpenRegion: (region: Region) => void
}

export default function Heatmap({ selectedCell, setSelectedCell, onOpenRegion }: HeatmapProps) {
  const regions = ['NSK', 'CSP', 'VNM', 'JPN', 'USA', 'AUS', 'MEX', 'ZAF', 'GBR']
  const metrics = PRISM_DATA.metrics
  const cellW = 18, cellH = 18, gap = 2
  const labelW = 140, metricH = 90
  const W = labelW + (cellW + gap) * 12 + 20

  const heatColor = (v: number): string => {
    if (v < 0.2) return `rgba(76,201,240,${0.05 + v * 0.5})`
    if (v < 0.5) return `rgba(240,180,41,${0.2 + (v - 0.2) * 0.8})`
    if (v < 0.75) return `rgba(255,143,77,${0.5 + (v - 0.5) * 1.2})`
    return `rgba(255,107,74,${0.65 + (v - 0.75) * 1.4})`
  }

  const heatByKey = Object.fromEntries(
    PRISM_DATA.heat.map(h => [`${h.region}:${h.metric}`, h.vals])
  )

  return (
    <div className="heatmap-wrap">
      <svg
        viewBox={`0 0 ${W} ${metricH + (cellH + gap) * regions.length + 30}`}
        className="heatmap-svg"
      >
        {/* Metric headers (top, rotated) — noop group kept for layout parity */}
        {metrics.map((m) => (
          <g key={m.id} />
        ))}

        {/* Region rows */}
        {regions.map((r, ri) => {
          const region = PRISM_DATA.regions.find(x => x.id === r)
          if (!region) return null
          return (
            <g key={r}>
              {/* Region label */}
              <g
                transform={`translate(0 ${metricH + ri * (cellH + gap) + 12})`}
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenRegion(region)}
              >
                <rect x="0" y="-12" width={labelW - 8} height={cellH + 2} fill="transparent" />
                <text x="6" y="2" fill="#e7ecf2" fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="500">{r}</text>
                <text x="36" y="2" fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="9">{region.tier}</text>
                <text x="60" y="2" fill="#a6b2c2" fontFamily="Inter Tight, sans-serif" fontSize="10">{region.name}</text>
              </g>

              {/* Cells: for each metric → aggregate cell with inner sparkbars */}
              {metrics.map((m, mi) => {
                const vals = heatByKey[`${r}:${m.id}`] || []
                const maxV = Math.max(...vals)
                const x0 = labelW + mi * (cellW + gap) * 1.7
                const isSel = selectedCell?.r === r && selectedCell?.m === m.id
                return (
                  <g
                    key={m.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedCell({ r, m: m.id, vals, region, metric: m })}
                  >
                    {/* Cell bg */}
                    <rect
                      x={x0}
                      y={metricH + ri * (cellH + gap)}
                      width={cellW * 1.6}
                      height={cellH}
                      fill={heatColor(maxV)}
                    />
                    {/* Mini sparkbars inside */}
                    {vals.map((v, wi) => (
                      <rect
                        key={wi}
                        x={x0 + 1 + wi * ((cellW * 1.6 - 2) / 12)}
                        y={metricH + ri * (cellH + gap) + cellH - v * cellH * 0.9}
                        width={((cellW * 1.6 - 2) / 12) - 0.5}
                        height={v * cellH * 0.9}
                        fill="rgba(255,255,255,.22)"
                      />
                    ))}
                    {isSel && (
                      <rect
                        x={x0 - 1}
                        y={metricH + ri * (cellH + gap) - 1}
                        width={cellW * 1.6 + 2}
                        height={cellH + 2}
                        fill="none"
                        stroke="var(--signal-phos)"
                        strokeWidth="1.2"
                      />
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* Metric headers bottom labels */}
        {metrics.map((m, mi) => {
          const x0 = labelW + mi * (cellW + gap) * 1.7
          return (
            <g key={m.id + 'h'}>
              <text
                x={x0 + 4}
                y={metricH - 18}
                fill="#a6b2c2"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                transform={`rotate(-45 ${x0 + 4} ${metricH - 18})`}
              >
                {m.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
