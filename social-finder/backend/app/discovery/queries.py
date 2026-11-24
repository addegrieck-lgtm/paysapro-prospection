"""Génération automatique des requêtes de découverte (métier × lieu × réseau × variantes)."""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote_plus

from ..referentials import Activity

SITES = {"instagram": "instagram.com", "facebook": "facebook.com"}


@dataclass(frozen=True)
class Query:
    text: str
    platform: str
    activity_key: str
    place: str


def build_queries(activities: list[Activity], places: list[str], platforms: list[str], keywords: list[str] | None = None) -> list[Query]:
    """Ordre : requête principale de chaque (activité, lieu, réseau) d'abord, puis les variantes (synonymes, mots-clés).
    Ainsi, même avec un petit quota, chaque combinaison est couverte au moins une fois."""
    keywords = [k.strip() for k in (keywords or []) if k.strip()]
    primary: list[Query] = []
    variants: list[Query] = []
    for act in activities:
        terms = list(dict.fromkeys([act.synonyms[0], *act.synonyms[1:4]]))
        for place in places:
            for platform in platforms:
                site = SITES[platform]
                primary.append(Query(f'{terms[0]} "{place}" site:{site}', platform, act.key, place))
                for t in terms[1:]:
                    variants.append(Query(f'{t} "{place}" site:{site}', platform, act.key, place))
                for kw in keywords:
                    variants.append(Query(f'{terms[0]} {kw} "{place}" site:{site}', platform, act.key, place))
    seen: set[str] = set()
    out = []
    for q in primary + variants:
        if q.text not in seen:
            seen.add(q.text)
            out.append(q)
    return out


def assisted_links(query: str) -> dict[str, str]:
    """Liens à ouvrir par l'utilisateur (recherche assistée : navigation humaine, aucune collecte automatique)."""
    q = quote_plus(query)
    return {
        "google": f"https://www.google.com/search?q={q}",
        "bing": f"https://www.bing.com/search?q={q}",
        "duckduckgo": f"https://duckduckgo.com/?q={q}",
    }
