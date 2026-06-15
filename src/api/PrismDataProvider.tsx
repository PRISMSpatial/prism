import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
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

function or<T>(live: T | undefined, fallback: T): T {
  if (live == null) return fallback
  if (Array.isArray(live) && live.length === 0) return fallback
  return live
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

  const queries = [regions, sources, heatmap, forecast, incidence, phylogeny, molecule, pathogen, metrics, inbox, notebook, drugs]
  const hasError = queries.some(q => q.isError)
  const isLoading = queries.some(q => q.isLoading)

  const [errorShown, setErrorShown] = useState(false)
  useEffect(() => {
    if (hasError && !isLoading && !errorShown) {
      setErrorShown(true)
      console.warn('[PRISM] Some API queries failed — showing fallback data')
    }
    if (!hasError) setErrorShown(false)
  }, [hasError, isLoading, errorShown])

  const data: PrismData = {
    now: new Date().toISOString(),
    pathogen: pathogen.data ?? PRISM_DATA.pathogen,
    sources: or(sources.data, PRISM_DATA.sources),
    regions: or(regions.data, PRISM_DATA.regions),
    clades: or(phylogeny.data?.clades, PRISM_DATA.clades),
    metrics: or(metrics.data, PRISM_DATA.metrics),
    heat: or(heatmap.data, PRISM_DATA.heat),
    forecast: forecast.data ?? PRISM_DATA.forecast,
    incidence: incidence.data ?? PRISM_DATA.incidence,
    tree: phylogeny.data?.tree ?? PRISM_DATA.tree,
    sankey: or(phylogeny.data?.sankey, PRISM_DATA.sankey),
    rootToTip: or(phylogeny.data?.rootToTip, PRISM_DATA.rootToTip),
    mutations: or(molecule.data?.mutations, PRISM_DATA.mutations),
    alignment: or(molecule.data?.alignment, PRISM_DATA.alignment),
    inbox: or(inbox.data, PRISM_DATA.inbox),
    notebook: or(notebook.data, PRISM_DATA.notebook),
    drugCandidates: or(drugs.data, PRISM_DATA.drugCandidates),
  }

  return (
    <PrismDataContext.Provider value={data}>
      {hasError && (
        <div className="api-error-banner" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          padding: '6px 16px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(255,107,74,.15)', color: 'var(--signal-hot)',
          borderBottom: '1px solid rgba(255,107,74,.3)', textAlign: 'center',
        }}>
          API connection issue — displaying cached / fallback data
        </div>
      )}
      {children}
    </PrismDataContext.Provider>
  )
}
