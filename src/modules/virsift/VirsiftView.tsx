/* VIR-SEQ-SIFT — Workspace UI matching desktop Vir-Seq-Sift v1.0 */
import { useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useVirsiftParse, useVirsiftSession, useVirsiftSequences,
  useVirsiftFields, useVirsiftFilter, useVirsiftQualityFilter,
  useVirsiftSample, useVirsiftTimeline, useVirsiftReset,
  useVirsiftWorkspace, useVirsiftValidation, useVirsiftSummary,
  useVirsiftMerge, useVirsiftFetchUrl,
  downloadVirsiftExport,
} from '../../api/queries'
import type {
  VirsiftParseSummary, VirsiftSequenceRow, VirsiftFieldInfo,
  WorkspaceFile, ValidationResult, DatasetSummary,
} from '../../types/domain'

type TabId = 'import' | 'loaded' | 'review' | 'dataset' | 'refinery'

// ─── ImportTab ───────────────────────────────────────────────────────────────

function ImportTab({ onParsed, urlOpen, setUrlOpen }: {
  onParsed: (s: VirsiftParseSummary) => void
  urlOpen: boolean
  setUrlOpen: (v: boolean) => void
}) {
  const parse = useVirsiftParse()
  const fetchUrl = useVirsiftFetchUrl()
  const [dragOver, setDragOver] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const handleFile = useCallback(async (file: File) => {
    const result = await parse.mutateAsync(file)
    onParsed(result)
  }, [parse, onParsed])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach(f => handleFile(f))
    }
    e.target.value = ''
  }, [handleFile])

  const handleFetch = async () => {
    if (!urlInput.trim()) return
    const result = await fetchUrl.mutateAsync(urlInput.trim())
    onParsed(result)
    setUrlInput('')
  }

  return (
    <div>
      <div style={{ padding: '12px 0 8px', marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 13, color: 'var(--signal-phos)', marginBottom: 4 }}>
          FASTA Parser v3d.4 — GISAID & NCBI
        </div>
        <div className="mono mute" style={{ fontSize: 10 }}>
          Accepts GISAID EpiFlu/EpiCoV/RSV FASTA and NCBI exports. Auto-detects 4 GISAID header variants + NCBI define formats. 50 MB soft warn · 200 MB per file · 2 GB total. ZIP batch mode expands members individually.
        </div>
      </div>

      <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>GISAID Sources</div>
      <div className="vs-source-grid">
        {[
          { name: 'EpiFlu FASTA', sub: 'Influenza A/B', desc: 'EpiFlu pipe-delimited 6-field headers' },
          { name: 'EpiCoV FASTA', sub: 'SARS-CoV-2', desc: 'EpiCoV-style with lineage and Pango' },
          { name: 'RSV Batch', sub: 'RSV A/B', desc: 'hRSVB 3-field compact headers' },
          { name: 'ZIP Batch', sub: 'Multi-FASTA ZIP', desc: 'Multiple FASTA files in one archive' },
        ].map(s => (
          <div key={s.name} className="vs-source-card">
            <b>{s.name}</b>
            <span>{s.sub}<br />{s.desc}</span>
          </div>
        ))}
      </div>

      <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>NCBI Sources</div>
      <div className="vs-source-grid">
        {[
          { name: 'NCBI Influenza DB', sub: 'Flu A/B/C/D FASTA', desc: 'Legacy NCBI influenza resource exports' },
          { name: 'NCBI GenBank', sub: 'Accession FASTA', desc: 'GenBank .fasta with accession deflines' },
          { name: 'NCBI Datasets', sub: 'zip with metadata', desc: 'ncbi_dataset package + data_report.json' },
          { name: 'SRA FASTA', sub: 'Assembly FASTA', desc: 'SRA assembly, less lower confidence' },
        ].map(s => (
          <div key={s.name} className="vs-source-card">
            <b>{s.name}</b>
            <span>{s.sub}<br />{s.desc}</span>
          </div>
        ))}
      </div>

      <div
        className={`upload-dropzone${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{ margin: '16px 0' }}
      >
        {parse.isPending ? (
          <div className="mono" style={{ color: 'var(--signal-warm)' }}>Parsing sequences...</div>
        ) : (
          <>
            <div className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 6 }}>
              Drop GISAID or NCBI FASTA files here
            </div>
            <div className="mono mute" style={{ fontSize: 10, marginBottom: 4 }}>or click to browse</div>
            <div className="mono mute" style={{ fontSize: 9, marginBottom: 10 }}>
              .fasta, .fa, .fna, .fnt, .gz, .zip, .xm.fasta · Max 200 MB / 2 GB total
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              background: 'var(--ink-2)', border: '1px solid var(--line)', padding: '6px 14px',
              borderRadius: 3, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--fg)' }}>
              Browse Files
              <input type="file" accept=".fa,.fasta,.fna,.fnt,.fa.gz,.fasta.gz,.gz,.zip" multiple onChange={onFileInput} hidden />
            </label>
          </>
        )}
      </div>

      {parse.isError && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--signal-hot)', marginBottom: 8 }}>
          Parse failed: {(parse.error as Error).message}
        </div>
      )}

      <div style={{
        border: '1px solid var(--line-soft)', borderRadius: 3, marginTop: 8,
      }}>
        <button
          onClick={() => setUrlOpen(!urlOpen)}
          style={{
            width: '100%', textAlign: 'left', padding: '8px 12px',
            background: 'var(--ink-1)', border: 'none', color: 'var(--fg)',
            cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ color: 'var(--signal-cool)' }}>&#128279;</span>
          Import from URL (NCBI FTP, GISAID direct link)
          <span className="grow" />
          <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>{urlOpen ? '▲' : '▼'}</span>
        </button>
        {urlOpen && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line-soft)' }}>
            <div className="mono mute" style={{ fontSize: 10, marginBottom: 6 }}>
              Paste a direct URL to a FASTA or .gz file. HEAD check validates size before download. Fetch progress appears in bottom dock Tasks tab. Auto-activation is disabled — confirm before activating.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="mono"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://ftp.ncbi.nlm.nih.gov/... or direct FASTA URL"
                onKeyDown={e => e.key === 'Enter' && handleFetch()}
                style={{
                  flex: 1, background: 'var(--ink-2)', border: '1px solid var(--line)',
                  color: 'var(--fg)', padding: '6px 8px', borderRadius: 3, fontSize: 11,
                  fontFamily: 'var(--mono)',
                }}
              />
              <button
                onClick={handleFetch}
                disabled={fetchUrl.isPending || !urlInput.trim()}
                style={{
                  background: 'var(--signal-cool)', color: '#000', border: 'none',
                  padding: '6px 14px', borderRadius: 3, fontSize: 11,
                  fontFamily: 'var(--mono)', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {fetchUrl.isPending ? '...' : 'Fetch'}
              </button>
            </div>
            {fetchUrl.isError && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--signal-hot)', marginTop: 6 }}>
                {(fetchUrl.error as Error).message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LoadedFilesTab ──────────────────────────────────────────────────────────

function LoadedFilesTab({
  files, selected, onToggleSelect, onSelectAll, onClear,
}: {
  files: WorkspaceFile[]
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onClear: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'parsed' | 'pending' | 'error'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let f = files
    if (filter === 'parsed') f = f.filter(x => x.status === 'active' || x.status === 'parsed')
    if (filter === 'pending') f = f.filter(x => x.status === 'pending')
    if (filter === 'error') f = f.filter(x => x.status === 'error')
    if (search) f = f.filter(x => x.filename.toLowerCase().includes(search.toLowerCase()))
    return f
  }, [files, filter, search])

  const statusColor = (s: string) =>
    s === 'active' ? 'var(--signal-phos)' : s === 'parsed' ? 'var(--signal-cool)' : s === 'pending' ? 'var(--signal-warm)' : 'var(--signal-hot)'

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        {(['all', 'parsed', 'pending', 'error'] as const).map(f => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`}
            style={{ fontSize: 9 }}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()} ({f === 'all' ? files.length : files.filter(x =>
              f === 'parsed' ? (x.status === 'active' || x.status === 'parsed') :
              x.status === f
            ).length})
          </button>
        ))}
        <span className="grow" />
        <input
          className="mono"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files..."
          style={{
            background: 'var(--ink-2)', border: '1px solid var(--line-soft)',
            color: 'var(--fg)', padding: '3px 8px', fontSize: 10, width: 160,
            fontFamily: 'var(--mono)', borderRadius: 2,
          }}
        />
        <button className="vs-toolbar" style={{ fontSize: 9 }} onClick={onSelectAll}>Select All</button>
        <button className="vs-toolbar" style={{ fontSize: 9 }} onClick={onClear}>Clear</button>
      </div>

      {filtered.length === 0 ? (
        <div className="mono mute" style={{ textAlign: 'center', padding: 40, fontSize: 11 }}>
          No files loaded. Go to Import Data to add FASTA files.
        </div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table className="vs-file-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>File Name</th>
                <th>Source</th>
                <th>Sequences</th>
                <th>Subtypes</th>
                <th>Segments</th>
                <th>Date Range</th>
                <th>Parse (s)</th>
                <th>Status</th>
                <th>Warn</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.session_id}
                  className={selected.has(f.session_id) ? 'selected' : ''}
                  onClick={() => onToggleSelect(f.session_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <input type="checkbox" checked={selected.has(f.session_id)} readOnly
                      style={{ accentColor: 'var(--signal-phos)' }} />
                  </td>
                  <td style={{ color: 'var(--fg)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.filename}
                  </td>
                  <td>{f.source}</td>
                  <td style={{ color: 'var(--fg)' }}>{f.sequences.toLocaleString()}</td>
                  <td>{f.subtypes}</td>
                  <td>{f.segments}</td>
                  <td>{f.date_range[0] ? `${f.date_range[0]} → ${f.date_range[1]}` : '—'}</td>
                  <td>{f.parse_time.toFixed(2)}</td>
                  <td>
                    <span className={`chip ${f.status === 'active' ? 'phos' : f.status === 'parsed' ? 'cool' : f.status === 'pending' ? 'warm' : 'hot'}`}
                      style={{ fontSize: 8 }}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{ color: f.warnings > 0 ? 'var(--signal-warm)' : 'var(--fg-dim)' }}>
                    {f.warnings}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mono mute" style={{ fontSize: 10, marginTop: 8, textAlign: 'right' }}>
        {selected.size > 0 ? `${selected.size} selected · ${files.filter(f => selected.has(f.session_id)).reduce((s, f) => s + f.sequences, 0).toLocaleString()} sequences` : ''}
      </div>
    </div>
  )
}

// ─── ParserReviewTab ─────────────────────────────────────────────────────────

function ParserReviewTab({ validation }: { validation: ValidationResult | undefined }) {
  if (!validation) return <div className="mono mute" style={{ padding: 40, textAlign: 'center' }}>Select an active dataset to view parser review.</div>

  return (
    <div>
      <div className="mono" style={{ fontSize: 13, marginBottom: 12 }}>Parser Review — Header Detection and Validation</div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
        <div><span className="mute" style={{ fontSize: 10 }}>Header Variant</span><br />
          <span className="chip violet" style={{ fontSize: 10 }}>{validation.header_variant}</span></div>
        <div><span className="mute" style={{ fontSize: 10 }}>Confidence</span><br />
          <b style={{ color: validation.confidence > 90 ? 'var(--signal-phos)' : 'var(--signal-warm)' }}>{validation.confidence}%</b></div>
        <div><span className="mute" style={{ fontSize: 10 }}>Header Warnings</span><br />
          <b style={{ color: validation.warnings_count > 0 ? 'var(--signal-warm)' : 'var(--fg-dim)' }}>{validation.warnings_count}</b></div>
      </div>

      {validation.header_issues.length > 0 && (
        <>
          <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>HEADER ISSUES ({validation.header_issues.length})</div>
          <table className="vs-file-table" style={{ marginBottom: 16 }}>
            <thead>
              <tr><th>Line</th><th>Original Header</th><th>Issue</th><th>Suggested Fix</th></tr>
            </thead>
            <tbody>
              {validation.header_issues.map((h, i) => (
                <tr key={i}>
                  <td>L:{h.line}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.original_header}</td>
                  <td><span className="chip warm" style={{ fontSize: 8 }}>{h.issue}</span></td>
                  <td style={{ fontSize: 9 }}>{h.suggested_fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>PARSED FIELD COVERAGE</div>
      <table className="vs-file-table">
        <thead>
          <tr><th>Field</th><th>Coverage %</th><th>Missing</th><th>Example Value</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {validation.field_coverage.map(fc => (
            <tr key={fc.field}>
              <td style={{ color: 'var(--fg)', fontWeight: 500 }}>{fc.field}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="vs-coverage-bar" style={{ width: 60 }}>
                    <div style={{
                      width: `${fc.coverage_pct}%`,
                      background: fc.coverage_pct > 95 ? 'var(--signal-phos)' : fc.coverage_pct > 70 ? 'var(--signal-cool)' : 'var(--signal-warm)',
                    }} />
                  </div>
                  <span>{fc.coverage_pct}%</span>
                </div>
              </td>
              <td>{fc.missing}</td>
              <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fc.example || '—'}
              </td>
              <td className="mute">{fc.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── ActiveDatasetTab ────────────────────────────────────────────────────────

function ActiveDatasetTab({ summary, sessionId, onGoRefinery, onGoReview, onExport }: {
  summary: DatasetSummary | undefined; sessionId: string | null
  onGoRefinery: () => void; onGoReview: () => void; onExport: () => void
}) {
  if (!summary || !sessionId) {
    return <div className="mono mute" style={{ padding: 40, textAlign: 'center' }}>No active dataset. Upload files and activate to view summary.</div>
  }

  const topEntries = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div>
      <div style={{ display: 'flex', gap: 30, marginBottom: 16 }}>
        <div>
          <div className="mute" style={{ fontSize: 10 }}>Sequences Active</div>
          <b style={{ fontSize: 22, color: 'var(--fg)' }}>{summary.sequences_active.toLocaleString()}</b>
        </div>
        <div>
          <div className="mute" style={{ fontSize: 10 }}>Avg Length (bp)</div>
          <b style={{ fontSize: 22, color: 'var(--fg)' }}>{summary.avg_length.toLocaleString()}</b>
        </div>
        <div>
          <div className="mute" style={{ fontSize: 10 }}>Earliest</div>
          <b style={{ fontSize: 22, color: 'var(--signal-cool)' }}>{summary.earliest || '—'}</b>
        </div>
        <div>
          <div className="mute" style={{ fontSize: 10 }}>Latest</div>
          <b style={{ fontSize: 22, color: 'var(--signal-cool)' }}>{summary.latest || '—'}</b>
        </div>
      </div>

      <div style={{ background: 'var(--ink-1)', padding: 12, borderRadius: 3, marginBottom: 16, fontSize: 10 }}>
        <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>DATASET PROVENANCE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div><span className="mute">Source file:</span> <b>{summary.source_file}</b></div>
          <div><span className="mute">Header Variant:</span> <b>{summary.header_variant}</b></div>
          <div><span className="mute">Confidence:</span> <b>{summary.confidence}%</b></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>TOP SUBTYPES</div>
          {topEntries(summary.subtypes).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
              <span>{k}</span><b>{v.toLocaleString()}</b>
            </div>
          ))}
        </div>
        <div>
          <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>TOP SEGMENTS</div>
          {topEntries(summary.segments).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
              <span>{k}</span><b>{v.toLocaleString()}</b>
            </div>
          ))}
        </div>
        <div>
          <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>TOP LOCATIONS</div>
          {topEntries(summary.locations).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
              <span>{k}</span><b>{v.toLocaleString()}</b>
            </div>
          ))}
        </div>
        <div>
          <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>TOP HOST SPECIES</div>
          {topEntries(summary.hosts).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
              <span>{k}</span><b>{v.toLocaleString()}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 8 }}>NEXT STEPS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div className="vs-source-card" onClick={onGoRefinery} style={{ cursor: 'pointer' }}>
          <b>Open Sequence Refinery</b>
          <span>Apply quality filters, dedup, HTL sampling</span>
        </div>
        <div className="vs-source-card" onClick={onGoReview} style={{ cursor: 'pointer' }}>
          <b>Run Quality Review</b>
          <span>Review parse warnings and field coverage</span>
        </div>
        <div className="vs-source-card" onClick={onExport} style={{ cursor: 'pointer' }}>
          <b>Export Original Dataset</b>
          <span>Download FASTA/CSV before any filtering</span>
        </div>
      </div>
    </div>
  )
}

// ─── RefineryTab (Filter + Sample + Timeline + Table) ────────────────────────

function RefineryTab({ sessionId, invalidate }: { sessionId: string; invalidate: () => void }) {
  const [selectedField, setSelectedField] = useState('')
  const [operator, setOperator] = useState('contains')
  const [filterValue, setFilterValue] = useState('')
  const [minLength, setMinLength] = useState('')
  const [dedup, setDedup] = useState(false)
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)

  const fields = useVirsiftFields(sessionId)
  const filterMut = useVirsiftFilter()
  const qualityMut = useVirsiftQualityFilter()
  const sampleMut = useVirsiftSample()
  const timeline = useVirsiftTimeline(sessionId)
  const seqs = useVirsiftSequences(sessionId, page * 50, 50)
  const session = useVirsiftSession(sessionId)
  const resetMut = useVirsiftReset()

  const fieldList = fields.data ? Object.entries(fields.data) : []

  const applyFilter = async () => {
    if (!selectedField || !filterValue) return
    await filterMut.mutateAsync({ session_id: sessionId, rules: [{ field: selectedField, operator, value: filterValue }] })
    invalidate()
  }
  const applyQC = async () => {
    await qualityMut.mutateAsync({ session_id: sessionId, min_length: minLength ? parseInt(minLength) : undefined, deduplicate: dedup })
    invalidate()
  }
  const applySample = async () => {
    await sampleMut.mutateAsync({ session_id: sessionId, category: category || undefined })
    invalidate()
  }
  const handleReset = async () => {
    await resetMut.mutateAsync(sessionId)
    invalidate()
  }

  const tl = timeline.data
  const maxCount = tl ? Math.max(...tl.weekly_counts.map(p => p.count), 1) : 1
  const barW = tl ? Math.max(2, Math.min(8, 600 / tl.weekly_counts.length)) : 4

  const seqData = seqs.data
  const totalPages = seqData ? Math.ceil(seqData.total / 50) : 0

  return (
    <div>
      {session.data && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 12px', background: 'var(--ink-1)', borderRadius: 3 }}>
          <span className="mono" style={{ fontSize: 11 }}>
            Current: <b style={{ color: 'var(--signal-phos)' }}>{session.data.current_count.toLocaleString()}</b> / {session.data.total_sequences.toLocaleString()} sequences
          </span>
          <span className="grow" />
          <button className="vs-toolbar" onClick={handleReset} style={{ fontSize: 9, padding: '3px 8px', background: 'var(--ink-2)', border: '1px solid var(--line-soft)', borderRadius: 2, color: 'var(--fg-dim)', cursor: 'pointer', fontFamily: 'var(--mono)' }}>
            Reset to original
          </button>
          <button className="vs-toolbar" onClick={() => downloadVirsiftExport(sessionId)} style={{ fontSize: 9, padding: '3px 8px', background: 'var(--ink-2)', border: '1px solid var(--line-soft)', borderRadius: 2, color: 'var(--fg-dim)', cursor: 'pointer', fontFamily: 'var(--mono)' }}>
            Export FASTA
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div className="panel">
          <div className="panel-head"><span className="title"><b>FILTER LAB</b></span></div>
          <div className="panel-body" style={{ fontSize: 11 }}>
            <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>METADATA FILTER</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              <select value={selectedField} onChange={e => setSelectedField(e.target.value)}
                style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '3px 6px', fontSize: 10, fontFamily: 'var(--mono)' }}>
                <option value="">field...</option>
                {fieldList.map(([k, v]) => <option key={k} value={k}>{k} ({(v as VirsiftFieldInfo).n_unique})</option>)}
              </select>
              <select value={operator} onChange={e => setOperator(e.target.value)}
                style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '3px 6px', fontSize: 10, fontFamily: 'var(--mono)' }}>
                {['contains', 'equals', 'not_equals', 'not_contains', 'starts_with', 'regex'].map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <input value={filterValue} onChange={e => setFilterValue(e.target.value)} placeholder="value..."
                onKeyDown={e => e.key === 'Enter' && applyFilter()}
                style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '3px 6px', fontSize: 10, fontFamily: 'var(--mono)', flex: 1, minWidth: 80 }} />
              <button className="btn ghost" style={{ fontSize: 9 }} onClick={applyFilter} disabled={filterMut.isPending}>Apply</button>
            </div>
            {filterMut.data && <div className="mono" style={{ fontSize: 10, color: 'var(--signal-phos)' }}>{filterMut.data.before_count.toLocaleString()} → {filterMut.data.after_count.toLocaleString()}</div>}

            <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 4, marginTop: 8 }}>QUALITY FILTER</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)' }}>Min len:
                <input value={minLength} onChange={e => setMinLength(e.target.value)} placeholder="1500"
                  style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '2px 4px', fontSize: 10, fontFamily: 'var(--mono)', width: 50, marginLeft: 4 }} />
              </label>
              <label className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={dedup} onChange={e => setDedup(e.target.checked)} /> Dedup
              </label>
              <button className="btn ghost" style={{ fontSize: 9 }} onClick={applyQC} disabled={qualityMut.isPending}>Apply QC</button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="title"><b>SAMPLER</b></span></div>
          <div className="panel-body" style={{ fontSize: 11 }}>
            <div className="mono mute" style={{ fontSize: 10, marginBottom: 8 }}>Lifespan-aware proportional sampling.</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select value={category} onChange={e => setCategory(e.target.value)}
                style={{ background: 'var(--ink-2)', color: 'var(--fg)', border: '1px solid var(--line-soft)', padding: '3px 6px', fontSize: 10, fontFamily: 'var(--mono)' }}>
                <option value="">Auto-detect</option>
                <option value="Micro">Micro</option>
                <option value="Seasonal">Seasonal</option>
                <option value="Endemic">Endemic</option>
              </select>
              <button className="btn ghost" style={{ fontSize: 9 }} onClick={applySample} disabled={sampleMut.isPending}>Run Sampler</button>
            </div>
            {sampleMut.data && (
              <div className="mono" style={{ fontSize: 10, marginTop: 6 }}>
                <span style={{ color: 'var(--signal-phos)' }}>{sampleMut.data.before_count.toLocaleString()} → {sampleMut.data.after_count.toLocaleString()}</span>
                <span className="mute"> · {sampleMut.data.reduction_pct}%</span>
                <span className="chip violet" style={{ fontSize: 8, marginLeft: 6 }}>{sampleMut.data.lifespan_category}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {tl && tl.weekly_counts.length > 0 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-head">
            <span className="title"><b>TIMELINE</b>  /  epidemic wave detection</span>
            <span className="grow" />
            <span className="chip violet" style={{ fontSize: 9 }}>{tl.lifespan_category}</span>
            <span className="mono mute" style={{ fontSize: 10, marginLeft: 8 }}>{tl.wave_count} waves</span>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80, overflow: 'hidden' }}>
              {tl.weekly_counts.map((pt, i) => {
                const h = (pt.count / maxCount) * 70
                const isPeak = tl.peaks.some(p => p.date === pt.period)
                const bg = isPeak ? 'var(--signal-hot)' : 'var(--signal-phos)'
                return <div key={i} title={`${pt.period}: ${pt.count}`}
                  style={{ width: barW, minHeight: 1, height: h, background: bg, opacity: isPeak ? 1 : 0.5, borderRadius: '1px 1px 0 0' }} />
              })}
            </div>
            {tl.peaks.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {tl.peaks.map((p, i) => <span key={i} className="chip hot" style={{ fontSize: 8 }}>#{p.rank} {p.date} ({p.count})</span>)}
              </div>
            )}
          </div>
        </div>
      )}

      {seqData && seqData.rows.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="title"><b>SEQUENCES</b>  /  {seqData.total.toLocaleString()} curated</span>
            <span className="grow" />
            <span className="mono mute" style={{ fontSize: 10 }}>
              page {page + 1}/{totalPages}
              {page > 0 && <button className="btn ghost" style={{ fontSize: 9, marginLeft: 4 }} onClick={() => setPage(p => p - 1)}>←</button>}
              {page < totalPages - 1 && <button className="btn ghost" style={{ fontSize: 9, marginLeft: 4 }} onClick={() => setPage(p => p + 1)}>→</button>}
            </span>
          </div>
          <div className="panel-body" style={{ overflow: 'auto', maxHeight: 300 }}>
            <table className="vs-file-table">
              <thead>
                <tr>
                  {['isolate', 'subtype_clean', 'host', 'location', 'collection_date', 'segment', 'seq_length', 'clade'].map(col =>
                    <th key={col}>{col}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {seqData.rows.map((row: VirsiftSequenceRow, i: number) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--fg)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.isolate}</td>
                    <td style={{ color: 'var(--signal-violet)' }}>{row.subtype_clean}</td>
                    <td>{row.host}</td>
                    <td>{row.location}</td>
                    <td>{row.collection_date || '—'}</td>
                    <td>{row.segment}</td>
                    <td>{row.sequence_length?.toLocaleString()}</td>
                    <td>{row.clade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ParsedHeadersChips({ sessionId }: { sessionId: string }) {
  const fields = useVirsiftFields(sessionId)
  const names = fields.data ? Object.keys(fields.data) : []
  if (!names.length) return null
  return (
    <>
      <div className="mono mute caps" style={{ fontSize: 9, marginBottom: 6 }}>Parsed Headers:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
        {names.map(h => <span key={h} className="chip cool" style={{ fontSize: 8 }}>{h}</span>)}
      </div>
    </>
  )
}

// ─── FileDetailsSidebar ──────────────────────────────────────────────────────

function FileDetailsSidebar({ file, onActivate, onPreview, onExport }: {
  file: WorkspaceFile | null
  onActivate: () => void
  onPreview: () => void
  onExport: () => void
}) {
  if (!file) {
    return (
      <div className="vs-sidebar">
        <div className="mono mute" style={{ fontSize: 11, textAlign: 'center', padding: '40px 0' }}>
          Select a file to view details
        </div>
      </div>
    )
  }

  return (
    <div className="vs-sidebar">
      <div className="mono" style={{ fontSize: 11, color: 'var(--signal-phos)', marginBottom: 4 }}>{file.filename}</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <span className={`chip ${file.status === 'active' ? 'phos' : 'cool'}`} style={{ fontSize: 8 }}>{file.status}</span>
        <span className="chip violet" style={{ fontSize: 8 }}>{file.source}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10, marginBottom: 14 }}>
        {[
          ['Sequences', file.sequences.toLocaleString()],
          ['Subtypes', String(file.subtypes)],
          ['Segments', String(file.segments)],
          ['Date Range', file.date_range[0] ? `${file.date_range[0]} → ${file.date_range[1]}` : '—'],
          ['Parse Time', `${file.parse_time.toFixed(2)} s`],
          ['Header Variant', file.header_variant],
          ['Confidence', `${file.confidence}%`],
          ['Warnings', String(file.warnings)],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="mute">{k}:</span>
            <span style={{ color: k === 'Warnings' && Number(v) > 0 ? 'var(--signal-warm)' : 'var(--fg)' }}>{v}</span>
          </div>
        ))}
      </div>

      <ParsedHeadersChips sessionId={file.session_id} />

      <button onClick={onActivate} style={{
        width: '100%', padding: '8px 0', background: 'var(--signal-phos)', color: '#000',
        border: 'none', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11,
        fontWeight: 600, cursor: 'pointer', marginBottom: 8,
      }}>
        Set as Active Dataset
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onPreview} style={{
          flex: 1, padding: '6px 0', background: 'var(--ink-2)', border: '1px solid var(--line-soft)',
          borderRadius: 3, fontSize: 10, cursor: 'pointer', color: 'var(--fg)', fontFamily: 'var(--mono)',
        }}>Preview</button>
        <button onClick={onExport} style={{
          flex: 1, padding: '6px 0', background: 'var(--ink-2)', border: '1px solid var(--line-soft)',
          borderRadius: 3, fontSize: 10, cursor: 'pointer', color: 'var(--fg)', fontFamily: 'var(--mono)',
        }}>Export</button>
      </div>
    </div>
  )
}

// ─── VirsiftView ─────────────────────────────────────────────────────────────

export default function VirsiftView() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabId>('import')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [urlOpen, setUrlOpen] = useState(false)

  const workspace = useVirsiftWorkspace()
  const validation = useVirsiftValidation(activeSessionId)
  const summary = useVirsiftSummary(activeSessionId)
  const mergeMut = useVirsiftMerge()

  const files = workspace.data ?? []

  const onParsed = useCallback((s: VirsiftParseSummary) => {
    qc.invalidateQueries({ queryKey: ['virsift-workspace'] })
    setActiveSessionId(s.session_id)
    setLastSelectedId(s.session_id)
    setTab('loaded')
  }, [qc])

  const invalidateActive = useCallback(() => {
    if (!activeSessionId) return
    qc.invalidateQueries({ queryKey: ['virsift-session', activeSessionId] })
    qc.invalidateQueries({ queryKey: ['virsift-sequences', activeSessionId] })
    qc.invalidateQueries({ queryKey: ['virsift-timeline', activeSessionId] })
    qc.invalidateQueries({ queryKey: ['virsift-fields', activeSessionId] })
    qc.invalidateQueries({ queryKey: ['virsift-summary', activeSessionId] })
  }, [qc, activeSessionId])

  const toggleSelect = (id: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setLastSelectedId(id)
  }

  const selectAll = () => setSelectedFiles(new Set(files.map(f => f.session_id)))
  const clearSelection = () => setSelectedFiles(new Set())

  const activateSessionIds = async (ids: string[]) => {
    if (ids.length === 0) return
    if (ids.length === 1) {
      setActiveSessionId(ids[0])
      setTab('dataset')
    } else {
      const result = await mergeMut.mutateAsync(ids)
      qc.invalidateQueries({ queryKey: ['virsift-workspace'] })
      setActiveSessionId(result.session_id)
      setTab('dataset')
    }
  }

  const activateSelected = () => activateSessionIds(Array.from(selectedFiles))

  const activateAll = () => {
    if (files.length === 0) return
    const allIds = files.map(f => f.session_id)
    setSelectedFiles(new Set(allIds))
    activateSessionIds(allIds)
  }

  const selectedFile = useMemo(() => {
    if (lastSelectedId) return files.find(f => f.session_id === lastSelectedId) ?? null
    return null
  }, [files, lastSelectedId])

  const totalSeqs = files.reduce((s, f) => s + f.sequences, 0)

  return (
    <div className="virsift-view">
      {/* Toolbar */}
      <div className="vs-toolbar">
        <button onClick={() => { setUrlOpen(false); setTab('import') }}>Import FASTA</button>
        <button onClick={() => { setUrlOpen(true); setTab('import') }}>Import from URL</button>
        <button onClick={() => {
          if (activeSessionId) {
            qc.invalidateQueries({ queryKey: ['virsift-validation', activeSessionId] })
          }
          setTab('review')
        }}>Validate Headers</button>
        <button onClick={selectAll}>Select All</button>
        <button className={selectedFiles.size > 0 ? 'primary' : ''} onClick={activateSelected}
          disabled={selectedFiles.size === 0}>
          Activate Selected
        </button>
        <button onClick={activateAll}>Activate All Loaded Files</button>
        <span className="grow" />
        {selectedFiles.size > 0 && (
          <span className="mono mute" style={{ fontSize: 10 }}>
            {selectedFiles.size} selected · {files.filter(f => selectedFiles.has(f.session_id)).reduce((s, f) => s + f.sequences, 0).toLocaleString()} sequences
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="vs-tabs">
        {[
          { id: 'import' as TabId, label: 'Import Data' },
          { id: 'loaded' as TabId, label: `Loaded Files (${files.length})` },
          { id: 'review' as TabId, label: 'Parser Review' },
          { id: 'dataset' as TabId, label: 'Active Dataset' },
          { id: 'refinery' as TabId, label: 'Sequence Refinery' },
        ].map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div className="vs-main">
        <div className="vs-content">
          {tab === 'import' && <ImportTab onParsed={onParsed} urlOpen={urlOpen} setUrlOpen={setUrlOpen} />}
          {tab === 'loaded' && (
            <LoadedFilesTab
              files={files}
              selected={selectedFiles}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onClear={clearSelection}
            />
          )}
          {tab === 'review' && <ParserReviewTab validation={validation.data} />}
          {tab === 'dataset' && <ActiveDatasetTab summary={summary.data} sessionId={activeSessionId}
            onGoRefinery={() => setTab('refinery')}
            onGoReview={() => setTab('review')}
            onExport={() => { if (activeSessionId) downloadVirsiftExport(activeSessionId) }}
          />}
          {tab === 'refinery' && activeSessionId && (
            <RefineryTab sessionId={activeSessionId} invalidate={invalidateActive} />
          )}
          {tab === 'refinery' && !activeSessionId && (
            <div className="mono mute" style={{ textAlign: 'center', padding: 40 }}>
              No active dataset. Upload and activate files first.
            </div>
          )}
        </div>

        {(tab === 'import' || tab === 'loaded') && (
          <FileDetailsSidebar
            file={selectedFile}
            onActivate={() => {
              if (lastSelectedId) {
                setActiveSessionId(lastSelectedId)
                setTab('dataset')
              }
            }}
            onPreview={() => {
              if (lastSelectedId) {
                setActiveSessionId(lastSelectedId)
                setTab('refinery')
              }
            }}
            onExport={() => {
              if (lastSelectedId) downloadVirsiftExport(lastSelectedId)
            }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="vs-statusbar">
        <div className="dot" style={{ background: 'var(--signal-phos)' }} />
        <span>Ready</span>
        <span style={{ borderLeft: '1px solid var(--line-soft)', paddingLeft: 8 }}>
          {activeSessionId
            ? `${summary.data?.sequences_active?.toLocaleString() ?? '...'} / ${totalSeqs.toLocaleString()} sequences active`
            : `No dataset active`
          }
        </span>
        <span className={`chip ${activeSessionId ? 'phos' : 'warm'}`} style={{ fontSize: 8 }}>
          {activeSessionId ? 'Filtered' : 'Original'}
        </span>
        <span className="grow" />
        <span>Memory: ~{Math.round(totalSeqs * (summary.data?.avg_length ?? 45) / 1e6)} MB</span>
        <span>VirSift v{__APP_VERSION__}</span>
      </div>
    </div>
  )
}
