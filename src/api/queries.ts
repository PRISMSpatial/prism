import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import { PRISM_DATA } from '../data/mock'
import type { Region, DataSource, HeatRow, ForecastData, PrismData } from '../types/domain'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV

// Helper: fall back to mock data when API is unavailable
async function fetchOrMock<T>(url: string, mockData: T): Promise<T> {
  if (USE_MOCK) return mockData
  const res = await apiClient.get<T>(url)
  return res.data
}

export function useRegions() {
  return useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetchOrMock('/regions', PRISM_DATA.regions),
    refetchInterval: 60_000,
  })
}

export function useSources() {
  return useQuery<DataSource[]>({
    queryKey: ['sources'],
    queryFn: () => fetchOrMock('/sources', PRISM_DATA.sources),
    refetchInterval: 30_000,
  })
}

export function useHeatmap() {
  return useQuery<HeatRow[]>({
    queryKey: ['heatmap'],
    queryFn: () => fetchOrMock('/heatmap', PRISM_DATA.heat),
    refetchInterval: 300_000,
  })
}

export function useForecast(regionId?: string) {
  return useQuery<ForecastData>({
    queryKey: ['forecast', regionId],
    queryFn: () => fetchOrMock(
      regionId ? `/forecast/${regionId}` : '/forecast',
      PRISM_DATA.forecast,
    ),
    staleTime: 5 * 60_000,
  })
}

export function usePhylogeny() {
  return useQuery({
    queryKey: ['phylogeny'],
    queryFn: () => fetchOrMock('/phylogeny', {
      tree: PRISM_DATA.tree,
      sankey: PRISM_DATA.sankey,
      rootToTip: PRISM_DATA.rootToTip,
      clades: PRISM_DATA.clades,
    }),
    staleTime: 10 * 60_000,
  })
}

export function useMolecule() {
  return useQuery({
    queryKey: ['molecule'],
    queryFn: () => fetchOrMock('/molecule', {
      mutations: PRISM_DATA.mutations,
      alignment: PRISM_DATA.alignment,
    }),
    staleTime: 30 * 60_000,
  })
}
