/* TRACE — Inbox subcomponent */
import { PRISM_DATA } from '../../data/mock'
import type { Region, InboxItem } from '../../types/domain'
import { TIER_CHIP_CLASS } from '../../types/domain'

interface InboxProps {
  onOpenRegion: (region: Region) => void
  onSelect: (item: InboxItem) => void
  selectedId: string | undefined
}

export default function Inbox({ onOpenRegion, onSelect, selectedId }: InboxProps) {
  const statusColor = (s: string): string =>
    ({ open: 'hot', investigating: 'warm', escalated: 'pink', dismissed: '' }[s] ?? '')

  const regById = Object.fromEntries(PRISM_DATA.regions.map(r => [r.id, r]))

  return (
    <div className="inbox">
      {PRISM_DATA.inbox.map(it => {
        const reg = regById[it.region]
        const active = selectedId === it.id
        return (
          <button
            key={it.id}
            className={'inbox-item ' + (active ? 'active' : '') + (it.status === 'dismissed' ? ' dismissed' : '')}
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
          </button>
        )
      })}
    </div>
  )
}
