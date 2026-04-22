import { PRISM_DATA } from '../../data/mock'
import type { DataSource, NotebookCell } from '../../types/domain'
import { SOURCE_KIND_CHIP_CLASS, SOURCE_STATUS_CHIP_CLASS } from '../../types/domain'

const KEYWORDS = new Set(['import','as','from','print','return','def','for','in','if','else'])

function colorCode(src: string) {
  return src.split('\n').map((line, li) => {
    const tokens = line.split(/(\s+|[().,=\[\]'"])/)
    const out = tokens.map((t, i) => {
      if (KEYWORDS.has(t)) return <span key={i} style={{ color: 'var(--signal-violet)' }}>{t}</span>
      if (/^['"]/.test(t)) return <span key={i} style={{ color: 'var(--signal-phos)' }}>{t}</span>
      if (/^\d+$/.test(t)) return <span key={i} style={{ color: 'var(--signal-warm)' }}>{t}</span>
      if (t.startsWith('vs.') || t.startsWith('streams.') || t.startsWith('metrics.')) {
        return <span key={i} style={{ color: 'var(--signal-cool)' }}>{t}</span>
      }
      return t
    })
    return <div key={li}>{out}</div>
  })
}

function SourceCard({ s }: { s: DataSource }) {
  const statusClass = SOURCE_STATUS_CHIP_CLASS[s.status]
  const kindClass = SOURCE_KIND_CHIP_CLASS[s.kind]

  return (
    <div className="src-card">
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <span className={`chip ${kindClass}`}><i />{s.kind}</span>
        <span className={`chip ${statusClass}`}><i />{s.status}</span>
      </div>
      <div className="src-name serif">{s.name}</div>
      <div className="mono mute" style={{ fontSize: 11, marginTop: 4 }}>last · {s.last}</div>
      <div className="src-latency mono" style={{ marginTop: 10 }}>
        <span className="caps mute">latency</span>
        <span className="tnum" style={{ fontSize: 18, color: 'var(--fg)' }}>{s.latency}</span>
      </div>
      <div className="src-qc">
        <div className="caps mute">QC</div>
        <div className="src-qc-bars">
          {[1, 1, 1, 1, 1, s.status === 'stale' ? 0 : 1, 1].map((ok, i) => (
            <div key={i} className={`src-qc-bar${ok ? '' : ' fail'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Notebook() {
  return (
    <div className="notebook">
      {PRISM_DATA.notebook.map((cell: NotebookCell) => {
        if (cell.kind === 'md') return (
          <div key={cell.n} className="nb-cell nb-md">
            <div className="nb-gutter mono">{cell.n}</div>
            <div className="nb-body">
              <div className="serif" style={{ fontSize: 16, color: 'var(--fg)' }}>{cell.title}</div>
            </div>
          </div>
        )
        if (cell.kind === 'code') return (
          <div key={cell.n} className="nb-cell nb-code">
            <div className="nb-gutter mono">In [{cell.n}]:</div>
            <div className="nb-body">
              <pre className="mono"><code>{colorCode(cell.src)}</code></pre>
            </div>
          </div>
        )
        return (
          <div key={cell.n} className="nb-cell nb-out">
            <div className="nb-gutter mono" style={{ color: 'var(--signal-phos)' }}>Out:</div>
            <div className="nb-body mono" style={{ color: 'var(--fg-dim)', fontSize: 11.5 }}>{cell.src}</div>
          </div>
        )
      })}
      <div className="nb-cell nb-code">
        <div className="nb-gutter mono">In [9]:</div>
        <div className="nb-body">
          <pre className="mono" style={{ color: 'var(--fg-mute)' }}><code>|</code></pre>
        </div>
      </div>
    </div>
  )
}

export default function VirsiftView() {
  return (
    <div className="virsift-view">
      <div className="panel" style={{ gridArea: 'src' }}>
        <div className="panel-head">
          <span className="title"><b>VIRSIFT</b>  /  ingestion streams · 5 active</span>
          <span className="grow" />
          <span className="mono mute" style={{ fontSize: 10 }}>next refresh · 00:47</span>
        </div>
        <div className="panel-body">
          <div className="src-grid">
            {PRISM_DATA.sources.map(s => <SourceCard key={s.id} s={s} />)}
          </div>
        </div>
      </div>
      <div className="panel" style={{ gridArea: 'nb' }}>
        <div className="panel-head">
          <span className="title"><b>NOTEBOOK</b>  /  virsift.pipeline.ipynb</span>
          <span className="grow" />
          <span className="row" style={{ gap: 6 }}>
            <span className="chip phos"><i />kernel · py3.11</span>
            <button className="btn ghost" style={{ fontSize: 10 }}>Run all</button>
          </span>
        </div>
        <div className="panel-body">
          <Notebook />
        </div>
      </div>
    </div>
  )
}
