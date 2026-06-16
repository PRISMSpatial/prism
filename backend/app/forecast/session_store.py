"""In-memory forecast session store with TTL eviction."""

import time
from dataclasses import dataclass, field


@dataclass
class ForecastSession:
    session_id: str
    result: dict
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)


MAX_SESSIONS = 20
SESSION_TTL = 3600


class ForecastSessionStore:
    def __init__(self):
        self._sessions: dict[str, ForecastSession] = {}

    def _evict_expired(self):
        now = time.time()
        expired = [k for k, v in self._sessions.items() if now - v.last_accessed > SESSION_TTL]
        for k in expired:
            del self._sessions[k]

    def _evict_oldest(self):
        if len(self._sessions) >= MAX_SESSIONS:
            oldest = min(self._sessions, key=lambda k: self._sessions[k].last_accessed)
            del self._sessions[oldest]

    def create(self, session_id: str, result: dict):
        self._evict_expired()
        self._evict_oldest()
        self._sessions[session_id] = ForecastSession(session_id=session_id, result=result)

    def get(self, session_id: str) -> ForecastSession | None:
        self._evict_expired()
        s = self._sessions.get(session_id)
        if s:
            s.last_accessed = time.time()
        return s


forecast_store = ForecastSessionStore()
