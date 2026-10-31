"""Paramètres de l'application (stockés dans SQLite). Les clés d'API restent sur l'ordinateur."""
from __future__ import annotations

import json
from typing import Any

from .db import session

DEFAULTS: dict[str, Any] = {
    "agency_name": "Signe & Seine",
    "sender_name": "",
    "sender_signature": "",
    "agency_pitch": "Je travaille dans la création de sites Internet et la communication visuelle pour les entreprises locales.",
    # Connecteurs de recherche
    "brave_api_key": "",
    "brave_enabled": True,
    "brave_daily_limit": 60,
    "google_cse_key": "",
    "google_cse_cx": "",
    "google_cse_enabled": True,
    "google_cse_daily_limit": 90,
    # API Meta
    "meta_access_token": "",
    "meta_ig_user_id": "",
    "meta_graph_version": "v21.0",
    "meta_daily_limit": 150,
    # Analyse
    "website_check_enabled": True,
    "geo_api_enabled": True,
    # IA
    "ai_provider": "templates",  # templates | ollama | openai | anthropic
    "ai_ollama_url": "http://localhost:11434",
    "ai_ollama_model": "llama3.1",
    "ai_openai_url": "https://api.openai.com/v1",
    "ai_openai_key": "",
    "ai_openai_model": "gpt-4o-mini",
    "ai_anthropic_key": "",
    "ai_anthropic_model": "claude-haiku-5-5",
    # RGPD
    "retention_days": 365,
}

SECRET_KEYS = {"brave_api_key", "google_cse_key", "meta_access_token", "ai_openai_key", "ai_anthropic_key"}


def get_all() -> dict[str, Any]:
    values = dict(DEFAULTS)
    with session() as conn:
        for r in conn.execute("SELECT key, value FROM settings"):
            if r["key"] in DEFAULTS:
                values[r["key"]] = json.loads(r["value"])
    return values


def get(key: str) -> Any:
    return get_all().get(key, DEFAULTS.get(key))


def public_view() -> dict[str, Any]:
    """Paramètres envoyés à l'interface : secrets masqués (seule leur présence est indiquée)."""
    values = get_all()
    for k in SECRET_KEYS:
        v = values.get(k) or ""
        values[k] = ("••••" + v[-4:]) if v else ""
    return values


def update(changes: dict[str, Any]) -> dict[str, Any]:
    with session() as conn:
        for k, v in changes.items():
            if k not in DEFAULTS:
                continue
            if k in SECRET_KEYS and isinstance(v, str) and v.startswith("••••"):
                continue  # valeur masquée renvoyée telle quelle : on conserve le secret existant
            conn.execute("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                         (k, json.dumps(v)))
    return public_view()
