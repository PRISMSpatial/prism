// DrugPanel — drug-design interface showing candidate compounds
// Displays binding pocket summary and compound affinity/selectivity

import { PRISM_DATA } from '../../data/mock'

const STATUS_CHIP: Record<string, string> = {
  lead: 'phos',
  candidate: 'cool',
  preclinical: 'warm',
  screening: 'violet',
}

export function DrugPanel() {
  const candidates = PRISM_DATA.drugCandidates

  return (
    <div className="drug-panel">
      <div className="caps mute" style={{ marginBottom: 8, fontSize: 9 }}>BINDING POCKET · HA1 HEAD DOMAIN</div>

      <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-dim)', lineHeight: 1.8, marginBottom: 14 }}>
        <div>TARGET   <b style={{ color: 'var(--fg)' }}>HA receptor binding site</b></div>
        <div>POCKET   <b style={{ color: 'var(--fg)' }}>Sa/Sb antigenic ridge</b></div>
        <div>VOLUME   <b style={{ color: 'var(--fg)' }}>842 A<sup>3</sup></b></div>
      </div>

      <div className="caps mute" style={{ marginBottom: 6, fontSize: 9 }}>CANDIDATE COMPOUNDS</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {candidates.map(c => (
          <div key={c.name} className="drug-row">
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg)', marginBottom: 2 }}>{c.name}</div>
              <span className={`chip ${STATUS_CHIP[c.status] ?? ''}`} style={{ fontSize: 9 }}>
                <i />{c.status.toUpperCase()}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textAlign: 'right' }}>
              <div>AFF <b style={{ color: c.affinity > 0.85 ? 'var(--signal-phos)' : 'var(--fg)' }}>
                {c.affinity.toFixed(2)}</b></div>
              <div>SEL <b style={{ color: c.selectivity > 0.85 ? 'var(--signal-phos)' : 'var(--fg)' }}>
                {c.selectivity.toFixed(2)}</b></div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn" style={{ marginTop: 14, width: '100%' }}>
        Launch rational design
      </button>
    </div>
  )
}
