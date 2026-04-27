import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../store'
import type { Tweaks } from '../types/domain'
import { panelVariants } from '../motion'

type TweakKey = keyof Tweaks
interface TweakOption { value: string; label: string }

const TWEAK_DEFS: { key: TweakKey; label: string; options: TweakOption[] }[] = [
  {
    key: 'accent', label: 'Accent color',
    options: [{ value: 'phos', label: 'Phosphor' }, { value: 'cool', label: 'Cool' }, { value: 'violet', label: 'Violet' }],
  },
  {
    key: 'density', label: 'Density',
    options: [{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Relaxed' }],
  },
  {
    key: 'heatScale', label: 'Heat scale',
    options: [{ value: 'linear', label: 'Linear' }, { value: 'sqrt', label: '√ Root' }, { value: 'log', label: 'Log' }],
  },
  {
    key: 'rotation', label: 'Globe rotation',
    options: [{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }],
  },
  {
    key: 'copy', label: 'Copy tone',
    options: [{ value: 'clinical', label: 'Clinical' }, { value: 'technical', label: 'Technical' }, { value: 'brief', label: 'Brief' }],
  },
  {
    key: 'episplat', label: 'EpiSplat signals',
    options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
  },
  {
    key: 'filaments', label: 'Phylo-filaments',
    options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
  },
  {
    key: 'graticule', label: 'Globe graticule',
    options: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
  },
]

export function TweaksPanel() {
  const { tweaksOpen, setTweaksOpen, tweaks, setTweaks } = useAppStore()

  return (
    <AnimatePresence>
      {tweaksOpen && (
        <motion.div
          className="tweaks"
          role="dialog"
          aria-label="Tweaks panel"
          variants={panelVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="tweaks-head">
            <span className="title">EDIT MODE · <b>tweaks</b></span>
            <motion.button
              onClick={() => setTweaksOpen(false)}
              aria-label="Close tweaks"
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              ✕
            </motion.button>
          </div>
          <div className="tweaks-body">
            {TWEAK_DEFS.map((def, di) => (
              <motion.div
                key={def.key}
                className="tweak"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: di * 0.04, duration: 0.22 } }}
              >
                <span className="tweak-label">{def.label}</span>
                <div className="tweak-row">
                  {def.options.map(opt => (
                    <motion.button
                      key={opt.value}
                      className={`tweak-opt${tweaks[def.key] === opt.value ? ' active' : ''}`}
                      onClick={() => setTweaks({ [def.key]: opt.value } as Partial<Tweaks>)}
                      aria-pressed={tweaks[def.key] === opt.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {opt.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
