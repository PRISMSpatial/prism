"""In-memory session store for VirSift parsed datasets.

Each upload creates a session with a DataFrame of parsed sequences.
Filter/sample operations mutate the session's working DataFrame.
Sessions are evicted after TTL or when the max count is reached.
"""

import time

import pandas as pd

MAX_SESSIONS = 20
SESSION_TTL_SECONDS = 3600  # 1 hour


class VirsiftSession:
    def __init__(self, session_id: str, filename: str, df: pd.DataFrame,
                 header_variant: str = "Unknown", confidence: float = 0.0,
                 parse_time: float = 0.0, source: str = "GISAID EpiFlu"):
        self.session_id = session_id
        self.filename = filename
        self.original_df = df.copy()
        self.working_df = df.copy()
        self.header_variant = header_variant
        self.confidence = confidence
        self.parse_time = parse_time
        self.source = source
        self.status = "active"
        self.created_at = time.monotonic()
        self.last_accessed = time.monotonic()

    @property
    def original_count(self) -> int:
        return len(self.original_df)

    @property
    def current_count(self) -> int:
        return len(self.working_df)

    def reset(self):
        self.working_df = self.original_df.copy()

    def touch(self):
        self.last_accessed = time.monotonic()


class VirsiftSessionStore:
    def __init__(self):
        self.sessions: dict[str, VirsiftSession] = {}

    def _evict_expired(self):
        now = time.monotonic()
        expired = [
            sid for sid, s in self.sessions.items()
            if now - s.last_accessed > SESSION_TTL_SECONDS
        ]
        for sid in expired:
            del self.sessions[sid]

    def _evict_oldest_if_full(self):
        if len(self.sessions) >= MAX_SESSIONS:
            oldest = min(self.sessions.values(), key=lambda s: s.last_accessed)
            del self.sessions[oldest.session_id]

    def create(self, session_id: str, filename: str, df: pd.DataFrame, **kwargs) -> VirsiftSession:
        self._evict_expired()
        self._evict_oldest_if_full()
        session = VirsiftSession(session_id, filename, df, **kwargs)
        self.sessions[session_id] = session
        return session

    def get(self, session_id: str) -> VirsiftSession | None:
        self._evict_expired()
        session = self.sessions.get(session_id)
        if session:
            session.touch()
        return session


virsift_store = VirsiftSessionStore()
