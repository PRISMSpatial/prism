"""In-memory data store — all GET endpoints read from here."""
from app.models.domain import (
    Region, DataSource, Clade, Metric, HeatRow, ForecastData, IncidenceData,
    TreeData, SankeyFlow, RootToTipPoint, Mutation, AlignmentChar,
    InboxItem, NotebookCell, Pathogen, DrugCandidate, PipelineStatus,
)


class PrismDataStore:
    def __init__(self):
        self.pathogen: Pathogen | None = None
        self.regions: list[Region] = []
        self.sources: list[DataSource] = []
        self.clades: list[Clade] = []
        self.metrics: list[Metric] = []
        self.heat: list[HeatRow] = []
        self.forecast: dict[str, ForecastData] = {}
        self.incidence: IncidenceData | None = None
        self.tree: TreeData | None = None
        self.sankey: list[SankeyFlow] = []
        self.root_to_tip: list[RootToTipPoint] = []
        self.mutations: list[Mutation] = []
        self.alignment: list[AlignmentChar] = []
        self.inbox: list[InboxItem] = []
        self.notebook: list[NotebookCell] = []
        self.drug_candidates: list[DrugCandidate] = []
        self.pipeline_runs: dict[str, PipelineStatus] = {}


store = PrismDataStore()
