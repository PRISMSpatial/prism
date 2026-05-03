"""Port of frontend src/data/mock.ts → Python demo data generator.
Uses identical deterministic math to produce visually matching data."""
import math
from app.models.domain import (
    Region, EpiSplatSignals, ConcordanceLayers, Clade, DataSource, Metric,
    HeatRow, ForecastData, IncidenceData, TreeNode, ReassortmentBridge,
    SankeyFlow, RootToTipPoint, Mutation, AlignmentChar, InboxItem,
    NotebookCell, Pathogen, DrugCandidate, TreeData,
)

REGION_WEIGHTS = {
    "NSK": 0.95, "CSP": 0.75, "VNM": 0.65, "MEX": 0.25,
    "GBR": 0.08, "USA": 0.42, "JPN": 0.48, "ZAF": 0.12, "AUS": 0.32,
}

SUBTYPE_MAP = {
    "NSK": "H3N2", "CSP": "H5N1", "VNM": "H7N9", "MEX": "H1N1",
    "GBR": "H3N2", "USA": "H3N2", "JPN": "H3N2", "ZAF": "H3N2", "AUS": "H3N2",
}

REGIONS = ["NSK", "CSP", "VNM", "MEX", "GBR", "USA", "JPN", "ZAF", "AUS"]
METRICS = ["novelty", "intro", "expansion", "mobility", "divergence", "wastewater", "antigenic"]


def _build_splat(rid: str, seeding: float, rt: float, concord: float) -> EpiSplatSignals:
    w = REGION_WEIGHTS[rid]
    return EpiSplatSignals(
        ps=min(1, seeding * 1.05),
        rt=rt,
        subtype=SUBTYPE_MAP.get(rid, "H3N2"),
        hNorm=min(1, w * 0.85 + 0.1),
        tcc=min(1, concord * 0.95),
        eti=min(1, seeding * 0.9 + 0.05),
        rd=min(1, (1 - concord) * 0.8 + w * 0.2),
        asMut=0.82 if rid == "NSK" else 0.64 if rid == "CSP" else 0.48 if rid == "VNM" else max(0.05, w * 0.4),
    )


def _build_splat_timeline(base: EpiSplatSignals) -> list[EpiSplatSignals]:
    out = []
    for w in range(12):
        t = w / 11
        drift = 0.15 * math.sin(t * math.pi * 1.4)
        out.append(EpiSplatSignals(
            ps=max(0.05, min(1, base.ps * (0.6 + 0.4 * t) + drift * 0.3)),
            rt=max(0.3, base.rt * (0.8 + 0.2 * t) + drift * 0.15),
            subtype=base.subtype,
            hNorm=max(0.05, min(1, base.hNorm * (0.7 + 0.3 * t))),
            tcc=max(0.05, min(1, base.tcc * (0.5 + 0.5 * t) + drift * 0.1)),
            eti=max(0.05, min(1, base.eti * (0.6 + 0.4 * t))),
            rd=max(0.05, min(1, base.rd + drift * 0.2)),
            asMut=max(0.05, min(1, base.asMut * (0.7 + 0.3 * t))),
        ))
    return out


def build_heat() -> list[HeatRow]:
    rows = []
    for r in REGIONS:
        base = REGION_WEIGHTS[r]
        for m in METRICS:
            vals = []
            for w in range(12):
                trend = (0.2 + 0.7 * (w / 11)) if base > 0.5 else (0.8 - 0.5 * (w / 11))
                noise = (math.sin(w * 2.3 + ord(r[0]) + ord(m[0])) * 0.5 + 0.5) * 0.25
                metric_bias = 0.15 if (m == "antigenic" and base > 0.5) else 0.1 if (m == "wastewater" and base > 0.5) else 0
                vals.append(max(0.05, min(0.99, base * trend + noise + metric_bias)))
            rows.append(HeatRow(region=r, metric=m, vals=vals))
    return rows


def build_forecast() -> ForecastData:
    weeks = 26
    median, p50, p80, p95 = [], [], [], []
    for i in range(weeks):
        t = i / (weeks - 1)
        base = 0.7 + 0.8 * math.sin((t + 0.1) * math.pi * 1.3) + 0.2 * math.sin(t * 9)
        widen = 0.04 + 0.01 * (13 - i) if i < 13 else 0.08 + 0.05 * (i - 13)
        median.append(base)
        p50.append((base - widen, base + widen))
        p80.append((base - widen * 1.8, base + widen * 1.8))
        p95.append((base - widen * 2.6, base + widen * 2.6))
    return ForecastData(weeks=weeks, median=median, p50=p50, p80=p80, p95=p95, now=13)


def build_incidence() -> IncidenceData:
    weeks = 26
    obs, fit = [], []
    for i in range(weeks):
        t = i / (weeks - 1)
        base = 40 + 80 * math.exp(-((t - 0.55) / 0.3) ** 2)
        obs.append(base + math.sin(i * 1.7) * 8 if i < 13 else None)
        fit.append(base)
    return IncidenceData(obs=obs, fit=fit)


def build_root_to_tip() -> list[RootToTipPoint]:
    pts = []
    for i in range(47):
        t = 2022 + (i / 46) * 3.3
        base = 0.0005 + (t - 2022) * 0.0028
        noise = (math.sin(i * 17.3 + 0.5) * 0.5) * 0.0018
        pts.append(RootToTipPoint(t=t, d=base + noise, seq=f"NSK-{i:04d}", highlight=(i == 46)))
    return pts


def build_alignment() -> list[AlignmentChar]:
    seq = "MKTIIALSYILCLVFAQKIPGNDNSTATLCLGHHAVPNGTLVKTITDDQIEVTNATELVQ"
    highlight_sites = {226, 193, 158, 144, 98}
    return [
        AlignmentChar(
            idx=i + 1,
            aa=aa,
            highlight=(i + 1) in highlight_sites,
            ss="helix" if i < 20 else "sheet" if i < 38 else "loop",
        )
        for i, aa in enumerate(seq)
    ]


def build_regions() -> list[Region]:
    raw = [
        {"id": "NSK", "name": "Novosibirsk oblast", "country": "Russian Federation", "iso": "RUS", "lat": 55.03, "lon": 82.92, "tier": "T3", "phen": "Endemic Persistence", "rt": 1.24, "rtLo": 1.09, "rtHi": 1.41, "seeding": 0.946, "state": "GROWING", "concord": 0.82, "clade": "B.1.7.2"},
        {"id": "CSP", "name": "Caspian basin", "country": "Kazakhstan", "iso": "KAZ", "lat": 42.85, "lon": 50.40, "tier": "T2", "phen": "Import-Dominated", "rt": 1.08, "rtLo": 0.96, "rtHi": 1.22, "seeding": 0.781, "state": "UNCERTAIN", "concord": 0.64, "clade": "H5N1"},
        {"id": "VNM", "name": "Red River delta", "country": "Viet Nam", "iso": "VNM", "lat": 21.03, "lon": 105.85, "tier": "T2", "phen": "Transitional", "rt": 1.14, "rtLo": 1.01, "rtHi": 1.28, "seeding": 0.614, "state": "GROWING", "concord": 0.71, "clade": "H7N9"},
        {"id": "MEX", "name": "Valley of México", "country": "Mexico", "iso": "MEX", "lat": 19.43, "lon": -99.13, "tier": "T1", "phen": "Import-Dominated", "rt": 0.82, "rtLo": 0.72, "rtHi": 0.94, "seeding": 0.228, "state": "DECLINING", "concord": 0.78, "clade": "H1N1"},
        {"id": "GBR", "name": "Greater London", "country": "United Kingdom", "iso": "GBR", "lat": 51.51, "lon": -0.13, "tier": "T0", "phen": "Endemic Persistence", "rt": 0.88, "rtLo": 0.78, "rtHi": 0.98, "seeding": 0.041, "state": "DECLINING", "concord": 0.91, "clade": "3C.2a1b"},
        {"id": "USA", "name": "Northeast corridor", "country": "United States", "iso": "USA", "lat": 40.71, "lon": -74.01, "tier": "T1", "phen": "Import-Dominated", "rt": 0.95, "rtLo": 0.84, "rtHi": 1.08, "seeding": 0.192, "state": "UNCERTAIN", "concord": 0.73, "clade": "3C.3a"},
        {"id": "JPN", "name": "Kantō", "country": "Japan", "iso": "JPN", "lat": 35.68, "lon": 139.69, "tier": "T1", "phen": "Import-Dominated", "rt": 1.02, "rtLo": 0.91, "rtHi": 1.15, "seeding": 0.311, "state": "UNCERTAIN", "concord": 0.80, "clade": "3C.2a1b"},
        {"id": "ZAF", "name": "Gauteng", "country": "South Africa", "iso": "ZAF", "lat": -26.20, "lon": 28.04, "tier": "T0", "phen": "Endemic Persistence", "rt": 0.74, "rtLo": 0.62, "rtHi": 0.87, "seeding": 0.028, "state": "DECLINING", "concord": 0.86, "clade": "B.1.7.2"},
        {"id": "AUS", "name": "New South Wales", "country": "Australia", "iso": "AUS", "lat": -33.87, "lon": 151.21, "tier": "T1", "phen": "Import-Dominated", "rt": 0.91, "rtLo": 0.80, "rtHi": 1.05, "seeding": 0.147, "state": "UNCERTAIN", "concord": 0.76, "clade": "3C.2a1b"},
    ]
    regions = []
    for r in raw:
        splat = _build_splat(r["id"], r["seeding"], r["rt"], r["concord"])
        regions.append(Region(
            **r,
            splat=splat,
            splatTimeline=_build_splat_timeline(splat),
            concordanceLayers=ConcordanceLayers(
                clinical=min(1, r["concord"] * 0.95 + 0.04),
                genomic=min(1, r["concord"] * 0.88 + 0.08),
                wastewater=min(1, r["concord"] * 0.72 + 0.15),
            ),
        ))
    return regions


def build_sources() -> list[DataSource]:
    return [
        DataSource(id="flunet", name="WHO FluNet", kind="clinical", latency="02h 14m", status="fresh", color="phos", last="07:00 UTC"),
        DataSource(id="gisaid", name="GISAID", kind="genomic", latency="06h 02m", status="fresh", color="violet", last="03:12 UTC"),
        DataSource(id="opensky", name="OpenSky", kind="mobility", latency="LIVE", status="live", color="cool", last="stream"),
        DataSource(id="fao", name="FAO · eBird", kind="avian", latency="38h 11m", status="stale", color="warm", last="2d 14h ago"),
        DataSource(id="biobot", name="Biobot", kind="wastewater", latency="11h 42m", status="fresh", color="hot", last="21:32 UTC prev"),
    ]


def build_clades() -> list[Clade]:
    return [
        Clade(id="3C.2a1b", origin="CHN", n=412, fitness=0.04),
        Clade(id="3C.2a1b.2a", origin="SE ASIA", n=287, fitness=0.12),
        Clade(id="3C.3a", origin="CHN", n=198, fitness=-0.02),
        Clade(id="B.1.7.2", origin="RUS · NSK", n=47, fitness=0.24),
    ]


def build_metrics() -> list[Metric]:
    return [
        Metric(id="novelty", name="Novelty", desc="k-mer novelty vs 90d lookback"),
        Metric(id="intro", name="Intro frequency", desc="Independent genomic introductions per week"),
        Metric(id="expansion", name="Local expansion", desc="Rate of same-clade geographic spread"),
        Metric(id="mobility", name="Mobility concord.", desc="Correlation with OpenSky passenger edges"),
        Metric(id="divergence", name="Genomic divergence", desc="Root-to-tip residual vs clock"),
        Metric(id="wastewater", name="Wastewater concord.", desc="Biobot RNA vs clinical incidence"),
        Metric(id="antigenic", name="Antigenic drift", desc="Koel 2013 + ESM-2 composite"),
    ]


def build_tree() -> TreeData:
    nodes = [
        TreeNode(id="root", x=0, y=120, parent=None, clade="", leaf=False, highlight=False),
        TreeNode(id="A", x=80, y=120, parent="root", clade="", leaf=False, highlight=False),
        TreeNode(id="3C.2a1b", x=160, y=60, parent="A", clade="3C.2a1b", leaf=False, highlight=False),
        TreeNode(id="3C.3a", x=160, y=180, parent="A", clade="3C.3a", leaf=False, highlight=False),
        TreeNode(id="3C.2a1b.2a", x=240, y=30, parent="3C.2a1b", clade="3C.2a1b.2a", leaf=True, highlight=False),
        TreeNode(id="3C.2a1b-x", x=240, y=90, parent="3C.2a1b", clade="3C.2a1b", leaf=True, highlight=False),
        TreeNode(id="3C.3a-y", x=240, y=150, parent="3C.3a", clade="3C.3a", leaf=True, highlight=False),
        TreeNode(id="B.1.7.2", x=240, y=210, parent="3C.3a", clade="B.1.7.2", leaf=True, highlight=True),
    ]
    bridges = [
        ReassortmentBridge(**{"from": "3C.2a1b.2a", "to": "B.1.7.2", "segment": "NA (N2)"}),
        ReassortmentBridge(**{"from": "3C.2a1b-x", "to": "3C.3a-y", "segment": "PB2"}),
    ]
    return TreeData(nodes=nodes, reassortmentBridges=bridges)


def build_sankey() -> list[SankeyFlow]:
    return [
        SankeyFlow(**{"clade": "3C.2a1b", "from": "CHN", "to": "SE ASIA", "value": 160, "color": "violet", "ps": 0.62}),
        SankeyFlow(**{"clade": "3C.2a1b", "from": "SE ASIA", "to": "EU · RUS · US", "value": 110, "color": "violet", "ps": 0.62}),
        SankeyFlow(**{"clade": "3C.2a1b.2a", "from": "CHN", "to": "SE ASIA", "value": 130, "color": "phos", "ps": 0.48}),
        SankeyFlow(**{"clade": "3C.2a1b.2a", "from": "SE ASIA", "to": "EU · RUS · US", "value": 180, "color": "phos", "ps": 0.48}),
        SankeyFlow(**{"clade": "3C.3a", "from": "CHN", "to": "SE ASIA", "value": 90, "color": "cool", "ps": 0.31}),
        SankeyFlow(**{"clade": "3C.3a", "from": "SE ASIA", "to": "EU · RUS · US", "value": 60, "color": "cool", "ps": 0.31}),
        SankeyFlow(**{"clade": "B.1.7.2", "from": "CHN", "to": "SE ASIA", "value": 20, "color": "pink", "ps": 0.74}),
        SankeyFlow(**{"clade": "B.1.7.2", "from": "SE ASIA", "to": "EU · RUS · US", "value": 70, "color": "pink", "ps": 0.74}),
    ]


def build_mutations() -> list[Mutation]:
    return [
        Mutation(site=226, wt="Q", mut="L", koel=8.4, esm=-2.1, freq=0.94, first="RUS", impact="high"),
        Mutation(site=193, wt="S", mut="F", koel=7.2, esm=-1.4, freq=0.76, first="RUS", impact="high"),
        Mutation(site=158, wt="N", mut="K", koel=5.1, esm=-0.8, freq=0.42, first="CHN", impact="mid"),
        Mutation(site=144, wt="G", mut="S", koel=3.8, esm=-0.4, freq=0.22, first="VNM", impact="mid"),
        Mutation(site=98, wt="Y", mut="H", koel=1.2, esm=0.1, freq=0.09, first="USA", impact="low"),
    ]


def build_inbox() -> list[InboxItem]:
    return [
        InboxItem(id="ANM-2026-0412", region="NSK", tier="T3", score=0.946, status="new", age="02h 14m", title="Novosibirsk H3N2 — clade B.1.7.2 expansion"),
        InboxItem(id="ANM-2026-0411", region="CSP", tier="T2", score=0.781, status="escalated", age="14h 40m", title="Caspian H5N1 — avian die-off concordance"),
        InboxItem(id="ANM-2026-0409", region="VNM", tier="T2", score=0.614, status="new", age="22h 08m", title="Red River delta — transitional phenotype"),
        InboxItem(id="ANM-2026-0406", region="JPN", tier="T1", score=0.311, status="monitoring", age="1d 8h", title="Kantō — mobility concordance drift"),
        InboxItem(id="ANM-2026-0402", region="USA", tier="T1", score=0.192, status="new", age="1d 17h", title="Northeast corridor — genomic intro uptick"),
        InboxItem(id="ANM-2026-0398", region="MEX", tier="T1", score=0.228, status="dismissed", age="2d 4h", title="Valley of México — wastewater anomaly (assay)"),
        InboxItem(id="ANM-2026-0391", region="CSP", tier="T2", score=0.512, status="escalated", age="3d 2h", title="Caspian basin — secondary mortality cluster"),
    ]


def build_notebook() -> list[NotebookCell]:
    return [
        NotebookCell(n=1, kind="md", title="PRISM · VirSift Integrated Pipeline", src=""),
        NotebookCell(n=2, kind="code", lang="py", src="import virsift as vs\nstreams = vs.load_streams(['flunet','gisaid','opensky','fao','biobot'])\nprint(streams.summary())"),
        NotebookCell(n=3, kind="out", src="5 streams · latency median 06h 02m · QC pass 5/5"),
        NotebookCell(n=4, kind="md", title="Parse FASTA → metric computation", src=""),
        NotebookCell(n=5, kind="code", lang="py", src="seqs = vs.parse_fasta('gisaid/H3N2_2022-2026.fa.gz')\nmetrics = vs.compute_seven(seqs, clock='treetime', ref='A/HK/4801/2014')\nprint(len(seqs), 'sequences ·', metrics.shape)"),
        NotebookCell(n=6, kind="out", src="4,128 sequences · metrics.shape = (4128, 7)"),
        NotebookCell(n=7, kind="md", title="EpiSplat export for COMPASS", src=""),
        NotebookCell(n=8, kind="code", lang="py", src="vs.to_episplat(metrics, out='episplat/h3n2_2026w16.json', compress=True)"),
    ]


def build_drug_candidates() -> list[DrugCandidate]:
    return [
        DrugCandidate(name="Oseltamivir", affinity=0.92, selectivity=0.78, status="lead"),
        DrugCandidate(name="Baloxavir", affinity=0.87, selectivity=0.84, status="lead"),
        DrugCandidate(name="PRX-4182", affinity=0.71, selectivity=0.91, status="candidate"),
        DrugCandidate(name="CC-42344", affinity=0.64, selectivity=0.68, status="preclinical"),
    ]


async def seed_demo_data():
    """Populate the in-memory store with demo data on startup."""
    from app.storage.store import store

    store.pathogen = Pathogen(name="H3N2 · A/Novosibirsk/0047/2026", clade="3C.2a1b.2a.B.1.7.2")
    store.regions = build_regions()
    store.sources = build_sources()
    store.clades = build_clades()
    store.metrics = build_metrics()
    store.heat = build_heat()
    store.forecast = {"global": build_forecast()}
    store.incidence = build_incidence()
    store.tree = build_tree()
    store.sankey = build_sankey()
    store.root_to_tip = build_root_to_tip()
    store.mutations = build_mutations()
    store.alignment = build_alignment()
    store.inbox = build_inbox()
    store.notebook = build_notebook()
    store.drug_candidates = build_drug_candidates()
