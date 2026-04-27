import { create } from 'zustand'
import type { ModuleId, Region, Tweaks } from '../types/domain'
import { DEFAULT_TWEAKS } from '../types/domain'

interface AppStore {
  module: ModuleId
  selected: Region | null
  selectedClade: string | null
  tweaks: Tweaks
  cmdkOpen: boolean
  tweaksOpen: boolean
  currentWeek: number   // 0-11 temporal scrubber index
  playing: boolean      // scrubber playback state

  setModule: (id: ModuleId) => void
  setSelected: (r: Region | null) => void
  setSelectedClade: (id: string | null) => void
  setTweaks: (patch: Partial<Tweaks>) => void
  setCmdkOpen: (open: boolean) => void
  setTweaksOpen: (open: boolean) => void
  setCurrentWeek: (w: number) => void
  setPlaying: (p: boolean) => void

  // Convenience: update multiple fields at once (matches prototype `set()` pattern)
  patch: (p: Partial<Pick<AppStore, 'module' | 'selected' | 'selectedClade'>>) => void
}

export const useAppStore = create<AppStore>((set) => ({
  module: 'compass',
  selected: null,
  selectedClade: null,
  tweaks: DEFAULT_TWEAKS,
  cmdkOpen: false,
  tweaksOpen: false,
  currentWeek: 11,
  playing: false,

  setModule: (id) => set({ module: id }),
  setSelected: (r) => set({ selected: r }),
  setSelectedClade: (id) => set({ selectedClade: id }),
  setTweaks: (p) => set((s) => ({ tweaks: { ...s.tweaks, ...p } })),
  setCmdkOpen: (open) => set({ cmdkOpen: open }),
  setTweaksOpen: (open) => set({ tweaksOpen: open }),
  setCurrentWeek: (w) => set({ currentWeek: w }),
  setPlaying: (p) => set({ playing: p }),

  patch: (p) => set((s) => ({
    module: p.module ?? s.module,
    selected: 'selected' in p ? p.selected ?? null : s.selected,
    selectedClade: 'selectedClade' in p ? p.selectedClade ?? null : s.selectedClade,
  })),
}))
