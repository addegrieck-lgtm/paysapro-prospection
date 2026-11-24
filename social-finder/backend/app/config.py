"""Chemins et constantes de l'application. Tout est stocké localement dans le dossier « data »."""
from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "S&S Social Finder"
APP_VERSION = "1.0.0"

ROOT_DIR = Path(__file__).resolve().parents[2]  # social-finder/
DATA_DIR = Path(os.environ.get("SSF_DATA_DIR", ROOT_DIR / "data"))
DB_PATH = Path(os.environ.get("SSF_DB_PATH", DATA_DIR / "social_finder.db"))
LOG_DIR = DATA_DIR / "logs"
BACKUP_DIR = DATA_DIR / "backups"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

USER_AGENT = "SSSocialFinder/1.0 (+prospection B2B locale; Signe & Seine)"


def ensure_dirs() -> None:
    for d in (DATA_DIR, LOG_DIR, BACKUP_DIR):
        d.mkdir(parents=True, exist_ok=True)
