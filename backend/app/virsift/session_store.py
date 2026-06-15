"""In-memory session store for VirSift parsed datasets.

Each upload creates a session with a DataFrame of parsed sequences.
Filter/sample operations mutate the session's working DataFrame.
"""

import pandas as pd


class VirsiftSession:
    def __init__(self, session_id: str, filename: str, df: pd.DataFrame):
        self.session_id = session_id
        self.filename = filename
        self.original_df = df.copy()
        self.working_df = df.copy()

    @property
    def original_count(self) -> int:
        return len(self.original_df)

    @property
    def current_count(self) -> int:
        return len(self.working_df)

    def reset(self):
        self.working_df = self.original_df.copy()


class VirsiftSessionStore:
    def __init__(self):
        self.sessions: dict[str, VirsiftSession] = {}

    def create(self, session_id: str, filename: str, df: pd.DataFrame) -> VirsiftSession:
        session = VirsiftSession(session_id, filename, df)
        self.sessions[session_id] = session
        return session

    def get(self, session_id: str) -> VirsiftSession | None:
        return self.sessions.get(session_id)


virsift_store = VirsiftSessionStore()
