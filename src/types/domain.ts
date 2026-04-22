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
  tree: { nodes: TreeNode[] }
  sankey: SankeyFlow[]
  rootToTip: RootToTipPoint[]
  mutations: Mutation[]
  alignment: AlignmentChar[]
  inbox: InboxItem[]
  notebook: NotebookCell[]
}

export interface Tweaks {
  accent: string
  density: 'compact' | 'normal' | 'relaxed'
  heatScale: 'linear' | 'sqrt' | 'log'
  rotation: 'auto' | 'manual'
  copy: 'clinical' | 'technical' | 'brief'
}

export const DEFAULT_TWEAKS: Tweaks = {
  accent: 'phos',
  density: 'normal',
  heatScale: 'sqrt',
  rotation: 'auto',
  copy: 'clinical',
}

// Color mappings
export const CLADE_COLORS: Record<string, string> = {
  '3C.2a1b': 'var(--signal-violet)',
  '3C.2a1b.2a': 'var(--signal-phos)',
  '3C.2a1b.2a.2': 'var(--signal-cool)',
  '3C.2a1b.3a': 'var(--signal-warm)',
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
