// PRISM — mock dataset: Novosibirsk H3N2 canonical backtest + current surveillance
import type { PrismData, HeatRow, RootToTipPoint, AlignmentChar } from '../types/domain'

const regionWeights: Record<string, number> = {
  NSK: 0.95, CSP: 0.75, VNM: 0.65, MEX: 0.25,
  GBR: 0.08, USA: 0.42, JPN: 0.48, ZAF: 0.12, AUS: 0.32,
}

function buildHeat(): HeatRow[] {
  const rows: HeatRow[] = []
  const regions = ['NSK','CSP','VNM','MEX','GBR','USA','JPN','ZAF','AUS']
  const metrics = ['novelty','intro','expansion','mobility','divergence','wastewater','antigenic']
  regions.forEach(r => {
    const base = regionWeights[r]
    metrics.forEach(m => {
      const vals: number[] = []
      for (let w = 0; w < 12; w++) {
        const trend = base > 0.5 ? (0.2 + 0.7 * (w / 11)) : (0.8 - 0.5 * (w / 11))
        const noise = (Math.sin(w * 2.3 + r.charCodeAt(0) + m.charCodeAt(0)) * 0.5 + 0.5) * 0.25
        const metricBias = (m === 'antigenic' && base > 0.5) ? 0.15 : (m === 'wastewater' && base > 0.5) ? 0.1 : 0
        vals.push(Math.max(0.05, Math.min(0.99, base * trend + noise + metricBias)))
      }
      rows.push({ region: r, metric: m, vals })
    })
  })
  return rows
}

function buildForecast() {
  const weeks = 26
  const median: number[] = []
  const p50: [number, number][] = []
  const p80: [number, number][] = []
  const p95: [number, number][] = []
  for (let i = 0; i < weeks; i++) {
    const t = i / (weeks - 1)
    const base = 0.7 + 0.8 * Math.sin((t + 0.1) * Math.PI * 1.3) + 0.2 * Math.sin(t * 9)
    const widen = i < 13 ? 0.04 + 0.01 * (13 - i) : 0.08 + 0.05 * (i - 13)
    median.push(base)
    p50.push([base - widen, base + widen])
    p80.push([base - widen * 1.8, base + widen * 1.8])
    p95.push([base - widen * 2.6, base + widen * 2.6])
  }
  return { weeks, median, p50, p80, p95, now: 13 }
}

function buildIncidence() {
  const weeks = 26
  const obs: (number | null)[] = []
  const fit: number[] = []
  for (let i = 0; i < weeks; i++) {
    const t = i / (weeks - 1)
    const base = 40 + 80 * Math.exp(-Math.pow((t - 0.55) / 0.3, 2))
    obs.push(i < 13 ? base + (Math.sin(i * 1.7) * 8) : null)
    fit.push(base)
  }
  return { obs, fit }
}

function buildRootToTip(): RootToTipPoint[] {
  const pts: RootToTipPoint[] = []
  // Use deterministic pseudo-random so SSR/hydration is stable
  for (let i = 0; i < 47; i++) {
    const t = 2022 + (i / 46) * 3.3
    const base = 0.0005 + (t - 2022) * 0.0028
    const noise = (Math.sin(i * 17.3 + 0.5) * 0.5) * 0.0018
    pts.push({ t, d: base + noise, seq: `NSK-${String(i).padStart(4,'0')}`, highlight: i === 46 })
  }
  return pts
}

function buildAlignment(): AlignmentChar[] {
  const seq = 'MKTIIALSYILCLVFAQKIPGNDNSTATLCLGHHAVPNGTLVKTITDDQIEVTNATELVQ'
  const highlightSites = new Set([226, 193, 158, 144, 98])
  return seq.split('').map((aa, i) => ({
    idx: i + 1,
    aa,
    highlight: highlightSites.has(i + 1),
    ss: i < 20 ? 'helix' : i < 38 ? 'sheet' : 'loop',
  } as AlignmentChar))
}

export const PRISM_DATA: PrismData = {
  now: '2026-04-21T09:14:07Z',
  pathogen: { name: 'H3N2 · A/Novosibirsk/0047/2026', clade: '3C.2a1b.2a.B.1.7.2' },

  sources: [
    { id: 'flunet',  name: 'WHO FluNet',  kind: 'clinical',   latency: '02h 14m', status: 'fresh',  color: 'phos',   last: '07:00 UTC' },
    { id: 'gisaid',  name: 'GISAID',      kind: 'genomic',    latency: '06h 02m', status: 'fresh',  color: 'violet', last: '03:12 UTC' },
    { id: 'opensky', name: 'OpenSky',     kind: 'mobility',   latency: 'LIVE',    status: 'live',   color: 'cool',   last: 'stream' },
    { id: 'fao',     name: 'FAO · eBird', kind: 'avian',      latency: '38h 11m', status: 'stale',  color: 'warm',   last: '2d 14h ago' },
    { id: 'biobot',  name: 'Biobot',      kind: 'wastewater', latency: '11h 42m', status: 'fresh',  color: 'hot',    last: '21:32 UTC prev' },
  ],

  regions: [
    { id: 'NSK', name: 'Novosibirsk oblast', country: 'Russian Federation', iso: 'RUS', lat: 55.03,  lon:  82.92, tier: 'T3', phen: 'Endemic Persistence', rt: 1.24, rtLo: 1.09, rtHi: 1.41, seeding: 0.946, state: 'GROWING',   concord: 0.82, clade: 'B.1.7.2' },
    { id: 'CSP', name: 'Caspian basin',      country: 'Kazakhstan',         iso: 'KAZ', lat: 42.85,  lon:  50.40, tier: 'T2', phen: 'Import-Dominated',    rt: 1.08, rtLo: 0.96, rtHi: 1.22, seeding: 0.781, state: 'UNCERTAIN', concord: 0.64, clade: 'H5N1' },
    { id: 'VNM', name: 'Red River delta',   country: 'Viet Nam',           iso: 'VNM', lat: 21.03,  lon: 105.85, tier: 'T2', phen: 'Transitional',        rt: 1.14, rtLo: 1.01, rtHi: 1.28, seeding: 0.614, state: 'GROWING',   concord: 0.71, clade: 'H7N9' },
    { id: 'MEX', name: 'Valley of México',  country: 'Mexico',             iso: 'MEX', lat: 19.43,  lon: -99.13, tier: 'T1', phen: 'Import-Dominated',    rt: 0.82, rtLo: 0.72, rtHi: 0.94, seeding: 0.228, state: 'DECLINING', concord: 0.78, clade: 'H1N1' },
    { id: 'GBR', name: 'Greater London',    country: 'United Kingdom',     iso: 'GBR', lat: 51.51,  lon:  -0.13, tier: 'T0', phen: 'Endemic Persistence', rt: 0.88, rtLo: 0.78, rtHi: 0.98, seeding: 0.041, state: 'DECLINING', concord: 0.91, clade: '3C.2a1b' },
    { id: 'USA', name: 'Northeast corridor',country: 'United States',      iso: 'USA', lat: 40.71,  lon: -74.01, tier: 'T1', phen: 'Import-Dominated',    rt: 0.95, rtLo: 0.84, rtHi: 1.08, seeding: 0.192, state: 'UNCERTAIN', concord: 0.73, clade: '3C.3a' },
    { id: 'JPN', name: 'Kantō',             country: 'Japan',              iso: 'JPN', lat: 35.68,  lon: 139.69, tier: 'T1', phen: 'Import-Dominated',    rt: 1.02, rtLo: 0.91, rtHi: 1.15, seeding: 0.311, state: 'UNCERTAIN', concord: 0.80, clade: '3C.2a1b' },
    { id: 'ZAF', name: 'Gauteng',           country: 'South Africa',       iso: 'ZAF', lat: -26.20, lon:  28.04, tier: 'T0', phen: 'Endemic Persistence', rt: 0.74, rtLo: 0.62, rtHi: 0.87, seeding: 0.028, state: 'DECLINING', concord: 0.86, clade: 'B.1.7.2' },
    { id: 'AUS', name: 'New South Wales',   country: 'Australia',          iso: 'AUS', lat: -33.87, lon: 151.21, tier: 'T1', phen: 'Import-Dominated',    rt: 0.91, rtLo: 0.80, rtHi: 1.05, seeding: 0.147, state: 'UNCERTAIN', concord: 0.76, clade: '3C.2a1b' },
  ],

  clades: [
    { id: '3C.2a1b',    origin: 'CHN',       n: 412, fitness:  0.04 },
    { id: '3C.2a1b.2a', origin: 'SE ASIA',   n: 287, fitness:  0.12 },
    { id: '3C.3a',      origin: 'CHN',       n: 198, fitness: -0.02 },
    { id: 'B.1.7.2',    origin: 'RUS · NSK', n: 47,  fitness:  0.24 },
  ],

  metrics: [
    { id: 'novelty',    name: 'Novelty',            desc: 'k-mer novelty vs 90d lookback' },
    { id: 'intro',      name: 'Intro frequency',    desc: 'Independent genomic introductions per week' },
    { id: 'expansion',  name: 'Local expansion',    desc: 'Rate of same-clade geographic spread' },
    { id: 'mobility',   name: 'Mobility concord.',  desc: 'Correlation with OpenSky passenger edges' },
    { id: 'divergence', name: 'Genomic divergence', desc: 'Root-to-tip residual vs clock' },
    { id: 'wastewater', name: 'Wastewater concord.',desc: 'Biobot RNA vs clinical incidence' },
    { id: 'antigenic',  name: 'Antigenic drift',    desc: 'Koel 2013 + ESM-2 composite' },
  ],

  heat: buildHeat(),
  forecast: buildForecast(),
  incidence: buildIncidence(),

  tree: {
    nodes: [
      { id: 'root',         x: 0,   y: 120, parent: null, clade: '',           leaf: false, highlight: false },
      { id: 'A',            x: 80,  y: 120, parent: 'root', clade: '',         leaf: false, highlight: false },
      { id: '3C.2a1b',      x: 160, y: 60,  parent: 'A',    clade: '3C.2a1b', leaf: false, highlight: false },
      { id: '3C.3a',        x: 160, y: 180, parent: 'A',    clade: '3C.3a',   leaf: false, highlight: false },
      { id: '3C.2a1b.2a',   x: 240, y: 30,  parent: '3C.2a1b', clade: '3C.2a1b.2a', leaf: true, highlight: false },
      { id: '3C.2a1b-x',    x: 240, y: 90,  parent: '3C.2a1b', clade: '3C.2a1b',    leaf: true, highlight: false },
      { id: '3C.3a-y',      x: 240, y: 150, parent: '3C.3a',   clade: '3C.3a',      leaf: true, highlight: false },
      { id: 'B.1.7.2',      x: 240, y: 210, parent: '3C.3a',   clade: 'B.1.7.2',    leaf: true, highlight: true },
    ],
  },

  sankey: [
    { clade: '3C.2a1b',    from: 'CHN',     to: 'SE ASIA',       value: 160, color: 'violet' },
    { clade: '3C.2a1b',    from: 'SE ASIA', to: 'EU · RUS · US', value: 110, color: 'violet' },
    { clade: '3C.2a1b.2a', from: 'CHN',     to: 'SE ASIA',       value: 130, color: 'phos'   },
    { clade: '3C.2a1b.2a', from: 'SE ASIA', to: 'EU · RUS · US', value: 180, color: 'phos'   },
    { clade: '3C.3a',      from: 'CHN',     to: 'SE ASIA',       value:  90, color: 'cool'   },
    { clade: '3C.3a',      from: 'SE ASIA', to: 'EU · RUS · US', value:  60, color: 'cool'   },
    { clade: 'B.1.7.2',    from: 'CHN',     to: 'SE ASIA',       value:  20, color: 'pink'   },
    { clade: 'B.1.7.2',    from: 'SE ASIA', to: 'EU · RUS · US', value:  70, color: 'pink'   },
  ],

  rootToTip: buildRootToTip(),

  mutations: [
    { site: 226, wt: 'Q', mut: 'L', koel: 8.4, esm: -2.1, freq: 0.94, first: 'RUS', impact: 'high' },
    { site: 193, wt: 'S', mut: 'F', koel: 7.2, esm: -1.4, freq: 0.76, first: 'RUS', impact: 'high' },
    { site: 158, wt: 'N', mut: 'K', koel: 5.1, esm: -0.8, freq: 0.42, first: 'CHN', impact: 'mid'  },
    { site: 144, wt: 'G', mut: 'S', koel: 3.8, esm: -0.4, freq: 0.22, first: 'VNM', impact: 'mid'  },
    { site:  98, wt: 'Y', mut: 'H', koel: 1.2, esm:  0.1, freq: 0.09, first: 'USA', impact: 'low'  },
  ],

  alignment: buildAlignment(),

  inbox: [
    { id: 'ANM-2026-0412', region: 'NSK', tier: 'T3', score: 0.946, status: 'new',        age: '02h 14m', title: 'Novosibirsk H3N2 — clade B.1.7.2 expansion' },
    { id: 'ANM-2026-0411', region: 'CSP', tier: 'T2', score: 0.781, status: 'escalated',  age: '14h 40m', title: 'Caspian H5N1 — avian die-off concordance' },
    { id: 'ANM-2026-0409', region: 'VNM', tier: 'T2', score: 0.614, status: 'new',        age: '22h 08m', title: 'Red River delta — transitional phenotype' },
    { id: 'ANM-2026-0406', region: 'JPN', tier: 'T1', score: 0.311, status: 'monitoring', age: '1d 8h',   title: 'Kantō — mobility concordance drift' },
    { id: 'ANM-2026-0402', region: 'USA', tier: 'T1', score: 0.192, status: 'new',        age: '1d 17h',  title: 'Northeast corridor — genomic intro uptick' },
    { id: 'ANM-2026-0398', region: 'MEX', tier: 'T1', score: 0.228, status: 'dismissed',  age: '2d 4h',   title: 'Valley of México — wastewater anomaly (assay)' },
    { id: 'ANM-2026-0391', region: 'CSP', tier: 'T2', score: 0.512, status: 'escalated',  age: '3d 2h',   title: 'Caspian basin — secondary mortality cluster' },
  ],

  notebook: [
    { n: 1, kind: 'md',   title: 'PRISM · VirSift Integrated Pipeline', src: '' },
    { n: 2, kind: 'code', lang: 'py', src: "import virsift as vs\nstreams = vs.load_streams(['flunet','gisaid','opensky','fao','biobot'])\nprint(streams.summary())" },
    { n: 3, kind: 'out',  src: '5 streams · latency median 06h 02m · QC pass 5/5' },
    { n: 4, kind: 'md',   title: 'Parse FASTA → metric computation', src: '' },
    { n: 5, kind: 'code', lang: 'py', src: "seqs = vs.parse_fasta('gisaid/H3N2_2022-2026.fa.gz')\nmetrics = vs.compute_seven(seqs, clock='treetime', ref='A/HK/4801/2014')\nprint(len(seqs), 'sequences ·', metrics.shape)" },
    { n: 6, kind: 'out',  src: "4,128 sequences · metrics.shape = (4128, 7)" },
    { n: 7, kind: 'md',   title: 'EpiSplat export for COMPASS', src: '' },
    { n: 8, kind: 'code', lang: 'py', src: "vs.to_episplat(metrics, out='episplat/h3n2_2026w16.json', compress=True)" },
  ],
}
