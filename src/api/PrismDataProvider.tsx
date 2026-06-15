import { createContext, useContext, type ReactNode } from 'react'
import type { PrismData } from '../types/domain'
import { PRISM_DATA } from '../data/mock'
import {
  useRegions, useSources, useHeatmap, useForecast, useIncidence,
  usePhylogeny, useMolecule, usePathogen, useMetrics, useInbox,
  useNotebook, useDrugs,
} from './queries'

const PrismDataContext = createContext<PrismData>(PRISM_DATA)

export function usePrismData(): PrismData {
  return useContext(PrismDataContext)
}

export function PrismDataProvider({ children }: { children: ReactNode }) {
  const regions = useRegions()
  const sources = useSources()
  const heatmap = useHeatmap()
  const forecast = useForecast()
  const incidence = useIncidence()
  const phylogeny = usePhylogeny()
  const molecule = useMolecule()
  const pathogen = usePathogen()
  const metrics = useMetrics()
  const inbox = useInbox()
  const notebook = useNotebook()
  const drugs = useDrugs()

  const data: PrismData = {
    now: new Date().toISOString(),
    pathogen: pathogen.data ?? PRISM_DATA.pathogen,
    sources: sources.data ?? PRISM_DATA.sources,
    regions: regions.data ?? PRISM_DATA.regions,
    clades: phylogeny.data?.clades ?? PRISM_DATA.clades,
    metrics: metrics.data ?? PRISM_DATA.metrics,
    heat: heatmap.data ?? PRISM_DATA.heat,
    forecast: forecast.data ?? PRISM_DATA.forecast,
    incidence: incidence.data ?? PRISM_DATA.incidence,
    tree: phylogeny.data?.tree ?? PRISM_DATA.tree,
    sankey: phylogeny.data?.sankey ?? PRISM_DATA.sankey,
    rootToTip: phylogeny.data?.rootToTip ?? PRISM_DATA.rootToTip,
    mutations: molecule.data?.mutations ?? PRISM_DATA.mutations,
    alignment: molecule.data?.alignment ?? PRISM_DATA.alignment,
    inbox: inbox.data ?? PRISM_DATA.inbox,
    notebook: notebook.data ?? PRISM_DATA.notebook,
    drugCandidates: drugs.data ?? PRISM_DATA.drugCandidates,
  }

  return (
    <PrismDataContext.Provider value={data}>
      {children}
    </PrismDataContext.Provider>
  )
}
