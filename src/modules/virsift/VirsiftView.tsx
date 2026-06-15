import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useVirsiftParse, useVirsiftSession, useVirsiftSequences,
  useVirsiftFields, useVirsiftFilter, useVirsiftQualityFilter,
  useVirsiftSample, useVirsiftTimeline, useVirsiftReset,
  downloadVirsiftExport,
} from '../../api/queries'
import type {
  VirsiftParseSummary, VirsiftSequenceRow, VirsiftFieldInfo,
} from '../../types/domain'

function UploadPanel({ onParsed }: { onParsed: (s: VirsiftParseSummary) => void }) {
  const parse = useVirsiftParse()
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    const result = await parse.mutateAsync(file)
    onParsed(result)
  }, [parse, onParsed])

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

  return (
    <div className="panel" style={{ gridArea: 'upload' }}>
      <div className="panel-head">
        <span className="title"><b>UPLOAD</b>  /  GISAID FASTA ingestion</span>
      </div>
      <div className="panel-body">
        <div
          className={`upload-dropzone${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {parse.isPending ? (
            <div className="mono" style={{ color: 'var(--signal-warm)' }}>Parsing sequences...</div>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 6 }}>
                Drop GISAID FASTA file here
              </div>
              <div className="mono mute" style={{ fontSize: 10, marginBottom: 10 }}>
                .fa · .fasta · .fa.gz · .zip
              </div>
              <label className="btn ghost" style={{ cursor: 'pointer' }}>
                Browse
                <input type="file" accept=".fa,.fasta,.fa.gz,.fasta.gz,.zip" onChange={onFileInput} hidden />
              </label>
            </>
          )}
        </div>

        {parse.isError && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--signal-hot)', marginTop: 8 }}>
            Parse failed: {(parse.error as Error).message}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryPanel({ summary }: { summary: VirsiftParseSummary }) {
  const topSubtypes = Object.entries(summary.subtypes).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topHosts = Object.entries(summary.hosts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topLocations = Object.entries(summary.locations).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="panel" style={{ gridArea: 'summary' }}>
      <div className="panel-head">
        <span className="title"><b>PARSE</b>  /  {summary.filename}</span>
        <span className="grow" />
        <span className="mono mute" style={{ fontSize: 10 }}>{summary.parse_time_seconds.toFixed(2)}s</span>
      </div>
      <div className="panel-body" style={{ fontSize: 11 }}>
        <div className="mono" style={{ marginBottom: 10 }}>
          <b style={{ color: 'var(--signal-phos)', fontSize: 18 }}>{summary.total_sequences.toLocaleString()}</b>
          <span className="mute"> sequences parsed</span>
        </div>

        <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 4 }}>SUBTYPES</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {topSubtypes.map(([k, v]) => (
            <span key={k} className="chip violet" style={{ fontSize: 10 }}>{k} <b>{v}</b></span>
          ))}
        </div>

        <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 4 }}>HOSTS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {topHosts.map(([k, v]) => (
            <span key={k} className="chip cool" style={{ fontSize: 10 }}>{k} <b>{v}</b></span>
          ))}
        </div>

        <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 4 }}>LOCATIONS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {topLocations.map(([k, v]) => (
            <span key={k} className="chip warm" style={{ fontSize: 10 }}>{k} <b>{v}</b></span>
          ))}
        </div>

        {summary.date_range[0] && (
          <div className="mono mute" style={{ fontSize: 10 }}>
            Date range: <b style={{ color: 'var(--fg)' }}>{summary.date_range[0]}</b>
            {' → '}
            <b style={{ color: 'var(--fg)' }}>{summary.date_range[1]}</b>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterPanel({ sessionId, onApplied }: { sessionId: string; onApplied: () => void }) {
  const fields = useVirsiftFields(sessionId)
  const filterMut = useVirsiftFilter()
  const qualityMut = useVirsiftQualityFilter()

  const [selectedField, setSelectedField] = useState('')
  const [operator, setOperator] = useState('contains')
  const [filterValue, setFilterValue] = useState('')
  const [minLength, setMinLength] = useState('')
  const [dedup, setDedup] = useState(false)

  const fieldList = fields.data ? Object.entries(fields.data) : []

  const applyMetadataFilter = async () => {
    if (!selectedField || !filterValue) return
    await filterMut.mutateAsync({
      session_id: sessionId,
      rules: [{ field: selectedField, operator, value: filterValue }],
    })
    onApplied()
  }

  const applyQualityFilter = async () => {
    await qualityMut.mutateAsync({
      session_id: sessionId,
      min_length: minLength ? parseInt(minLength) : undefined,
      deduplicate: dedup,
    })
    onApplied()
  }

  return (
    <div className="panel" style={{ gridArea: 'filter' }}>
      <div className="panel-head">
        <span className="title"><b>FILTER LAB</b>  /  vectorized boolean masks</span>
      </div>
      <div className="panel-body" style={{ fontSize: 11 }}>
        <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>METADATA FILTER</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedField}
            onChange={e => setSelectedField(e.target.value)}
            style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '4px 6px', fontSize: 10, fontFamily: 'var(--mono)' }}
          >
            <option value="">field...</option>
            {fieldList.map(([k, v]) => (
              <option key={k} value={k}>{k} ({(v as VirsiftFieldInfo).n_unique})</option>
            ))}
          </select>
          <select
            value={operator}
            onChange={e => setOperator(e.target.value)}
            style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '4px 6px', fontSize: 10, fontFamily: 'var(--mono)' }}
          >
            {['contains', 'equals', 'not_equals', 'not_contains', 'starts_with', 'regex', 'in_list', 'date_range'].map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <input
            value={filterValue}
            onChange={e => setFilterValue(e.target.value)}
            placeholder="value..."
            onKeyDown={e => e.key === 'Enter' && applyMetadataFilter()}
            style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '4px 8px', fontSize: 10, fontFamily: 'var(--mono)', flex: 1, minWidth: 100 }}
          />
          <button className="btn ghost" style={{ fontSize: 10 }} onClick={applyMetadataFilter} disabled={filterMut.isPending}>
            {filterMut.isPending ? 'Filtering...' : 'Apply'}
          </button>
        </div>

        {filterMut.data && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--signal-phos)', marginBottom: 8 }}>
            {filterMut.data.before_count.toLocaleString()} → {filterMut.data.after_count.toLocaleString()} ({filterMut.data.removed_count.toLocaleString()} removed)
          </div>
        )}

        <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6, marginTop: 8 }}>QUALITY FILTER</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)' }}>
            Min length:
            <input
              value={minLength}
              onChange={e => setMinLength(e.target.value)}
              placeholder="e.g. 1500"
              style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '3px 6px', fontSize: 10, fontFamily: 'var(--mono)', width: 60, marginLeft: 4 }}
            />
          </label>
          <label className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={dedup} onChange={e => setDedup(e.target.checked)} />
            Deduplicate
          </label>
          <button className="btn ghost" style={{ fontSize: 10 }} onClick={applyQualityFilter} disabled={qualityMut.isPending}>
            {qualityMut.isPending ? 'Filtering...' : 'Apply QC'}
          </button>
        </div>

        {qualityMut.data && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--signal-phos)', marginTop: 6 }}>
            QC: {qualityMut.data.before_count.toLocaleString()} → {qualityMut.data.after_count.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}

function SamplerPanel({ sessionId, onApplied }: { sessionId: string; onApplied: () => void }) {
  const sampleMut = useVirsiftSample()
  const [category, setCategory] = useState<string>('')

  const applySampling = async () => {
    await sampleMut.mutateAsync({
      session_id: sessionId,
      category: category || undefined,
    })
    onApplied()
  }

  return (
    <div className="panel" style={{ gridArea: 'sample' }}>
      <div className="panel-head">
        <span className="title"><b>SAMPLER</b>  /  adaptive biological sampling</span>
      </div>
      <div className="panel-body" style={{ fontSize: 11 }}>
        <div className="mono mute" style={{ fontSize: 10, marginBottom: 8 }}>
          Lifespan-aware proportional sampling. Auto-detects dataset temporal span.
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '4px 6px', fontSize: 10, fontFamily: 'var(--mono)' }}
          >
            <option value="">Auto-detect</option>
            <option value="Micro">Micro (&lt;90d) — weekly sentinel</option>
            <option value="Seasonal">Seasonal (90-270d) — monthly</option>
            <option value="Endemic">Endemic (&gt;270d) — wave-crest</option>
          </select>
          <button className="btn ghost" style={{ fontSize: 10 }} onClick={applySampling} disabled={sampleMut.isPending}>
            {sampleMut.isPending ? 'Sampling...' : 'Run Sampler'}
          </button>
        </div>

        {sampleMut.data && (
          <div className="mono" style={{ fontSize: 10, marginTop: 8 }}>
            <span style={{ color: 'var(--signal-phos)' }}>
              {sampleMut.data.before_count.toLocaleString()} → {sampleMut.data.after_count.toLocaleString()}
            </span>
            <span className="mute"> · {sampleMut.data.reduction_pct}% reduction</span>
            <span className="mute"> · category: </span>
            <span className="chip violet" style={{ fontSize: 9 }}>{sampleMut.data.lifespan_category}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelinePanel({ sessionId }: { sessionId: string }) {
  const timeline = useVirsiftTimeline(sessionId)
  const data = timeline.data
  if (!data || data.weekly_counts.length === 0) return null

  const maxCount = Math.max(...data.weekly_counts.map(p => p.count))
  const barW = Math.max(2, Math.min(8, 500 / data.weekly_counts.length))

  return (
    <div className="panel" style={{ gridArea: 'timeline' }}>
      <div className="panel-head">
        <span className="title"><b>TIMELINE</b>  /  epidemic wave detection</span>
        <span className="grow" />
        <span className="chip violet" style={{ fontSize: 9 }}>{data.lifespan_category}</span>
        <span className="mono mute" style={{ fontSize: 10, marginLeft: 8 }}>{data.wave_count} waves</span>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80, overflow: 'hidden' }}>
          {data.weekly_counts.map((pt, i) => {
            const h = maxCount > 0 ? (pt.count / maxCount) * 70 : 0
            const isPeak = data.peaks.some(p => p.date === pt.period)
            const isTrough = data.troughs.some(t => t.date === pt.period)
            const bg = isPeak ? 'var(--signal-hot)' : isTrough ? 'var(--signal-cool)' : 'var(--signal-phos)'
            return (
              <div
                key={i}
                title={`${pt.period}: ${pt.count}`}
                style={{
                  width: barW, minHeight: 1, height: h,
                  background: bg, opacity: isPeak || isTrough ? 1 : 0.5,
                  borderRadius: '1px 1px 0 0',
                }}
              />
            )
          })}
        </div>

        {data.peaks.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.peaks.map((p, i) => (
              <span key={i} className="chip hot" style={{ fontSize: 9 }}>#{p.rank} {p.date} ({p.count})</span>
            ))}
            {data.off_season_clusters.map((c, i) => (
              <span key={`oc-${i}`} className="chip warm" style={{ fontSize: 9 }}>off-season {c.date} ({c.count})</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SequenceTable({ sessionId }: { sessionId: string }) {
  const [page, setPage] = useState(0)
  const seqs = useVirsiftSequences(sessionId, page * 50, 50)
  const data = seqs.data

  if (!data) return null

  const totalPages = Math.ceil(data.total / 50)

  return (
    <div className="panel" style={{ gridArea: 'table' }}>
      <div className="panel-head">
        <span className="title"><b>SEQUENCES</b>  /  {data.total.toLocaleString()} curated</span>
        <span className="grow" />
        <span className="mono mute" style={{ fontSize: 10 }}>
          page {page + 1}/{totalPages}
          {page > 0 && <button className="btn ghost" style={{ fontSize: 9, marginLeft: 4 }} onClick={() => setPage(p => p - 1)}>←</button>}
          {page < totalPages - 1 && <button className="btn ghost" style={{ fontSize: 9, marginLeft: 4 }} onClick={() => setPage(p => p + 1)}>→</button>}
        </span>
      </div>
      <div className="panel-body" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: 'var(--mono)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              {['isolate', 'subtype_clean', 'host', 'location', 'collection_date', 'segment', 'seq_length', 'clade'].map(col => (
                <th key={col} style={{ padding: '4px 6px', textAlign: 'left', color: 'var(--fg-mute)', fontWeight: 400, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: VirsiftSequenceRow, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <td style={{ padding: '3px 6px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg)' }}>{row.isolate}</td>
                <td style={{ padding: '3px 6px', color: 'var(--signal-violet)' }}>{row.subtype_clean}</td>
                <td style={{ padding: '3px 6px', color: 'var(--fg-dim)' }}>{row.host}</td>
                <td style={{ padding: '3px 6px', color: 'var(--fg-dim)' }}>{row.location}</td>
                <td style={{ padding: '3px 6px', color: 'var(--fg-dim)' }}>{row.collection_date || '—'}</td>
                <td style={{ padding: '3px 6px', color: 'var(--fg-dim)' }}>{row.segment}</td>
                <td style={{ padding: '3px 6px', color: 'var(--fg-dim)' }}>{row.sequence_length?.toLocaleString()}</td>
                <td style={{ padding: '3px 6px', color: 'var(--fg-dim)' }}>{row.clade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function VirsiftView() {
  const qc = useQueryClient()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [summary, setSummary] = useState<VirsiftParseSummary | null>(null)
  const session = useVirsiftSession(sessionId)
  const resetMut = useVirsiftReset()

  const onParsed = useCallback((s: VirsiftParseSummary) => {
    setSessionId(s.session_id)
    setSummary(s)
  }, [])

  const invalidateSession = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['virsift-session', sessionId] })
    qc.invalidateQueries({ queryKey: ['virsift-sequences', sessionId] })
    qc.invalidateQueries({ queryKey: ['virsift-timeline', sessionId] })
    qc.invalidateQueries({ queryKey: ['virsift-fields', sessionId] })
  }, [qc, sessionId])

  const handleReset = async () => {
    if (!sessionId) return
    await resetMut.mutateAsync(sessionId)
    invalidateSession()
  }

  if (!sessionId || !summary) {
    return (
      <div className="virsift-view" style={{ gridTemplateAreas: '"upload upload" "empty empty"', alignContent: 'start' }}>
        <UploadPanel onParsed={onParsed} />
        <div className="panel" style={{ gridArea: 'empty' }}>
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div className="mono mute" style={{ fontSize: 12, textAlign: 'center' }}>
              Upload a GISAID FASTA file to begin curation.<br />
              <span style={{ fontSize: 10 }}>Supports all 4 GISAID header variants · .fa · .fasta · .gz · .zip</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="virsift-view" style={{
      gridTemplateAreas: '"upload summary" "filter sample" "timeline timeline" "table table"',
      gridTemplateColumns: '280px 1fr',
      gridTemplateRows: 'auto auto auto 1fr',
    }}>
      <UploadPanel onParsed={onParsed} />
      <SummaryPanel summary={summary} />
      <FilterPanel sessionId={sessionId} onApplied={invalidateSession} />
      <SamplerPanel sessionId={sessionId} onApplied={invalidateSession} />
      <TimelinePanel sessionId={sessionId} />
      <SequenceTable sessionId={sessionId} />

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, padding: '0 0 10px' }}>
        <button className="btn ghost" style={{ fontSize: 10 }} onClick={handleReset}>
          Reset to original ({summary.total_sequences.toLocaleString()})
        </button>
        {session.data && (
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', alignSelf: 'center' }}>
            Current: <b style={{ color: 'var(--signal-phos)' }}>{session.data.current_count.toLocaleString()}</b> / {session.data.total_sequences.toLocaleString()}
          </span>
        )}
        <span className="grow" />
        <button className="btn ghost" style={{ fontSize: 10 }} onClick={() => downloadVirsiftExport(sessionId)}>
          Export curated FASTA
        </button>
      </div>
    </div>
  )
}
