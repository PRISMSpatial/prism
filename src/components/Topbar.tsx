import { useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { PRISM_DATA } from '../data/mock'

const MODULE_LABELS: Record<string, string> = {
  compass: 'C.O.M.P.A.S.S.',
  signals: 'T.R.A.C.E.',
  phylogeny: 'S.T.R.E.A.M.',
  molecule: 'V.I.S.O.R.',
  forecast: 'SEIR Forecast',
  sources: 'V.I.R.S.I.F.T.',
  report: 'Situation Report',
}

export function Topbar() {
  const { module, setCmdkOpen, setTweaksOpen } = useAppStore()
  const [utcNow, setUtcNow] = useState('')

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setUtcNow(d.toUTCString().slice(17, 25) + ' UTC')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="topbar" role="banner">
      <div className="logo" aria-label="PRISM">
        <div className="logo-mark" aria-hidden="true" />
        <span className="logo-name">PRISM</span>
        <span className="logo-meta">SURVEILLANCE</span>
      </div>

      <span className="topbar-crumb" aria-live="polite">
        <span className="mute">{PRISM_DATA.pathogen.name}</span>
        {' / '}
        <b>{MODULE_LABELS[module]}</b>
      </span>

      <div className="topbar-spacer" />

      <div className="topbar-now" aria-label="Live UTC clock">
        <div className="dot" aria-hidden="true" />
        <span className="mono">{utcNow}</span>
      </div>

      <button
        className="topbar-cmd"
        onClick={() => setCmdkOpen(true)}
        aria-label="Open command palette (⌘K)"
      >
        <svg width="13" height="13" viewBox="0 0 18 18" stroke="currentColor" fill="none" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8" cy="8" r="5.5"/>
          <line x1="12" y1="12" x2="16" y2="16"/>
        </svg>
        Search
        <span className="kbd">⌘K</span>
      </button>

      <button
        className="topbar-user"
        onClick={() => setTweaksOpen(true)}
        aria-label="Open tweaks panel"
        title="Edit mode / tweaks"
      >
        PR
      </button>
    </header>
  )
}
