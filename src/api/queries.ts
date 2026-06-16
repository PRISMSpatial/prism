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

// ─── VirSift hooks ─────────────────────────────────────────────────────────

import type { ForecastRunResult } from '../types/domain'

// ─── Forecast SEIR hooks ────────────────────────────────────────────────

export function useForecastRun() {
  return useMutation({
    mutationFn: async (req: { observed_weekly: number[]; population: number; horizon_weeks: number; n_draws: number }) => {
      const res = await apiClient.post('/forecast/run', req)
      return res.data as ForecastRunResult
    },
  })
}

export function useForecastFromVirsift() {
  return useMutation({
    mutationFn: async ({ virsiftSessionId, ...body }: { virsiftSessionId: string; population: number; horizon_weeks: number; n_draws: number }) => {
      const res = await apiClient.post(`/forecast/from-virsift/${virsiftSessionId}`, body)
      return res.data as ForecastRunResult
    },
  })
}

export function useForecastSession(sessionId: string | null) {
  return useQuery<ForecastRunResult>({
    queryKey: ['forecast-session', sessionId],
    queryFn: async () => {
      const res = await apiClient.get(`/forecast/session/${sessionId}`)
      return res.data
    },
    enabled: !!sessionId,
  })
}

import type {
  VirsiftParseSummary, VirsiftSessionInfo, VirsiftSequenceRow,
  VirsiftFilterResult, VirsiftSampleResult, VirsiftTimeline,
  VirsiftFieldInfo,
} from '../types/domain'

export function useVirsiftParse() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await apiClient.post('/virsift/parse', form)
      return res.data as VirsiftParseSummary
    },
  })
}

export function useVirsiftSession(sessionId: string | null) {
  return useQuery<VirsiftSessionInfo>({
    queryKey: ['virsift-session', sessionId],
    queryFn: async () => {
      const res = await apiClient.get(`/virsift/sessions/${sessionId}`)
      return res.data
    },
    enabled: !!sessionId,
  })
}

export function useVirsiftSequences(sessionId: string | null, offset = 0, limit = 100) {
  return useQuery<{ total: number; offset: number; limit: number; rows: VirsiftSequenceRow[] }>({
    queryKey: ['virsift-sequences', sessionId, offset, limit],
    queryFn: async () => {
      const res = await apiClient.get(`/virsift/sessions/${sessionId}/sequences?offset=${offset}&limit=${limit}`)
      return res.data
    },
    enabled: !!sessionId,
  })
}

export function useVirsiftFields(sessionId: string | null) {
  return useQuery<Record<string, VirsiftFieldInfo>>({
    queryKey: ['virsift-fields', sessionId],
    queryFn: async () => {
      const res = await apiClient.get(`/virsift/sessions/${sessionId}/fields`)
      return res.data
    },
    enabled: !!sessionId,
  })
}

export function useVirsiftFilter() {
  return useMutation({
    mutationFn: async (req: { session_id: string; rules: { field: string; operator: string; value: string | string[] }[] }) => {
      const res = await apiClient.post('/virsift/filter', req)
      return res.data as VirsiftFilterResult
    },
  })
}

export function useVirsiftQualityFilter() {
  return useMutation({
    mutationFn: async (req: { session_id: string; min_length?: number; max_n_run?: number; deduplicate?: boolean; dedup_mode?: string }) => {
      const res = await apiClient.post('/virsift/quality-filter', req)
      return res.data as VirsiftFilterResult
    },
  })
}

export function useVirsiftSample() {
  return useMutation({
    mutationFn: async (req: { session_id: string; category?: string }) => {
      const res = await apiClient.post('/virsift/sample', req)
      return res.data as VirsiftSampleResult
    },
  })
}

export function useVirsiftTimeline(sessionId: string | null) {
  return useQuery<VirsiftTimeline>({
    queryKey: ['virsift-timeline', sessionId],
    queryFn: async () => {
      const res = await apiClient.get(`/virsift/timeline/${sessionId}`)
      return res.data
    },
    enabled: !!sessionId,
  })
}

export function useVirsiftWorkspace() {
  return useQuery<import('../types/domain').WorkspaceFile[]>({
    queryKey: ['virsift-workspace'],
    queryFn: async () => {
      const res = await apiClient.get('/virsift/workspace')
      return res.data
    },
    refetchInterval: 10_000,
  })
}

export function useVirsiftValidation(sessionId: string | null) {
  return useQuery<import('../types/domain').ValidationResult>({
    queryKey: ['virsift-validation', sessionId],
    queryFn: async () => {
      const res = await apiClient.get(`/virsift/sessions/${sessionId}/validation`)
      return res.data
    },
    enabled: !!sessionId,
  })
}

export function useVirsiftSummary(sessionId: string | null) {
  return useQuery<import('../types/domain').DatasetSummary>({
    queryKey: ['virsift-summary', sessionId],
    queryFn: async () => {
      const res = await apiClient.get(`/virsift/sessions/${sessionId}/summary`)
      return res.data
    },
    enabled: !!sessionId,
  })
}

export function useVirsiftMerge() {
  return useMutation({
    mutationFn: async (sessionIds: string[]) => {
      const res = await apiClient.post('/virsift/merge', { session_ids: sessionIds })
      return res.data as { session_id: string; filename: string; total_sequences: number; source_files: string[] }
    },
  })
}

export function useVirsiftFetchUrl() {
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await apiClient.post('/virsift/fetch-url', { url })
      return res.data as import('../types/domain').VirsiftParseSummary
    },
  })
}

export function useVirsiftReset() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiClient.post(`/virsift/reset/${sessionId}`)
      return res.data as { session_id: string; count: number; status: string }
    },
  })
}

// ─── Report hooks ──────────────────────────────────────────────────────────

import type { ReportData, ReportHistoryItem } from '../types/domain'

export function useReportGenerate() {
  return useMutation({
    mutationFn: async (req: { region_id: string; forecast_session_id?: string; virsift_session_id?: string; report_type?: string }) => {
      const res = await apiClient.post('/report/generate', req)
      return res.data as ReportData
    },
  })
}

export function useReportHistory() {
  return useQuery<ReportHistoryItem[]>({
    queryKey: ['report-history'],
    queryFn: async () => {
      const res = await apiClient.get('/report/history')
      return res.data
    },
    staleTime: 60_000,
  })
}

export function useReport(reportId: string | null) {
  return useQuery<ReportData>({
    queryKey: ['report', reportId],
    queryFn: async () => {
      const res = await apiClient.get(`/report/${reportId}`)
      return res.data
    },
    enabled: !!reportId,
  })
}

// ─── Export helpers ──────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export function downloadExport(format: 'csv' | 'json' | 'report') {
  window.open(`${API_BASE}/export/${format}`, '_blank')
}

export function downloadReportExport(reportId: string, format: 'csv' | 'json') {
  window.open(`${API_BASE}/report/${reportId}/export/${format}`, '_blank')
}

export function downloadVirsiftExport(sessionId: string) {
  window.open(`${API_BASE}/virsift/export/${sessionId}`, '_blank')
}
