// PRISM — Domain types

export type ModuleId =
  | 'compass'
  | 'signals'
  | 'phylogeny'
  | 'molecule'
  | 'forecast'
  | 'sources'
  | 'report'

export type Tier = 'T3' | 'T2' | 'T1' | 'T0'
export type TransmissionState = 'GROWING' | 'DECLINING' | 'UNCERTAIN'
export type Phenotype = 'Import-Dominated' | 'Endemic Persistence' | 'Transitional'
export type SourceKind = 'clinical' | 'genomic' | 'mobility' | 'avian' | 'wastewater'
export type SourceStatus = 'live' | 'fresh' | 'stale' | 'error'
export type ImpactLevel = 'high' | 'mid' | 'low'
export type AnomalyStatus = 'new' | 'escalated' | 'monitoring' | 'dismissed'

export interface EpiSplatSignals {
  ps: number       // Persistence Score → radius (0-1)
  rt: number       // R(t) → brightness (0-2+)
  subtype: string  // HA/NA identity → color hue
  hNorm: number    // Normalized entropy → pulse rate (0-1)
  tcc: number      // Temporal cluster coefficient → jitter (0-1)
  eti: number      // Epidemic threshold index → bloom intensity (0-1)
  rd: number       // Relative diversity → shimmer (0-1)
  asMut: number    // Antigenic site mutations → hotspot glow (0-1)
}

export interface ConcordanceLayers {
  clinical: number
  genomic: number
  wastewater: number
}

export interface Region {
  id: string
  name: string
  country: string
  iso: string
  lat: number
  lon: number
  tier: Tier
  phen: Phenotype
  rt: number
  rtLo: number
  rtHi: number
  seeding: number
  state: TransmissionState
  concord: number
  clade: string
  splat: EpiSplatSignals
  splatTimeline: EpiSplatSignals[]  // 12 weeks for temporal scrubber
  concordanceLayers: ConcordanceLayers
}

export interface Clade {
  id: string
  origin: string
  n: number
  fitness: number
}

export interface DataSource {
  id: string
  name: string
  kind: SourceKind
  latency: string
  status: SourceStatus
  color: string
  last: string
}

export interface Metric {
  id: string
  name: string
  desc: string
}

export interface HeatRow {
  region: string
  metric: string
  vals: number[]
}

export interface ForecastData {
  weeks: number
  median: number[]
  p50: [number, number][]
  p80: [number, number][]
  p95: [number, number][]
  now: number
}

export interface IncidenceData {
  obs: (number | null)[]
  fit: number[]
}

export interface TreeNode {
  id: string
  x: number
  y: number
  parent: string | null
  clade: string
  leaf: boolean
  highlight: boolean
}

export interface SankeyFlow {
  clade: string
  from: string
  to: string
  value: number
  color: string
  ps: number  // Persistence Score → drives pipe width
}

export interface RootToTipPoint {
  t: number
  d: number
  seq: string
  highlight: boolean
}

export interface Mutation {
  site: number
  wt: string
  mut: string
  koel: number
  esm: number
  freq: number
  first: string
  impact: ImpactLevel
}

export interface AlignmentChar {
  idx: number
  aa: string
  highlight: boolean
  ss: 'helix' | 'sheet' | 'loop'
}

export interface InboxItem {
  id: string
  region: string
  tier: Tier
  score: number
  status: AnomalyStatus
  age: string
  title: string
}

export interface NotebookCell {
  n: number
  kind: 'code' | 'md' | 'out'
  title?: string
  src: string
  lang?: string
}

export interface Pathogen {
  name: string
  clade: string
}

export interface ReassortmentBridge {
  from: string
  to: string
  segment: string
}

export interface DrugCandidate {
  name: string
  affinity: number
  selectivity: number
  status: 'lead' | 'candidate' | 'preclinical' | 'screening'
}

// ─── VirSift types ─────────────────────────────────────────────────────────

export interface VirsiftParseSummary {
  session_id: string
  filename: string
  total_sequences: number
  parse_time_seconds: number
  subtypes: Record<string, number>
  hosts: Record<string, number>
  segments: Record<string, number>
  date_range: [string | null, string | null]
  locations: Record<string, number>
}

export interface VirsiftSessionInfo {
  session_id: string
  filename: string
  total_sequences: number
  current_count: number
  subtypes: Record<string, number>
  hosts: Record<string, number>
}

export interface VirsiftSequenceRow {
  isolate: string
  subtype: string
  subtype_clean: string
  segment: string
  collection_date: string | null
  accession: string
  clade: string
  host: string
  location: string
  sequence_length: number
  sequence_hash: string
}

export interface VirsiftFilterResult {
  before_count: number
  after_count: number
  removed_count: number
}

export interface VirsiftSampleResult {
  before_count: number
  after_count: number
  lifespan_category: string
  reduction_pct: number
}

export interface VirsiftTimelinePoint {
  period: string
  count: number
}

export interface VirsiftWavePeak {
  date: string
  count: number
  type: string
  rank: number | null
}

export interface VirsiftTimeline {
  weekly_counts: VirsiftTimelinePoint[]
  peaks: VirsiftWavePeak[]
  troughs: VirsiftWavePeak[]
  off_season_clusters: VirsiftWavePeak[]
  wave_count: number
  lifespan_category: string
}

export interface VirsiftFieldInfo {
  populated_pct: number
  n_unique: number
  sample_values: string[]
}

// ─── Forecast SEIR types ──────────────────────────────────────────────────

export interface SEIRParams {
  beta: number
  sigma: number
  gamma: number
  R0: number
  I0: number
  E0: number
  incubation_days: number
  infectious_days: number
  fit_loss: number
}

export interface ForecastScenarioResult {
  forecast: ForecastData
  incidence: IncidenceData
  peak_incidence: number
  peak_week: number
  valid_draws: number
}

export interface ForecastRunResult {
  session_id: string
  params: SEIRParams
  n_observed: number
  horizon: number
  population: number
  scenarios: Record<string, ForecastScenarioResult>
}

// ─── VirSift Workspace types ──────────────────────────────────────────────

export interface WorkspaceFile {
  session_id: string
  filename: string
  source: string
  sequences: number
  subtypes: number
  segments: number
  date_range: [string | null, string | null]
  parse_time: number
  status: string
  warnings: number
  header_variant: string
  confidence: number
}

export interface FieldCoverage {
  field: string
  coverage_pct: number
  missing: number
  example: string | null
  notes: string | null
}

export interface HeaderIssue {
  line: number
  original_header: string
  issue: string
  suggested_fix: string
}

export interface ValidationResult {
  session_id: string
  header_variant: string
  confidence: number
  field_coverage: FieldCoverage[]
  header_issues: HeaderIssue[]
  warnings_count: number
}

export interface DatasetSummary {
  session_id: string
  sequences_active: number
  avg_length: number
  earliest: string | null
  latest: string | null
  source_file: string
  header_variant: string
  confidence: number
  subtypes: Record<string, number>
  segments: Record<string, number>
  locations: Record<string, number>
  hosts: Record<string, number>
}

// ─── Report types ─────────────────────────────────────────────────────────

export interface ReportMetricBlock {
  label: string
  value: string
  unit: string
}

export interface ReportEvidenceRow {
  source: string
  kind: string
  body: string
}

export interface ReportForecastBlock {
  horizon_weeks: number
  current_rt_median: number
  current_rt_ci: number[]
  peak_week: string
  peak_incidence_baseline: number
  peak_incidence_surge: number
  peak_incidence_intervention: number
  crossover_week: string | null
  has_seir: boolean
  seir_r0: number | null
  seir_beta: number | null
  seir_sigma: number | null
  seir_gamma: number | null
  rt_median: number[] | null
  rt_p50: [number, number][] | null
  rt_p80: [number, number][] | null
  rt_p95: [number, number][] | null
  rt_now: number | null
}

export interface ReportAnomalyRow {
  id: string
  tier: string
  title: string
  score: number
  status: string
}

export interface ReportPhyloBlock {
  clade: string
  fitness: number
  n_sequences: number
  origin: string
  mutations: string[]
}

export interface ReportVirsiftBlock {
  filename: string
  sequences_active: number
  subtypes: Record<string, number>
  segments: Record<string, number>
  date_range: (string | null)[]
  header_variant: string
}

export interface ReportActionItem {
  verb: string
  body: string
  priority: string
}

export interface ReportData {
  report_id: string
  report_type: string
  generated_at: string
  region_id: string
  region_name: string
  country: string
  iso: string
  tier: string
  clade: string
  pathogen: string
  subtitle: string
  pullquote: string
  metrics: ReportMetricBlock[]
  evidence: ReportEvidenceRow[]
  forecast: ReportForecastBlock | null
  anomalies: ReportAnomalyRow[]
  phylo: ReportPhyloBlock | null
  virsift: ReportVirsiftBlock | null
  actions: ReportActionItem[]
  confidence: number
  analyst: string
  classification: string
}

export interface ReportHistoryItem {
  report_id: string
  region_id: string
  region_name: string
  report_type: string
  generated_at: string
  tier: string
}

export interface PrismData {
  now: string
  pathogen: Pathogen
  sources: DataSource[]
  regions: Region[]
  clades: Clade[]
  metrics: Metric[]
  heat: HeatRow[]
  forecast: ForecastData
  incidence: IncidenceData
  tree: { nodes: TreeNode[]; reassortmentBridges: ReassortmentBridge[] }
  sankey: SankeyFlow[]
  rootToTip: RootToTipPoint[]
  mutations: Mutation[]
  alignment: AlignmentChar[]
  inbox: InboxItem[]
  notebook: NotebookCell[]
  drugCandidates: DrugCandidate[]
}

export interface Tweaks {
  accent: string
  density: 'compact' | 'normal' | 'relaxed'
  heatScale: 'linear' | 'sqrt' | 'log'
  rotation: 'auto' | 'manual'
  copy: 'clinical' | 'technical' | 'brief'
  episplat: 'on' | 'off'
  filaments: 'on' | 'off'
  graticule: 'on' | 'off'
}

export const DEFAULT_TWEAKS: Tweaks = {
  accent: 'phos',
  density: 'normal',
  heatScale: 'sqrt',
  rotation: 'auto',
  copy: 'clinical',
  episplat: 'on',
  filaments: 'on',
  graticule: 'on',
}

// Color mappings
export const CLADE_COLORS: Record<string, string> = {
  '3C.2a1b': 'var(--signal-violet)',
  '3C.2a1b.2a': 'var(--signal-phos)',
  '3C.2a1b.2a.2': 'var(--signal-cool)',
  '3C.2a1b.3a': 'var(--signal-warm)',
  '3C.3a': 'var(--signal-cool)',
  'B.1.7.2': 'var(--signal-pink)',
}

export const TIER_COLORS: Record<Tier, string> = {
  T3: 'var(--signal-hot)',
  T2: 'var(--signal-warm)',
  T1: 'var(--signal-cool)',
  T0: 'var(--signal-phos)',
}

export const TIER_CHIP_CLASS: Record<Tier, string> = {
  T3: 'hot',
  T2: 'warm',
  T1: 'cool',
  T0: 'phos',
}

export const STATE_CHIP_CLASS: Record<TransmissionState, string> = {
  GROWING: 'hot',
  DECLINING: 'cool',
  UNCERTAIN: 'warm',
}

export const SOURCE_KIND_CHIP_CLASS: Record<SourceKind, string> = {
  clinical: 'cool',
  genomic: 'violet',
  mobility: 'warm',
  avian: 'phos',
  wastewater: 'pink',
}

export const SOURCE_STATUS_CHIP_CLASS: Record<SourceStatus, string> = {
  live: 'phos',
  fresh: 'phos',
  stale: 'warm',
  error: 'hot',
}

// ─── Auth types ──────────────────────────────────────────────────────────

export type UserRole = 'viewer' | 'analyst' | 'admin'

export interface AuthUser {
  id: string
  email: string
  display_name: string
  initials: string
  role: UserRole
}

export interface AuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}
