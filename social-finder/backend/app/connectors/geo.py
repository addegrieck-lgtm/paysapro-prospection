"""Rayon géographique : communes autour d'une ville via l'API officielle et gratuite geo.api.gouv.fr."""
from __future__ import annotations

import math
from functools import lru_cache
from typing import Any

import httpx

from .http import client

API = "https://geo.api.gouv.fr"


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lon1, lat1), (lon2, lat2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


@lru_cache(maxsize=256)
def find_city(name: str) -> dict[str, Any] | None:
    with client(timeout=8) as c:
        res = c.get(f"{API}/communes", params={"nom": name, "fields": "nom,code,centre,codeDepartement,population", "boost": "population", "limit": 1})
    res.raise_for_status()
    data = res.json()
    return data[0] if data else None


@lru_cache(maxsize=128)
def department_communes(dep: str) -> tuple[dict[str, Any], ...]:
    with client(timeout=10) as c:
        res = c.get(f"{API}/departements/{dep}/communes", params={"fields": "nom,code,centre,population"})
    res.raise_for_status()
    return tuple(res.json())


def nearby_communes(communes: list[dict[str, Any]] | tuple[dict[str, Any], ...], center: tuple[float, float], radius_km: float,
                    limit: int = 10, min_population: int = 1500) -> list[dict[str, Any]]:
    """Communes dans le rayon, les plus peuplées d'abord (plus de chances d'y trouver des entreprises)."""
    out = []
    for c in communes:
        coords = (c.get("centre") or {}).get("coordinates")
        if not coords:
            continue
        d = haversine_km(center, (coords[0], coords[1]))
        if d <= radius_km and (c.get("population") or 0) >= min_population:
            out.append({**c, "distance_km": round(d, 1)})
    out.sort(key=lambda c: -(c.get("population") or 0))
    return out[:limit]


def communes_around(city: str, radius_km: float, limit: int = 8) -> tuple[list[str], str | None]:
    """→ (noms des communes voisines, message d'erreur éventuel). La ville d'origine n'est pas incluse."""
    try:
        origin = find_city(city)
        if not origin or not origin.get("centre"):
            return [], f"Ville « {city} » introuvable dans geo.api.gouv.fr"
        center = tuple(origin["centre"]["coordinates"])
        # Limitation : seules les communes du même département sont proposées
        communes = department_communes(origin["codeDepartement"])
        found = [c["nom"] for c in nearby_communes(communes, center, radius_km, limit + 1) if c["code"] != origin["code"]]
        return found[:limit], None
    except (httpx.HTTPError, ValueError, KeyError) as e:
        return [], f"Service geo.api.gouv.fr indisponible ({type(e).__name__}) : recherche limitée à la ville saisie"
