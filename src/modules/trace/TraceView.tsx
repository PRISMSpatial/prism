/* TRACE — anomaly heatmap (region × metric × time) + inbox */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, staggerItem, slideUpVariants } from '../../motion'
import { useAppStore } from '../../store'
import { PRISM_DATA } from '../../data/mock'
import type { Region, Metric, InboxItem } from '../../types/domain'
import { TIER_CHIP_CLASS } from '../../types/domain'
import { ConcordancePanel } from './ConcordancePanel'

// ─── types ──────────────────────────────────────────────────────────────────

interface SelectedCell {
  r: string
  m: string
  vals: number[]
  region: Region
  metric: Metric
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

interface HeatmapProps {
  selectedCell: SelectedCell | null
  setSelectedCell: (cell: SelectedCell) => void
  onOpenRegion: (region: Region) => void
}

function Heatmap({ selectedCell, setSelectedCell, onOpenRegion }: HeatmapProps) {
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.42 } }}>
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
      </motion.div>
    </div>
  )
}

// ─── CellInspector ───────────────────────────────────────────────────────────

interface CellInspectorProps {
  sel: SelectedCell | null
  onDismiss: (regionId: string) => void
}

function CellInspector({ sel, onDismiss }: CellInspectorProps) {
  const { setModule, setSelected } = useAppStore()
  if (!sel) return (
    <div className="panel-body" style={{ color: 'var(--fg-mute)', fontSize: 12 }}>
      Click a cell to drill into region × metric × time.
    </div>
  )

  const W = 440, H = 180, PAD = 30
  const maxV = 1
  const n = sel.vals.length
  const xForI = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2)
  const yForV = (v: number) => (H - PAD) - (v / maxV) * (H - PAD * 2)
  const pts = sel.vals.map((v, i) => `${xForI(i)},${yForV(v)}`).join(' ')
  const area = `M ${xForI(0)},${H - PAD} L ${pts.split(' ').join(' L ')} L ${xForI(n - 1)},${H - PAD} Z`

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={sel.r + sel.m}
        variants={slideUpVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="panel-body"
      >
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <span className="chip phos"><i />{sel.r}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{sel.metric.name}</span>
        </div>
        <div className="mono mute" style={{ fontSize: 10, marginBottom: 10 }}>{sel.metric.desc}</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#22303f" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#22303f" />
          {[0.25, 0.5, 0.75].map(v => (
            <line key={v} x1={PAD} y1={yForV(v)} x2={W - PAD} y2={yForV(v)} stroke="#1a2430" strokeDasharray="2 3" />
          ))}
          <path d={area} fill="rgba(255,107,74,.15)" />
          <polyline points={pts} fill="none" stroke="var(--signal-hot)" strokeWidth="1.6" />
          {sel.vals.map((v, i) => (
            <circle
              key={i}
              cx={xForI(i)}
              cy={yForV(v)}
              r={i === n - 1 ? 3 : 1.5}
              fill={i === n - 1 ? 'var(--signal-phos)' : 'var(--signal-hot)'}
            />
          ))}
          <text x={W - PAD - 4} y={PAD + 10} textAnchor="end" fill="#e7ecf2" fontFamily="JetBrains Mono, monospace" fontSize="10">
            CURRENT <tspan fill="var(--signal-phos)">{(sel.vals[n - 1] * 100).toFixed(0)}%</tspan>
          </text>
          <text x={PAD + 4} y={PAD + 10} fill="#6f7e91" fontFamily="JetBrains Mono, monospace" fontSize="8">12W TRAJECTORY</text>
        </svg>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <button className="btn" onClick={() => { setSelected(sel.region); setModule('compass') }}>Open in COMPASS →</button>
          <button className="btn" onClick={() => { setSelected(sel.region); setModule('phylogeny') }}>Join STREAM →</button>
          <button className="btn ghost" onClick={() => onDismiss(sel.r)}>Mark as expected</button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Inbox ───────────────────────────────────────────────────────────────────

interface InboxProps {
  onOpenRegion: (region: Region) => void
  onSelect: (item: InboxItem) => void
  selectedId: string | undefined
  filter: InboxFilter
  dismissed: Set<string>
}

function Inbox({ onOpenRegion, onSelect, selectedId, filter, dismissed }: InboxProps) {
  const statusColor = (s: string): string =>
    ({ new: 'hot', escalated: 'pink', monitoring: 'warm', dismissed: '' }[s] ?? '')

  const regById = Object.fromEntries(PRISM_DATA.regions.map(r => [r.id, r]))

  const filtered = PRISM_DATA.inbox.filter(it => {
    if (dismissed.has(it.id)) return false
    if (filter === 'all') return true
    if (filter === 'new') return it.status === 'new'
    if (filter === 'escalated') return it.status === 'escalated'
    return true
  })

  return (
    <motion.div
      className="inbox"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {filtered.map(it => {
        const reg = regById[it.region]
        const active = selectedId === it.id
        return (
          <motion.div key={it.id} variants={staggerItem}>
            <motion.button
              whileHover={{ x: 2 }}
              className={'inbox-item' + (active ? ' active' : '') + (it.status === 'dismissed' ? ' dismissed' : '') + (it.score > 0.7 ? ' critical' : '')}
              onClick={() => { onSelect(it); onOpenRegion(reg) }}
            >
              <div className="inbox-score">
                <div
                  className="mono tnum"
                  style={{ fontSize: 15, color: it.score > 0.5 ? 'var(--signal-hot)' : 'var(--fg-dim)' }}
                >
                  {(it.score * 100).toFixed(0)}
                </div>
                <div className="caps mute" style={{ fontSize: 8 }}>SEED</div>
              </div>
              <div className="inbox-body">
                <div className="row" style={{ gap: 6, marginBottom: 2 }}>
                  <span className={'chip ' + TIER_CHIP_CLASS[it.tier]}><i />{it.tier}</span>
                  <span className={'chip ' + statusColor(it.status)}><i />{it.status.toUpperCase()}</span>
                </div>
                <div className="inbox-title">{it.title}</div>
                <div className="mono mute" style={{ fontSize: 10, marginTop: 3 }}>{it.id} · {it.age}</div>
              </div>
            </motion.button>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// ─── TraceView ───────────────────────────────────────────────────────────────

type InboxFilter = 'all' | 'new' | 'escalated'

export default function TraceView() {
  const setSelected = useAppStore(s => s.setSelected)
  const [sel, setSel] = useState<SelectedCell | null>(null)
  const [inboxSel, setInboxSel] = useState<InboxItem | null>(null)
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  return (
    <div className="trace-view">
      <div className="panel" style={{ gridArea: 'heat' }}>
        <div className="panel-head">
          <span className="title"><b>TRACE</b>  /  anomaly heatmap · region × metric · 12W</span>
          <span className="grow" />
          <span className="row" style={{ gap: 4 }}>
            <span className="caps mute">scale</span>
            <span className="chip cool"><i />low</span>
            <span className="chip warm"><i />mid</span>
            <span className="chip hot"><i />high</span>
          </span>
        </div>
        <div className="panel-body flush" style={{ padding: '14px 14px 10px' }}>
          <Heatmap
            selectedCell={sel}
            setSelectedCell={setSel}
            onOpenRegion={r => setSelected(r)}
          />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'inbox' }}>
        <div className="panel-head">
          <span className="title"><b>INBOX</b>  /  7 anomalies</span>
          <span className="grow" />
          <span className="row" style={{ gap: 4 }}>
            {(['all', 'new', 'escalated'] as InboxFilter[]).map(f => (
              <button
                key={f}
                className={`btn ghost${inboxFilter === f ? ' active' : ''}`}
                style={{ fontSize: 10 }}
                onClick={() => setInboxFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'new' ? 'Open' : 'Escalated'}
              </button>
            ))}
          </span>
        </div>
        <div className="panel-body flush">
          <Inbox
            onOpenRegion={r => setSelected(r)}
            onSelect={setInboxSel}
            selectedId={inboxSel?.id}
            filter={inboxFilter}
            dismissed={dismissed}
          />
        </div>
      </div>

      <div className="panel" style={{ gridArea: 'insp' }}>
        <div className="panel-head">
          <span className="title"><b>CELL</b>  /  inspector</span>
        </div>
        <CellInspector sel={sel} onDismiss={(regionId) => {
          const match = PRISM_DATA.inbox.find(it => it.region === regionId)
          if (match) setDismissed(prev => new Set(prev).add(match.id))
        }} />
        {sel && (
          <ConcordancePanel
            layers={sel.region.concordanceLayers}
            regionId={sel.r}
          />
        )}
      </div>
    </div>
  )
}
