"""Reconnaissance des URL de profils Instagram / pages Facebook et lecture des extraits de moteurs de recherche.

Aucune page Facebook ou Instagram n'est téléchargée : on ne lit que l'URL, le titre et l'extrait renvoyés
par un moteur de recherche autorisé (ou saisis par l'utilisateur).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import parse_qs, unquote, urlparse

from .text import parse_count

IG_RESERVED = {
    "p", "reel", "reels", "explore", "stories", "accounts", "tv", "about", "legal", "developer", "directory",
    "web", "tags", "locations", "challenge", "direct", "privacy", "terms", "session", "emails", "press", "api",
}
FB_RESERVED = {
    "groups", "events", "watch", "marketplace", "photo", "photo.php", "photos", "story.php", "share", "sharer",
    "sharer.php", "login", "login.php", "help", "policies", "hashtag", "reel", "reels", "videos", "permalink.php",
    "people", "public", "search", "gaming", "business", "ads", "notes", "media", "messages", "settings", "privacy",
    "legal", "pages", "careers", "dialog", "plugins", "l.php", "home.php", "recover", "r.php", "fundraisers", "stories",
    "places", "bookmarks", "friends", "profile", "tr", "ajax", "about", "terms", "events.php",
}
IG_HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
FB_SLUG = re.compile(r"^[A-Za-z0-9.\-_]{2,80}$")


@dataclass
class SocialRef:
    platform: str  # "instagram" | "facebook"
    handle: str  # identifiant normalisé (minuscules) : nom d'utilisateur, slug de page ou id numérique
    url: str  # URL canonique du profil


def parse_social_url(raw: str) -> SocialRef | None:
    """URL quelconque → profil Instagram / page Facebook, ou None (publication, groupe, événement, autre site…)."""
    if not raw:
        return None
    url = raw.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    try:
        u = urlparse(url)
    except ValueError:
        return None
    host = (u.hostname or "").lower()
    parts = [unquote(p) for p in u.path.split("/") if p]
    if host == "instagram.com" or host.endswith(".instagram.com"):
        if not parts:
            return None
        h = parts[0]
        if h.lower() in IG_RESERVED or not IG_HANDLE.match(h) or h.startswith(".") or h.endswith("."):
            return None
        h = h.lower()
        return SocialRef("instagram", h, f"https://www.instagram.com/{h}/")
    if host in ("facebook.com", "fb.com") or host.endswith(".facebook.com"):
        if not parts:
            return None
        first = parts[0].lower()
        if first == "profile.php":
            pid = parse_qs(u.query).get("id", [""])[0]
            return SocialRef("facebook", pid, f"https://www.facebook.com/profile.php?id={pid}") if pid.isdigit() else None
        if first == "p" and len(parts) >= 2:
            # Nouveau format des pages : /p/Nom-De-La-Page-100063123456789/
            slug = parts[1]
            m = re.search(r"-(\d{6,})$", slug)
            handle = m.group(1) if m else slug.lower()
            return SocialRef("facebook", handle, f"https://www.facebook.com/p/{slug}/")
        if first == "pages" and len(parts) >= 3 and parts[-1].isdigit():
            return SocialRef("facebook", parts[-1], f"https://www.facebook.com/{parts[-1]}")
        if first in FB_RESERVED or first.endswith(".php") or not FB_SLUG.match(parts[0]):
            return None
        slug = parts[0]
        m = re.search(r"-(\d{9,})$", slug)  # /Nom-De-Page-123456789012/
        if m:
            return SocialRef("facebook", m.group(1), f"https://www.facebook.com/{slug}/")
        return SocialRef("facebook", slug.lower(), f"https://www.facebook.com/{slug}/")
    return None


@dataclass
class SnippetInfo:
    display_name: str | None = None
    bio: str | None = None
    followers: int | None = None
    following: int | None = None
    posts: int | None = None
    likes: int | None = None
    checkins: int | None = None  # « personnes étaient ici » : lieu physique fréquenté
    mentioned_handles: list[str] = field(default_factory=list)
    mentioned_urls: list[str] = field(default_factory=list)


_IG_TITLE = re.compile(r"^(?P<name>.*?)\s*\(@(?P<handle>[A-Za-z0-9._]+)\)", re.S)
_FB_TITLE_SUFFIX = re.compile(r"\s*[|\-–·•]\s*(facebook|accueil|home|à propos|about|photos|avis|reviews)\s*$", re.I)
_NUM = r"(\d[\d\s \xa0.,]*\s?[kKmM]?)"


def _num(pattern: str, text: str) -> int | None:
    m = re.search(pattern, text, re.I)
    return parse_count(m.group(1)) if m else None


def clean_title_name(platform: str, title: str) -> str | None:
    t = re.sub(r"\s+", " ", title or "").strip()
    if not t:
        return None
    if platform == "instagram":
        m = _IG_TITLE.match(t)
        if m:
            name = m.group("name").strip(" •·-|")
            return name or None
        t = re.sub(r"\s*[•·|\-–]\s*(photos et vidéos instagram|instagram photos and videos|instagram).*$", "", t, flags=re.I)
        t = re.sub(r"\s+(on|sur) instagram.*$", "", t, flags=re.I)
        return t.strip() or None
    previous = None
    while previous != t:
        previous = t
        t = _FB_TITLE_SUFFIX.sub("", t).strip()
    # « Le Petit Quai | Le Havre » : on garde la première partie
    t = re.split(r"\s+\|\s+", t)[0].strip()
    return t or None


def parse_snippet(platform: str, title: str, snippet: str) -> SnippetInfo:
    """Lit un résultat de moteur de recherche (titre + extrait). Les valeurs viennent de l'index du moteur :
    elles peuvent être anciennes et sont donc marquées comme « extrait indexé » dans les justifications."""
    s = re.sub(r"\s+", " ", snippet or "").strip()
    info = SnippetInfo(display_name=clean_title_name(platform, title))
    if platform == "instagram":
        info.followers = _num(_NUM + r"\s*(?:followers|abonnés|abonné\(e\)s)", s)
        info.following = _num(_NUM + r"\s*(?:following|abonnements)", s)
        info.posts = _num(_NUM + r"\s*(?:posts|publications)", s)
        m = re.search(r"(?:on Instagram|sur Instagram)\s*:\s*[\"“«]\s*(.+?)\s*[\"”»]", s, re.S)
        bio = m.group(1) if m else None
        if not bio:
            bio = re.sub(r"^.*?(?:See Instagram photos and videos from|Voir les photos et vidéos Instagram de)\s+[^)]*\)\s*", "", s)
            bio = re.sub(r"^\s*" + _NUM + r"\s*(followers|abonnés)[^-]*-\s*", "", bio, flags=re.I)
            bio = bio if bio and bio != s or not info.followers else None
        info.bio = (bio or "").strip(" -–.") or None
    else:
        info.likes = _num(_NUM + r"\s*(?:likes|j[’']aime|mentions j[’']aime)", s)
        info.followers = _num(_NUM + r"\s*(?:followers|abonnés|abonné\(e\)s)", s)
        info.checkins = _num(_NUM + r"\s*(?:were here|personnes étaient ici|personnes y étaient)", s)
        bio = re.sub(r"[^.·]*\d[^.·]*(likes|j[’']aime|talking about this|en parlent|were here|étaient ici|abonnés|followers)[^.·]*[.·]?", "", s, flags=re.I)
        info.bio = bio.strip(" ·.-–") or None
    info.mentioned_handles = sorted({h.lower() for h in re.findall(r"(?<![\w.])@([A-Za-z0-9._]{3,30})", s) if not h.endswith(".")})
    info.mentioned_urls = re.findall(r"(?:https?://)?(?:www\.)?(?:instagram|facebook)\.com/[A-Za-z0-9._\-/?=]+", s)
    return info


WEBSITE_RE = re.compile(r"\b((?:https?://)?(?:www\.)?[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.(?:fr|com|net|org|eu|bzh|paris|shop|site|store|restaurant|coiffure)(?:/[^\s\"'<>]*)?)", re.I)
LINK_HUBS = re.compile(r"(linktr\.ee|linktree|beacons\.ai|lnk\.bio|bio\.link|taplink|campsite\.bio|linkin\.bio|msha\.ke|carrd\.co)", re.I)
NON_WEBSITES = re.compile(r"(instagram\.com|facebook\.com|fb\.com|fb\.me|wa\.me|whatsapp|tiktok\.com|youtube\.com|google\.|goo\.gl|gmail\.com|hotmail|outlook|yahoo|orange\.fr$|wanadoo|free\.fr$|planity|treatwell|thefork|lafourchette|ubereats|deliveroo|doctolib)", re.I)


def extract_website(text: str | None) -> str | None:
    """Premier site Internet cité dans un texte (bio, extrait), hors réseaux sociaux et messageries."""
    if not text:
        return None
    for m in WEBSITE_RE.finditer(text):
        cand = m.group(1).rstrip(".,;)")
        if "@" in text[max(0, m.start() - 1):m.start()]:
            continue  # adresse e-mail
        if NON_WEBSITES.search(cand):
            continue
        return cand if cand.lower().startswith("http") else "https://" + cand
    return None
