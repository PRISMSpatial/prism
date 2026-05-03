import { PRISM_DATA } from '../../data/mock'
import { downloadExport } from '../../api/queries'

// Minimal inline FanChart for the report (uses the forecast data)
function ReportFanChart() {
  const fc = PRISM_DATA.forecast
  const W = 560
  const H = 120
  const pad = { l: 30, r: 10, t: 10, b: 20 }
  const n = fc.median.length
  const yMax = 1.8
  const yMin = -0.5
  const xScale = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r)
  const yScale = (v: number) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b)

  const polyPts = (arr: [number, number][], dir: 'top' | 'bot') =>
    arr.map((v, i) => `${xScale(i)},${yScale(dir === 'top' ? v[1] : v[0])}`).join(' ')

  const medianPath = fc.median.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`).join(' ')
  const nowX = xScale(fc.now)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', height: H }}>
      {/* 95% CI band */}
      <polygon points={`${polyPts(fc.p95, 'top')} ${polyPts([...fc.p95].reverse(), 'bot')}`}
        fill="rgba(158,242,119,.07)" />
      {/* 80% CI band */}
      <polygon points={`${polyPts(fc.p80, 'top')} ${polyPts([...fc.p80].reverse(), 'bot')}`}
        fill="rgba(158,242,119,.11)" />
      {/* 50% CI band */}
      <polygon points={`${polyPts(fc.p50, 'top')} ${polyPts([...fc.p50].reverse(), 'bot')}`}
        fill="rgba(158,242,119,.18)" />
      {/* Median */}
      <path d={medianPath} fill="none" stroke="var(--signal-phos)" strokeWidth="1.5"
        strokeDasharray={`${(nowX - 30)} 0 0 1000`} />
      {/* NOW line */}
      <line x1={nowX} y1={pad.t} x2={nowX} y2={H - pad.b} stroke="rgba(255,255,255,.2)" strokeWidth="1" />
      <text x={nowX + 3} y={pad.t + 8} fill="rgba(255,255,255,.4)" fontSize="8" fontFamily="JetBrains Mono">NOW</text>
      {/* R=1 line */}
      <line x1={pad.l} y1={yScale(1)} x2={W - pad.r} y2={yScale(1)}
        stroke="rgba(255,107,74,.3)" strokeWidth="0.5" strokeDasharray="3 3" />
    </svg>
  )
}

export default function ReportView() {
  const nsk = PRISM_DATA.regions.find(r => r.id === 'NSK')!

  return (
    <div className="paper-root">
      <div className="paper-header">
        <div className="paper-stamp">CONFIDENTIAL · T3 · INTERNAL DISTRIBUTION</div>
        <div className="paper-meta">
          <div>SITREP № <b>2026-W16-0047</b></div>
          <div>2026-04-21 · 09:14 UTC</div>
        </div>
      </div>

      <div className="paper-title">
        <div className="paper-kicker">Situation Report</div>
        <h1>Novosibirsk oblast · H3N2 · clade B.1.7.2</h1>
        <div className="paper-subtitle">
          Seeding score <b>{(nsk.seeding * 100).toFixed(1)}%</b>. R(t) <b>{nsk.rt.toFixed(2)}</b> [{nsk.rtLo.toFixed(2)}, {nsk.rtHi.toFixed(2)}].
          Five metrics trending; wastewater concordance elevated.
        </div>
      </div>

      <div className="paper-pullquote">
        <div className="paper-pq-mark">❝</div>
        <div className="paper-pq-body">
          A subclade of H3N2 tracked in Novosibirsk crosses the <em>Observe → Investigate</em> threshold for the second
          consecutive week, driven by a 0.24 fitness gain in B.1.7.2 and wastewater signal leading clinical incidence by 9 days.
        </div>
      </div>

      <div className="paper-section">
        <div className="paper-section-num">01</div>
        <div>
          <h2>At a glance</h2>
          <div className="paper-metrics">
            <div><div className="caps-serif">Seeding</div><div className="paper-metric-val">{(nsk.seeding * 100).toFixed(1)}<span>%</span></div></div>
            <div><div className="caps-serif">R(t)</div><div className="paper-metric-val">{nsk.rt.toFixed(2)}</div></div>
            <div><div className="caps-serif">Confidence</div><div className="paper-metric-val">{nsk.concord.toFixed(2)}</div></div>
            <div><div className="caps-serif">Phenotype</div><div className="paper-metric-val" style={{ fontSize: 22 }}>Endemic</div></div>
            <div><div className="caps-serif">Concordance</div><div className="paper-metric-val">{nsk.concord.toFixed(2)}</div></div>
          </div>
        </div>
      </div>

      <div className="paper-section">
        <div className="paper-section-num">02</div>
        <div>
          <h2>Evidence</h2>
          <div className="paper-evidence">
            <div className="paper-ev-row">
              <div className="paper-ev-src">Clinical · FluNet</div>
              <div className="paper-ev-body">
                ILI incidence at <b>96.4 / 100k</b>, +24% WoW. Test positivity 31%. H3 fraction dominant at 78%.
                Signal first crossed alert threshold on <span className="mono">2026-04-07</span>.
              </div>
            </div>
            <div className="paper-ev-row">
              <div className="paper-ev-src">Genomic · GISAID</div>
              <div className="paper-ev-body">
                47 sequences within clade <span className="mono">B.1.7.2</span>, first dated <span className="mono">2026-02-14</span>.
                Root-to-tip divergence consistent with 3.4e−3 subs/site/yr clock. HA mutations
                <span className="mono"> Q226L, S193F, N158K</span> at antigenic sites.
              </div>
            </div>
            <div className="paper-ev-row">
              <div className="paper-ev-src">Wastewater · Biobot</div>
              <div className="paper-ev-body">
                Influenza A RNA copies up <b>3.1× baseline</b> at 4 of 5 Novosibirsk plants. Signal leads clinical by <b>~9 days</b>.
              </div>
            </div>
            <div className="paper-ev-row">
              <div className="paper-ev-src">Mobility · OpenSky</div>
              <div className="paper-ev-body">
                Outbound passenger edges to Caspian basin and Red River delta above 75th percentile.
                Concordance with genomic intros: <b>0.82</b>.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="paper-section">
        <div className="paper-section-num">03</div>
        <div>
          <h2>Forecast · 13-week horizon</h2>
          <div className="paper-forecast">
            <ReportFanChart />
          </div>
          <div className="paper-note">
            Median trajectory crosses <span className="mono">R=1</span> below on <span className="mono">2026-W22</span> under baseline.
            Under surge, peak <span className="mono">ILI/100k = 130</span> at W22. Under intervention (antivirals + advisory),
            peak compressed to <span className="mono">67</span> at W19.
          </div>
        </div>
      </div>

      <div className="paper-section">
        <div className="paper-section-num">04</div>
        <div>
          <h2>Assessment</h2>
          <p className="paper-body-text">
            The subclade meets all three criteria for escalation to <b>Investigate</b>: novelty score sustained above 0.9 for three
            consecutive weeks, multi-stream concordance above 0.8, and fitness advantage inferred from root-to-tip residuals. The
            <span className="mono"> Q226L</span> substitution is structurally consistent with receptor-binding preference
            shift; the <span className="mono">S193F</span> substitution lies within Koel antigenic cluster A and warrants
            serological follow-up.
          </p>
          <p className="paper-body-text">
            Probability of regional expansion to Caspian basin within 30 days: <b>0.41</b> [0.28, 0.56].
            Probability of detection in a T1 hub (LHR, JFK, NRT) within 60 days: <b>0.28</b> [0.19, 0.39].
          </p>
        </div>
      </div>

      <div className="paper-section">
        <div className="paper-section-num">05</div>
        <div>
          <h2>Recommended actions</h2>
          <ol className="paper-actions">
            <li><b>Escalate</b> anomaly ANM-2026-0412 to <em>Investigate</em> in TRACE inbox.</li>
            <li><b>Request</b> 50 additional sequences from Novosibirsk reference lab via GISAID priority queue.</li>
            <li><b>Schedule</b> antigenic characterization of A/Novosibirsk/0047/2026 against 2025–26 vaccine strain.</li>
            <li><b>Notify</b> WHO collaborating centres (Melbourne, London, Memphis, Beijing, Tokyo) and FAO avian network.</li>
            <li><b>Monitor</b> concordance of wastewater signal in Omsk and Tomsk over next 7 days.</li>
          </ol>
        </div>
      </div>

      <div className="paper-footer">
        <div>PRISM · EpiSplat v3.1 · confidence {nsk.concord.toFixed(2)}</div>
        <div>Prepared by <b>j.ortega</b> · countersigned by <b>m.tanaka</b></div>
        <div>PAGE 1 · OF 4</div>
      </div>

      <div className="row" style={{ marginTop: 20, gap: 8, justifyContent: 'center' }}>
        <button className="btn" onClick={() => downloadExport('report')}>Export PDF</button>
        <button className="btn ghost" onClick={() => downloadExport('csv')}>Export CSV</button>
        <button className="btn ghost" onClick={() => downloadExport('json')}>Export JSON</button>
      </div>
    </div>
  )
}
