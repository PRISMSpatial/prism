// TemporalScrubber — 12-week timeline control for COMPASS view
// Drives currentWeek in the Zustand store for temporal playback

import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store'

const WEEKS = 12
const PLAY_INTERVAL = 1500 // ms per week step

function weekLabel(w: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (WEEKS - 1 - w) * 7)
  return d.toISOString().slice(5, 10) // MM-DD
}

export function TemporalScrubber() {
  const { currentWeek, setCurrentWeek, playing, setPlaying } = useAppStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Auto-advance when playing
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!playing) return
    intervalRef.current = setInterval(() => {
      const w = useAppStore.getState().currentWeek
      setCurrentWeek(w >= WEEKS - 1 ? 0 : w + 1)
    }, PLAY_INTERVAL)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, setCurrentWeek])

  const toggle = useCallback(() => setPlaying(!playing), [playing, setPlaying])
  const stepBack = useCallback(() => setCurrentWeek(Math.max(0, currentWeek - 1)), [currentWeek, setCurrentWeek])
  const stepFwd = useCallback(() => setCurrentWeek(Math.min(WEEKS - 1, currentWeek + 1)), [currentWeek, setCurrentWeek])

  return (
    <div className="temporal-scrubber">
      <button className="scrubber-btn" onClick={stepBack} title="Step back">&#x25C0;</button>
      <button className="scrubber-btn play" onClick={toggle} title={playing ? 'Pause' : 'Play'}>
        {playing ? '\u23F8' : '\u25B6'}
      </button>
      <button className="scrubber-btn" onClick={stepFwd} title="Step forward">&#x25B6;</button>

      <div className="scrubber-track">
        <input
          type="range"
          min={0}
          max={WEEKS - 1}
          value={currentWeek}
          onChange={e => setCurrentWeek(Number(e.target.value))}
          className="scrubber-range"
        />
        <div className="scrubber-ticks">
          {Array.from({ length: WEEKS }, (_, i) => (
            <span
              key={i}
              className={`scrubber-tick${i === currentWeek ? ' active' : ''}`}
            />
          ))}
        </div>
      </div>

      <span className="scrubber-label">
        W{currentWeek + 1} · {weekLabel(currentWeek)}
      </span>
    </div>
  )
}
