import { useEffect } from 'react'
import { useAppStore } from '../store'
import type { ModuleId } from '../types/domain'

const MODULE_KEYS: Record<string, ModuleId> = {
  '1': 'compass',
  '2': 'signals',
  '3': 'phylogeny',
  '4': 'molecule',
  '5': 'forecast',
  '6': 'sources',
  '7': 'report',
}

export function useKeyboardShortcuts() {
  const { setModule, setCmdkOpen, cmdkOpen } = useAppStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // ⌘K / Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen(!cmdkOpen)
        return
      }

      // Escape → close overlays
      if (e.key === 'Escape') {
        setCmdkOpen(false)
        return
      }

      // 1-7 → switch modules (only when not in input)
      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey && MODULE_KEYS[e.key]) {
        setModule(MODULE_KEYS[e.key])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setModule, setCmdkOpen, cmdkOpen])
}
