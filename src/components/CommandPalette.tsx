import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../store'
import { PRISM_DATA } from '../data/mock'
import type { ModuleId } from '../types/domain'
import { backdropVariants, overlayVariants, staggerContainer, staggerItem } from '../motion'

interface CmdItem {
  id: string
  label: string
  desc: string
  kbd?: string
  action: () => void
}

export function CommandPalette() {
  const { cmdkOpen, setCmdkOpen, setModule, setSelected, setSelectedClade } = useAppStore()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const modules: CmdItem[] = [
    { id: 'compass',   label: 'C.O.M.P.A.S.S. — Globe',        desc: 'Global situation overview',            kbd: '1', action: () => { setModule('compass');   setCmdkOpen(false) } },
    { id: 'signals',   label: 'T.R.A.C.E. — Anomaly heatmap',  desc: 'Transmission phenotype classification', kbd: '2', action: () => { setModule('signals');   setCmdkOpen(false) } },
    { id: 'phylogeny', label: 'S.T.R.E.A.M. — Phylogeny',      desc: 'Clade flow & molecular clock',         kbd: '3', action: () => { setModule('phylogeny'); setCmdkOpen(false) } },
    { id: 'molecule',  label: 'V.I.S.O.R. — Molecular viewer',  desc: 'Protein structure & mutations',        kbd: '4', action: () => { setModule('molecule');  setCmdkOpen(false) } },
    { id: 'forecast',  label: 'SEIR Forecast',                  desc: 'R(t) ensemble forecasting',            kbd: '5', action: () => { setModule('forecast');  setCmdkOpen(false) } },
    { id: 'sources',   label: 'V.I.R.S.I.F.T. — Data streams', desc: 'Ingestion stream health',              kbd: '6', action: () => { setModule('sources');   setCmdkOpen(false) } },
    { id: 'report',    label: 'Situation Report',                desc: 'Export-ready sitrep',                  kbd: '7', action: () => { setModule('report');    setCmdkOpen(false) } },
  ]

  const regionItems: CmdItem[] = PRISM_DATA.regions.map(r => ({
    id: `r-${r.id}`,
    label: `${r.id} — ${r.name}`,
    desc: `${r.tier} · ${r.phen} · R(t) ${r.rt.toFixed(2)}`,
    action: () => { setSelected(r); setModule('compass'); setCmdkOpen(false) },
  }))

  const cladeItems: CmdItem[] = PRISM_DATA.clades.map(c => ({
    id: `c-${c.id}`,
    label: `Clade ${c.id}`,
    desc: `n=${c.n} · fitness ${c.fitness > 0 ? '+' : ''}${c.fitness.toFixed(2)} · origin ${c.origin}`,
    action: () => { setSelectedClade(c.id); setModule('phylogeny'); setCmdkOpen(false) },
  }))

  const allItems = [...modules, ...regionItems, ...cladeItems]
  const filtered = query.trim()
    ? allItems.filter(i =>
        i.label.toLowerCase().includes(query.toLowerCase()) ||
        i.desc.toLowerCase().includes(query.toLowerCase())
      )
    : allItems

  useEffect(() => {
    if (cmdkOpen) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [cmdkOpen])

  useEffect(() => { setActiveIdx(0) }, [query])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[activeIdx]) filtered[activeIdx].action()
    if (e.key === 'Escape') setCmdkOpen(false)
  }, [filtered, activeIdx, setCmdkOpen])

  return (
    <AnimatePresence>
      {cmdkOpen && (
        <motion.div
          className="cmdk-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          variants={backdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={e => { if (e.target === e.currentTarget) setCmdkOpen(false) }}
        >
          <motion.div
            className="cmdk"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search modules, regions, clades…"
              aria-label="Command palette search"
              autoComplete="off"
              spellCheck={false}
            />
            <motion.div
              className="cmdk-list"
              role="listbox"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  className={`cmdk-item${i === activeIdx ? ' active' : ''}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  variants={staggerItem}
                  onClick={item.action}
                  onMouseEnter={() => setActiveIdx(i)}
                  whileHover={{ x: 3 }}
                  transition={{ duration: 0.1 }}
                >
                  <span>{item.label}</span>
                  <span className="desc">{item.desc}</span>
                  {item.kbd && <span className="kbd">{item.kbd}</span>}
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <motion.div className="cmdk-item" variants={staggerItem} style={{ color: 'var(--fg-mute)' }}>
                  No results
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
