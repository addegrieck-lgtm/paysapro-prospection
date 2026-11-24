"""Interface commune des connecteurs (moteurs de recherche, API Meta, services publics)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Protocol

from ..db import session


class ConnectorError(Exception):
    """kind : not_configured | quota | auth | unavailable | forbidden"""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind
        self.message = message


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


@dataclass
class ConnectorStatus:
    id: str
    label: str
    kind: str  # search | meta | analysis | ai
    configured: bool
    enabled: bool
    state: str  # ok | not_configured | disabled | error | quota
    message: str
    used_today: int = 0
    daily_limit: int | None = None
    free_tier: str = ""
    limits: list[str] = field(default_factory=list)
    setup_steps: list[str] = field(default_factory=list)
    features: list[str] = field(default_factory=list)
    permissions_granted: list[str] = field(default_factory=list)
    permissions_missing: list[str] = field(default_factory=list)
    docs_url: str = ""
    details: dict[str, Any] = field(default_factory=dict)


class SearchConnector(Protocol):
    id: str
    label: str
    max_offset_pages: int

    def is_ready(self) -> bool: ...

    def search(self, query: str, page: int = 0) -> list[SearchResult]: ...

    def status(self) -> ConnectorStatus: ...


def usage_today(provider: str) -> int:
    with session() as conn:
        r = conn.execute("SELECT count FROM api_usage WHERE provider=? AND day=?", (provider, date.today().isoformat())).fetchone()
        return int(r["count"]) if r else 0


def record_usage(provider: str, n: int = 1) -> None:
    with session() as conn:
        conn.execute("INSERT INTO api_usage(provider, day, count) VALUES (?,?,?) "
                     "ON CONFLICT(provider, day) DO UPDATE SET count = count + excluded.count",
                     (provider, date.today().isoformat(), n))


def check_quota(provider: str, limit: int | None) -> None:
    if limit and usage_today(provider) >= limit:
        raise ConnectorError("quota", f"Limite quotidienne atteinte pour {provider} ({limit} requêtes). Reprise demain ou augmentez la limite dans les paramètres si votre offre le permet.")
