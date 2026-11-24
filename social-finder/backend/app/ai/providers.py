"""Fournisseurs de rédaction : modèles (défaut, gratuit, hors ligne), Ollama (local), API compatible OpenAI,
API Anthropic. Aucun fournisseur payant n'est obligatoire."""
from __future__ import annotations

import json
from typing import Any

import httpx

from .. import settings_store
from ..connectors.http import client


class AIError(Exception):
    pass


def provider_status() -> dict[str, Any]:
    s = settings_store.get_all()
    p = s["ai_provider"]
    info = {"provider": p, "ready": True, "message": "Modèles de messages (gratuit, hors ligne)"}
    if p == "ollama":
        try:
            with client(timeout=3) as c:
                tags = c.get(f"{s['ai_ollama_url'].rstrip('/')}/api/tags").json()
            models = [m["name"] for m in tags.get("models", [])]
            ok = any(m.split(":")[0] == s["ai_ollama_model"].split(":")[0] for m in models)
            info.update(ready=ok, message=f"Ollama actif ({', '.join(models[:5]) or 'aucun modèle'})" if ok else
                        f"Ollama joignable mais le modèle « {s['ai_ollama_model']} » n'est pas installé (ollama pull {s['ai_ollama_model']})", models=models)
        except (httpx.HTTPError, ValueError):
            info.update(ready=False, message="Ollama non démarré sur cet ordinateur (https://ollama.com)")
    elif p == "openai":
        info.update(ready=bool(s["ai_openai_key"] or "localhost" in s["ai_openai_url"]), message=f"API compatible OpenAI ({s['ai_openai_model']})")
    elif p == "anthropic":
        info.update(ready=bool(s["ai_anthropic_key"]), message=f"API Anthropic ({s['ai_anthropic_model']})" if s["ai_anthropic_key"] else "Clé Anthropic absente")
    return info


def complete(system: str, user: str, max_tokens: int = 600) -> tuple[str, str]:
    """→ (texte, fournisseur). Lève AIError si le fournisseur configuré échoue (l'appelant revient aux modèles)."""
    s = settings_store.get_all()
    p = s["ai_provider"]
    try:
        if p == "ollama":
            with client(timeout=120) as c:
                res = c.post(f"{s['ai_ollama_url'].rstrip('/')}/api/chat", json={
                    "model": s["ai_ollama_model"], "stream": False, "options": {"temperature": 0.7},
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
            res.raise_for_status()
            return res.json()["message"]["content"], "ollama"
        if p == "openai":
            headers = {"Authorization": f"Bearer {s['ai_openai_key']}"} if s["ai_openai_key"] else {}
            with client(timeout=90) as c:
                res = c.post(f"{s['ai_openai_url'].rstrip('/')}/chat/completions", headers=headers, json={
                    "model": s["ai_openai_model"], "temperature": 0.7, "max_tokens": max_tokens,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"], "openai"
        if p == "anthropic":
            with client(timeout=90) as c:
                res = c.post("https://api.anthropic.com/v1/messages", headers={
                    "x-api-key": s["ai_anthropic_key"], "anthropic-version": "2023-06-01", "content-type": "application/json"}, json={
                    "model": s["ai_anthropic_model"], "max_tokens": max_tokens, "system": system,
                    "messages": [{"role": "user", "content": user}]})
            res.raise_for_status()
            data = res.json()
            return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"), "anthropic"
    except (httpx.HTTPError, KeyError, ValueError, json.JSONDecodeError) as e:
        raise AIError(f"{p} : {type(e).__name__} {e}") from e
    raise AIError("Aucun fournisseur IA configuré")
