"""Diagnostic du site Internet de l'entreprise (une seule requête sur la page d'accueil, jamais sur Meta).

Uniquement des signaux CONSTATÉS : pas de HTTPS, pas adapté au téléphone, copyright ancien, technologie
dépassée, site gratuit sans nom de domaine. Le constructeur (Wix, WordPress…) est relevé pour information.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any
from urllib.parse import urlparse

import httpx

from .http import client, throttle

FREE_HOST = re.compile(r"\.(wixsite\.com|e-monsite\.com|jimdofree\.com|jimdosite\.com|webnode\.(fr|com)|site123\.me|wordpress\.com|blogspot\.com|over-blog\.com|business\.site|godaddysites\.com|weebly\.com|simplesite\.com|strikingly\.com|my\.canva\.site|carrd\.co)$", re.I)
BUILDERS = [
    (re.compile(r"wix\.com|wixstatic\.com|_wixCIDX", re.I), "Wix"), (re.compile(r"jimdo", re.I), "Jimdo"),
    (re.compile(r"e-monsite", re.I), "e-monsite"), (re.compile(r"webnode", re.I), "Webnode"),
    (re.compile(r"squarespace", re.I), "Squarespace"), (re.compile(r"shopify", re.I), "Shopify"),
    (re.compile(r"wp-content|wp-includes", re.I), "WordPress"), (re.compile(r"weebly", re.I), "Weebly"),
]
MAX_BYTES = 1_500_000


def copyright_year(html: str, today: date | None = None) -> int | None:
    today = today or date.today()
    text = re.sub(r"&copy;|&#169;|&#xa9;", "©", html, flags=re.I)
    years: list[int] = []
    for m in re.finditer(r"(?:©|copyright)[^0-9<]{0,40}((?:19|20)\d{2})(?:\s*[-–/à]\s*((?:19|20)\d{2}))?", text, re.I):
        years.append(int(m.group(1)))
        if m.group(2):
            years.append(int(m.group(2)))
    valid = [y for y in years if 1995 <= y <= today.year]
    return max(valid) if valid else None


def assess(html: str, final_url: str, today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    u = urlparse(final_url)
    host = (u.hostname or "").lower()
    https = u.scheme == "https"
    mobile = re.search(r"<meta[^>]+name\s*=\s*[\"']viewport[\"']", html, re.I) is not None
    year = copyright_year(html, today)
    builder = next((name for rx, name in BUILDERS if rx.search(html) or rx.search(host)), None)
    free_host = FREE_HOST.search(host) is not None
    old_tech = re.search(r"\.swf\b|<embed[^>]+flash|<font\b|<frameset\b", html, re.I) is not None
    social_links = sorted({m.group(0).rstrip('"\'/') for m in re.finditer(r"https?://(?:www\.)?(?:instagram|facebook)\.com/[A-Za-z0-9._\-/?=]+", html)})[:10]
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    issues = []
    if not https:
        issues.append("pas de HTTPS")
    if not mobile:
        issues.append("pas adapté au téléphone (aucune balise viewport)")
    if year is not None and today.year - year >= 4:
        issues.append(f"mention de copyright ancienne ({year})")
    if old_tech:
        issues.append("technologie dépassée (Flash, balises <font> ou cadres)")
    if free_host:
        issues.append("site gratuit sans nom de domaine propre")
    return {"reachable": True, "final_url": final_url, "host": host, "https": https, "mobile": mobile, "copyright_year": year,
            "builder": builder, "social_links": social_links, "free_host": free_host, "old_tech": old_tech, "issues": issues,
            "title": re.sub(r"\s+", " ", title_m.group(1)).strip()[:200] if title_m else None, "checked_at": today.isoformat()}


def check_website(url: str) -> dict[str, Any]:
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    throttle("website", 0.3)
    try:
        with client(timeout=10) as c:
            with c.stream("GET", url, headers={"Accept": "text/html"}) as res:
                if res.status_code >= 400:
                    return {"reachable": False, "error": f"HTTP {res.status_code}", "final_url": str(res.url), "checked_at": date.today().isoformat()}
                chunks, size = [], 0
                for chunk in res.iter_bytes():
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > MAX_BYTES:
                        break
                html = b"".join(chunks).decode(res.encoding or "utf-8", errors="replace")
                return assess(html, str(res.url))
    except httpx.HTTPError as e:
        return {"reachable": False, "error": type(e).__name__, "final_url": url, "checked_at": date.today().isoformat()}
