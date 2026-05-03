import { useState, useEffect, useRef, useCallback } from 'react'
import { PRISM_DATA } from '../../data/mock'
import { useUpload, usePipelineRun, usePipelineStatus } from '../../api/queries'
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

function Notebook({ executedTo }: { executedTo: number }) {
  return (
    <div className="notebook">
      {PRISM_DATA.notebook.map((cell: NotebookCell) => {
        const isExecuted = cell.n <= executedTo
        const isRunning = cell.n === executedTo + 1
        const style = { opacity: isExecuted ? 1 : 0.35, transition: 'opacity 0.3s' }
        if (cell.kind === 'md') return (
          <div key={cell.n} className="nb-cell nb-md" style={style}>
            <div className="nb-gutter mono">{cell.n}</div>
            <div className="nb-body">
              <div className="serif" style={{ fontSize: 16, color: 'var(--fg)' }}>{cell.title}</div>
            </div>
          </div>
        )
        if (cell.kind === 'code') return (
          <div key={cell.n} className={`nb-cell nb-code${isRunning ? ' running' : ''}`} style={style}>
            <div className="nb-gutter mono">{isRunning ? 'In [*]:' : `In [${cell.n}]:`}</div>
            <div className="nb-body">
              <pre className="mono"><code>{colorCode(cell.src)}</code></pre>
            </div>
          </div>
        )
        return (
          <div key={cell.n} className="nb-cell nb-out" style={style}>
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

function UploadPanel() {
  const upload = useUpload()
  const pipelineRun = usePipelineRun()
  const [runId, setRunId] = useState<string | null>(null)
  const pipelineStatus = usePipelineStatus(runId)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    const result = await upload.mutateAsync(file)
    const run = await pipelineRun.mutateAsync(result.upload_id)
    setRunId(run.run_id)
  }, [upload, pipelineRun])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const status = pipelineStatus.data
  const progress = status?.progress ?? 0

  return (
    <div className="panel" style={{ gridArea: 'upload' }}>
      <div className="panel-head">
        <span className="title"><b>UPLOAD</b>  /  FASTA ingestion</span>
      </div>
      <div className="panel-body">
        <div
          className={`upload-dropzone${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {upload.isPending ? (
            <div className="mono" style={{ color: 'var(--signal-warm)' }}>Uploading...</div>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 6 }}>
                Drop FASTA file here
              </div>
              <div className="mono mute" style={{ fontSize: 10, marginBottom: 10 }}>
                .fa · .fasta · .fa.gz
              </div>
              <label className="btn ghost" style={{ cursor: 'pointer' }}>
                Browse
                <input type="file" accept=".fa,.fasta,.fa.gz,.fasta.gz" onChange={onFileInput} hidden />
              </label>
            </>
          )}
        </div>

        {upload.data && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 10 }}>
            Uploaded: <b style={{ color: 'var(--fg)' }}>{upload.data.filename}</b> · {upload.data.seq_count} sequences
          </div>
        )}

        {status && (
          <div style={{ marginTop: 12 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', marginBottom: 4 }}>
              Pipeline: <b style={{ color: status.status === 'completed' ? 'var(--signal-phos)' : status.status === 'running' ? 'var(--signal-warm)' : 'var(--fg)' }}>
                {status.status}
              </b>
              {status.current_stage && <span className="mute"> · {status.current_stage}</span>}
            </div>
            <div className="pipeline-bar">
              <div className="pipeline-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VirsiftView() {
  const totalCells = PRISM_DATA.notebook.length
  const [executedTo, setExecutedTo] = useState(totalCells) // start fully executed
  const [running, setRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const runAll = () => {
    if (running) return
    setExecutedTo(0)
    setRunning(true)
  }

  useEffect(() => {
    if (!running) return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setExecutedTo(prev => {
        if (prev >= totalCells) {
          setRunning(false)
          if (timerRef.current) clearInterval(timerRef.current)
          return totalCells
        }
        return prev + 1
      })
    }, 600)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running, totalCells])

  return (
    <div className="virsift-view">
      <UploadPanel />
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
            <button className="btn ghost" style={{ fontSize: 10 }} onClick={runAll}>
              {running ? '● Running…' : 'Run all'}
            </button>
          </span>
        </div>
        <div className="panel-body">
          <Notebook executedTo={executedTo} />
        </div>
      </div>
    </div>
  )
}
