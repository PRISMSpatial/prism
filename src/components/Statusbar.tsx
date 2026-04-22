import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../store'
import { PRISM_DATA } from '../data/mock'
import { TIER_COLORS, STATE_CHIP_CLASS } from '../types/domain'
import { fadeVariants, DUR } from '../motion'

export function Statusbar() {
  const { selected, selectedClade, module } = useAppStore()
  const liveCount = PRISM_DATA.sources.filter(s => s.status === 'live' || s.status === 'fresh').length

  return (
    <footer className="statusbar" role="contentinfo" aria-label="System status">
      <span className="pulse" aria-hidden="true" />
      <span>
        <b style={{ color: 'var(--signal-phos)' }}>{PRISM_DATA.pathogen.name}</b>
      </span>
      <span className="sep">·</span>
      <span>
        streams <b className="s-phos">{liveCount}/{PRISM_DATA.sources.length}</b>
      </span>
      <span className="sep">·</span>
      <span>
        module{' '}
        <AnimatePresence mode="wait">
          <motion.b
            key={module}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DUR.fast } }}
            exit={{ opacity: 0, y: 4, transition: { duration: DUR.fast } }}
            style={{ display: 'inline-block' }}
          >
            {module.toUpperCase()}
          </motion.b>
        </AnimatePresence>
      </span>

      <AnimatePresence>
        {selected && (
          <motion.span
            key={selected.id}
            style={{ display: 'flex', gap: 16, alignItems: 'center' }}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <span className="sep">·</span>
            <span>
              <b style={{ color: TIER_COLORS[selected.tier] }}>{selected.tier}</b>
              {' '}{selected.name}{' '}
              R(t)={' '}
              <b className={`s-${STATE_CHIP_CLASS[selected.state]}`}>
                {selected.rt.toFixed(2)}
              </b>
            </span>
            <span>
              seeding{' '}
              <b>{(selected.seeding * 100).toFixed(1)}%</b>
            </span>
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClade && (
          <motion.span
            key={selectedClade}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <span className="sep">·</span>
            {' '}clade <b>{selectedClade}</b>
          </motion.span>
        )}
      </AnimatePresence>

      <div style={{ flex: 1 }} />
      <span className="faint">{PRISM_DATA.now.slice(0, 10)}</span>
    </footer>
  )
}
