import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, staggerItem, slideUpVariants } from '../../motion'
import { useAppStore } from '../../store'
import { PRISM_DATA } from '../../data/mock'
import { TIER_CHIP_CLASS } from '../../types/domain'
import { CompassGlobe } from './CompassGlobe'
import { TemporalScrubber } from './TemporalScrubber'

// ─── Briefing rail (unchanged) ────────────────────────────────────────────────

function BriefingRail() {
  const { selected, setSelected, setModule } = useAppStore()

  return (
    <motion.div layout className="brief-rail">
      <div className="brief-section">
        <div className="caps mute" style={{ marginBottom: 10 }}>Today's briefing</div>
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          {PRISM_DATA.regions.slice().sort((a, b) => b.seeding - a.seeding).map(r => (
            <motion.button
              key={r.id}
              layout
              variants={staggerItem}
              whileHover={{ x: 3, transition: { duration: 0.1 } }}
              className={`brief-row${selected?.id === r.id ? ' active' : ''}`}
              onClick={() => setSelected(r)}
              aria-pressed={selected?.id === r.id}
            >
              <span className={`chip ${TIER_CHIP_CLASS[r.tier]}`}><i /></span>
              <div className="brief-row-mid">
                <div className="brief-row-name">{r.iso} · {r.name}</div>
                <div className="brief-row-sub mono mute">{r.clade} · R(t) {r.rt.toFixed(2)}</div>
              </div>
              <div className="brief-row-score mono">
                {(r.seeding * 100).toFixed(1)}<span className="mute">%</span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      <div className="brief-section">
        <div className="caps mute" style={{ marginBottom: 10 }}>Stream freshness</div>
        {PRISM_DATA.sources.map(s => (
          <div key={s.id} className="brief-row static">
            <span className={`chip ${s.color}`}><i /></span>
            <div className="brief-row-mid">
              <div className="brief-row-name">{s.name}</div>
              <div className="brief-row-sub mono mute">{s.kind}</div>
            </div>
            <div className={`brief-row-score mono ${s.status === 'stale' ? 's-warm' : 's-phos'}`}>
              {s.latency}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            variants={slideUpVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="brief-section"
          >
            <div className="caps mute" style={{ marginBottom: 10 }}>Selection</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.7 }}>
              <div>REGION  <b style={{ color: 'var(--fg)' }}>{selected.iso}</b></div>
              <div>CLADE   <b style={{ color: 'var(--signal-violet)' }}>{selected.clade}</b></div>
              <div>R(t)    <b style={{ color: 'var(--fg)' }}>{selected.rt.toFixed(2)}</b>{' '}
                <span className="mute">[{selected.rtLo.toFixed(2)}, {selected.rtHi.toFixed(2)}]</span>
              </div>
              <div>PHEN    <b style={{ color: 'var(--fg)' }}>{selected.phen}</b></div>
              <div>CONC    <b style={{ color: selected.concord < 0.7 ? 'var(--signal-warm)' : 'var(--signal-phos)' }}>
                {selected.concord.toFixed(2)}</b>
              </div>
              <div>SEED    <b style={{ color: 'var(--signal-hot)' }}>{(selected.seeding * 100).toFixed(1)}%</b></div>
            </div>
            <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setModule('signals')}>→ TRACE</button>
              <button className="btn" onClick={() => setModule('phylogeny')}>→ STREAM</button>
              <button className="btn" onClick={() => setModule('molecule')}>→ VISOR</button>
              <button className="btn" onClick={() => setModule('forecast')}>→ Forecast</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── HUD overlay (Three.js globe sits behind this) ────────────────────────────

function GlobeHUD() {
  const { selected } = useAppStore()
  return (
    <>
      <div className="compass-legend-top" style={{ pointerEvents: 'none' }}>
        <div className="caps mute">Situation · live</div>
        <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginTop: 4, maxWidth: 440 }}>
          {selected
            ? <>Subclade <em style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>{selected.clade}</em> tracked in{' '}
                <em style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>{selected.name}</em>.</>
            : 'The planet at a glance. Nine regions under active surveillance.'}
        </div>
      </div>

      {/* EpiSplat signal legend bottom-left */}
      <div className="globe-hud bl episplat-legend" style={{ pointerEvents: 'none' }}>
        <div className="caps mute" style={{ marginBottom: 4, fontSize: 9 }}>EPISPLAT ENCODING</div>
        <span><i style={{ background: 'var(--signal-hot)' }} /> RADIUS · PS</span>
        <span><i style={{ background: 'var(--signal-warm)' }} /> BRIGHT · R(t)</span>
        <span><i style={{ background: 'var(--signal-cool)' }} /> COLOR · Subtype</span>
        <span><i style={{ background: 'var(--signal-phos)' }} /> PULSE · H<sub>norm</sub></span>
        <span><i style={{ background: 'var(--signal-violet)' }} /> JITTER · TCC</span>
        <span><i style={{ background: 'var(--signal-pink)' }} /> BLOOM · ETI</span>
        <span><i style={{ background: '#a6b2c2' }} /> SHIMMER · RD</span>
        <span><i style={{ background: '#ff7a3d' }} /> GLOW · Antigenic</span>
      </div>

      {/* Coords top-left */}
      {selected && (
        <div className="globe-hud tl" style={{ pointerEvents: 'none' }}>
          <div>LAT <b>{selected.lat.toFixed(2)}°</b>  LON <b>{selected.lon.toFixed(2)}°</b></div>
          <div>{selected.name.toUpperCase()}</div>
        </div>
      )}

      {/* System info top-right */}
      <div className="globe-hud tr" style={{ pointerEvents: 'none' }}>
        <div>RENDERER <b>WebGL · Three.js</b></div>
        <div>EPISPLAT · CONF <b style={{ color: 'var(--signal-phos)' }}>0.82</b></div>
      </div>
    </>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function CompassView() {
  return (
    <div className="compass-view">
      <div className="compass-canvas">
        <CompassGlobe />
        <GlobeHUD />
        <TemporalScrubber />
      </div>
      <BriefingRail />
    </div>
  )
}
