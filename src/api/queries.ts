import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from './client'
import { PRISM_DATA } from '../data/mock'
import type {
  Region, DataSource, HeatRow, ForecastData, IncidenceData,
  Metric, InboxItem, NotebookCell, Pathogen, DrugCandidate, Clade,
  Mutation, AlignmentChar, TreeNode, ReassortmentBridge,
  SankeyFlow, RootToTipPoint,
} from '../types/domain'

const USE_MOCK = import.meta.env.VITE_USE_MOCK
  ? import.meta.env.VITE_USE_MOCK === 'true'
  : import.meta.env.DEV

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

export function useIncidence() {
  return useQuery<IncidenceData>({
    queryKey: ['incidence'],
    queryFn: () => fetchOrMock('/incidence', PRISM_DATA.incidence),
    staleTime: 5 * 60_000,
  })
}

export function usePhylogeny() {
  return useQuery<{
    tree: { nodes: TreeNode[]; reassortmentBridges: ReassortmentBridge[] }
    sankey: SankeyFlow[]
    rootToTip: RootToTipPoint[]
    clades: Clade[]
  }>({
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
  return useQuery<{ mutations: Mutation[]; alignment: AlignmentChar[] }>({
    queryKey: ['molecule'],
    queryFn: () => fetchOrMock('/molecule', {
      mutations: PRISM_DATA.mutations,
      alignment: PRISM_DATA.alignment,
    }),
    staleTime: 30 * 60_000,
  })
}

export function usePathogen() {
  return useQuery<Pathogen>({
    queryKey: ['pathogen'],
    queryFn: () => fetchOrMock('/pathogen', PRISM_DATA.pathogen),
    staleTime: 60_000,
  })
}

export function useMetrics() {
  return useQuery<Metric[]>({
    queryKey: ['metrics'],
    queryFn: () => fetchOrMock('/metrics', PRISM_DATA.metrics),
    staleTime: 60_000,
  })
}

export function useInbox() {
  return useQuery<InboxItem[]>({
    queryKey: ['inbox'],
    queryFn: () => fetchOrMock('/inbox', PRISM_DATA.inbox),
    refetchInterval: 30_000,
  })
}

export function useNotebook() {
  return useQuery<NotebookCell[]>({
    queryKey: ['notebook'],
    queryFn: () => fetchOrMock('/notebook', PRISM_DATA.notebook),
    staleTime: 60_000,
  })
}

export function useDrugs() {
  return useQuery<DrugCandidate[]>({
    queryKey: ['drugs'],
    queryFn: () => fetchOrMock('/drugs', PRISM_DATA.drugCandidates),
    staleTime: 60_000,
  })
}

// ─── Upload & Pipeline hooks ────────────────────────────────────────────────

export function useUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await apiClient.post('/upload', form)
      return res.data as { upload_id: string; filename: string; seq_count: number }
    },
  })
}

export function usePipelineRun() {
  return useMutation({
    mutationFn: async (uploadId: string) => {
      const res = await apiClient.post(`/pipeline/run?upload_id=${uploadId}`)
      return res.data as { run_id: string; status: string }
    },
  })
}

export function usePipelineStatus(runId: string | null) {
  return useQuery({
    queryKey: ['pipeline-status', runId],
    queryFn: async () => {
      const res = await apiClient.get(`/pipeline/status/${runId}`)
      return res.data as { run_id: string; status: string; current_stage: string | null; progress: number }
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'completed' || s === 'failed' ? false : 1000
    },
  })
}

// ─── Export helpers ──────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export function downloadExport(format: 'csv' | 'json' | 'report') {
  window.open(`${API_BASE}/export/${format}`, '_blank')
}
