"""Journal technique : fichier tournant dans data/logs/app.log, consultable depuis l'interface."""
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from .config import LOG_DIR, ensure_dirs

log = logging.getLogger("ssf")


def setup_logging() -> None:
    if log.handlers:
        return
    ensure_dirs()
    log.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s", "%Y-%m-%d %H:%M:%S")
    fh = RotatingFileHandler(LOG_DIR / "app.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    log.addHandler(fh)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    log.addHandler(sh)


def tail(lines: int = 300) -> list[str]:
    path = LOG_DIR / "app.log"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", errors="replace") as f:
        return f.readlines()[-lines:]
