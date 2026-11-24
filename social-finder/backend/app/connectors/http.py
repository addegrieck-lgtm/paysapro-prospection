"""Client HTTP commun : délais, identification, limitation de débit."""
from __future__ import annotations

import threading
import time

import httpx

from ..config import USER_AGENT

_last_call: dict[str, float] = {}
_lock = threading.Lock()


def throttle(key: str, min_interval: float) -> None:
    """Respecte un intervalle minimal entre deux appels au même service (ex. 1 requête/seconde)."""
    with _lock:
        wait = _last_call.get(key, 0) + min_interval - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_call[key] = time.monotonic()


def client(timeout: float = 12.0) -> httpx.Client:
    return httpx.Client(timeout=timeout, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
