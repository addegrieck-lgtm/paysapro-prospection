"""Rapprochement Facebook ↔ Instagram et dédoublonnage.

Fusion AUTOMATIQUE uniquement sur preuve forte (lien croisé explicite, ou même identifiant + nom quasi identique
+ même ville). Sinon : suggestion soumise à validation humaine, avec un score et ses raisons.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..text import compact, contains_phrase, name_similarity, norm


@dataclass
class MatchVerdict:
    score: int  # 0..100
    auto: bool  # fusion automatique autorisée
    reasons: list[str] = field(default_factory=list)


def _text(p: dict[str, Any]) -> str:
    return norm(" ".join(str(p.get(k) or "") for k in ("display_name", "bio", "snippet", "location", "category")))


def compare_profiles(ig: dict[str, Any], fb: dict[str, Any], city: str | None = None) -> MatchVerdict:
    """Compare un profil Instagram et une page Facebook. Renvoie un score de correspondance et ses raisons."""
    reasons: list[str] = []
    score = 0
    ig_handle, fb_handle = (ig.get("handle") or "").lower(), (fb.get("handle") or "").lower()
    fb_mentions = [h.lower() for h in (fb.get("mentioned_handles") or [])]
    ig_mentions = [h.lower() for h in (ig.get("mentioned_handles") or []) if h.lower() != ig_handle]
    api_ig = (((fb.get("api_data") or {}).get("instagram_business_account")) or {}).get("username", "")
    cross = False
    if api_ig and api_ig.lower() == ig_handle:
        reasons.append("La page Facebook déclare ce compte Instagram (API officielle)")
        score += 60
        cross = True
    elif ig_handle in fb_mentions:
        reasons.append(f"La page Facebook mentionne @{ig_handle}")
        score += 50
        cross = True
    elif fb_handle and not fb_handle.isdigit() and fb_handle in ig_mentions:
        reasons.append("Le profil Instagram mentionne la page Facebook")
        score += 50
        cross = True
    same_handle = bool(ig_handle and fb_handle and compact(ig_handle) == compact(fb_handle))
    if same_handle:
        reasons.append(f"Même identifiant (@{ig_handle})")
        score += 25
    sim = name_similarity(ig.get("display_name"), fb.get("display_name"))
    if sim >= 0.9:
        reasons.append(f"Nom quasi identique ({sim:.0%})")
        score += 25
    elif sim >= 0.7:
        reasons.append(f"Nom proche ({sim:.0%})")
        score += 15
    elif ig.get("display_name") and fb.get("display_name") and sim < 0.4:
        reasons.append("Noms différents")
        score -= 20
    same_city = bool(city and contains_phrase(_text(ig), city) and contains_phrase(_text(fb), city))
    if same_city:
        reasons.append(f"Même ville mentionnée ({city})")
        score += 10
    ws_ig, ws_fb = compact(ig.get("website")), compact(fb.get("website"))
    if ws_ig and ws_ig == ws_fb:
        reasons.append("Même site Internet")
        score += 25
    score = max(0, min(100, score))
    auto = cross or (same_handle and sim >= 0.9) or (sim >= 0.95 and same_city and bool(ws_ig and ws_ig == ws_fb))
    return MatchVerdict(score, auto, reasons)


def same_company_name(a: str | None, b: str | None) -> float:
    return name_similarity(a, b)
