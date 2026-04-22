import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store'
import type { ModuleId } from '../types/domain'
import { EASE, DUR } from '../motion'

interface RailModule {
  id: ModuleId
  key: string
  label: string
  icon: React.ReactNode
}

const MODULES: RailModule[] = [
  {
    id: 'compass', key: '1', label: 'C.O.M.P.A.S.S.',
    icon: <svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="7"/><circle cx="9" cy="9" r="3"/><line x1="9" y1="2" x2="9" y2="6"/><line x1="9" y1="12" x2="9" y2="16"/></svg>,
  },
  {
    id: 'signals', key: '2', label: 'T.R.A.C.E.',
    icon: <svg viewBox="0 0 18 18"><rect x="2" y="3" width="14" height="12" rx="1"/><line x1="5" y1="9" x2="7" y2="6"/><line x1="7" y1="6" x2="9" y2="11"/><line x1="9" y1="11" x2="11" y2="8"/><line x1="11" y1="8" x2="13" y2="9"/></svg>,
  },
  {
    id: 'phylogeny', key: '3', label: 'S.T.R.E.A.M.',
    icon: <svg viewBox="0 0 18 18"><line x1="3" y1="9" x2="7" y2="9"/><line x1="7" y1="5" x2="7" y2="13"/><line x1="7" y1="5" x2="15" y2="5"/><line x1="7" y1="9" x2="15" y2="9"/><line x1="7" y1="13" x2="15" y2="13"/></svg>,
  },
  {
    id: 'molecule', key: '4', label: 'V.I.S.O.R.',
    icon: <svg viewBox="0 0 18 18"><circle cx="6" cy="6" r="3"/><circle cx="12" cy="12" r="3"/><line x1="8.1" y1="8.1" x2="9.9" y2="9.9"/></svg>,
  },
  {
    id: 'forecast', key: '5', label: 'SEIR Forecast',
    icon: <svg viewBox="0 0 18 18"><polyline points="2,14 6,9 9,11 13,5 16,7"/><line x1="2" y1="16" x2="16" y2="16"/></svg>,
  },
  {
    id: 'sources', key: '6', label: 'V.I.R.S.I.F.T.',
    icon: <svg viewBox="0 0 18 18"><rect x="3" y="3" width="12" height="12" rx="1"/><line x1="3" y1="7" x2="15" y2="7"/><line x1="3" y1="11" x2="15" y2="11"/><line x1="7" y1="7" x2="7" y2="15"/></svg>,
  },
  {
    id: 'report', key: '7', label: 'Situation Report',
    icon: <svg viewBox="0 0 18 18"><rect x="3" y="2" width="12" height="14" rx="1"/><line x1="6" y1="6" x2="12" y2="6"/><line x1="6" y1="9" x2="12" y2="9"/><line x1="6" y1="12" x2="10" y2="12"/></svg>,
  },
]

export function Rail() {
  const { module, setModule } = useAppStore()

  return (
    <nav className="rail" aria-label="Module navigation">
      {MODULES.map(m => {
        const active = module === m.id
        return (
          <motion.button
            key={m.id}
            className={active ? 'active' : ''}
            onClick={() => setModule(m.id)}
            aria-label={m.label}
            aria-current={active ? 'page' : undefined}
            title={`${m.label} [${m.key}]`}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: DUR.fast, ease: EASE }}
          >
            {/* Animated active bar */}
            <AnimatePresence>
              {active && (
                <motion.span
                  style={{
                    position: 'absolute',
                    left: -10, top: 8, bottom: 8,
                    width: 2,
                    background: 'var(--signal-phos)',
                    borderRadius: 1,
                  }}
                  layoutId="rail-active-bar"
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  transition={{ duration: DUR.base, ease: EASE }}
                />
              )}
            </AnimatePresence>

            {/* Icon — subtle color transition */}
            <motion.span
              animate={{ color: active ? 'var(--signal-phos)' : 'var(--fg-mute)' }}
              transition={{ duration: DUR.base }}
              style={{ display: 'grid', placeItems: 'center' }}
            >
              {m.icon}
            </motion.span>

            <span className="rail-tooltip">{m.label} <span className="kbd">{m.key}</span></span>
          </motion.button>
        )
      })}
      <div className="spacer" />
    </nav>
  )
}
