"""Outils de normalisation de texte (noms commerciaux, villes, identifiants)."""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

STOP_WORDS = {
    "le", "la", "les", "l", "de", "du", "des", "d", "et", "a", "au", "aux", "en", "chez", "the", "by",
    "sarl", "sas", "sasu", "eurl", "ei", "sa", "official", "officiel", "officielle", "page", "fr", "france",
}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s: str | None) -> str:
    """Minuscules, sans accents, ponctuation remplacée par des espaces."""
    if not s:
        return ""
    s = strip_accents(s).lower().replace("&", " et ").replace("'", " ").replace("’", " ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(s: str | None, min_len: int = 2) -> list[str]:
    return [t for t in norm(s).split() if t not in STOP_WORDS and len(t) >= min_len]


def compact(s: str | None) -> str:
    """« Le Petit-Quai » → « petitquai » (mots vides retirés)."""
    return "".join(tokens(s, 1))


def contains_phrase(text_norm: str, phrase: str | None) -> bool:
    """Recherche d'une expression entière (bornes de mots) dans un texte déjà normalisé."""
    p = norm(phrase)
    if not p or not text_norm:
        return False
    return re.search(rf"(?<![a-z0-9]){re.escape(p)}(?![a-z0-9])", text_norm) is not None


def name_similarity(a: str | None, b: str | None) -> float:
    """Similarité 0..1 entre deux noms ou identifiants (insensible aux espaces, points, tirets)."""
    ca, cb = compact(a), compact(b)
    if not ca or not cb:
        return 0.0
    if ca == cb:
        return 1.0
    shorter, longer = sorted((ca, cb), key=len)
    if len(shorter) >= 5 and shorter in longer:
        return 0.75 + 0.25 * len(shorter) / len(longer)
    ratio = SequenceMatcher(None, ca, cb).ratio()
    ta, tb = set(tokens(a, 3)), set(tokens(b, 3))
    if ta and tb:
        # Mots du nom présents dans l'identifiant collé (« garagedupont76 » contient « garage » et « dupont »)
        inside = max(sum(1 for t in ta if t in cb) / len(ta), sum(1 for t in tb if t in ca) / len(tb))
        ratio = max(ratio, 0.9 * inside)
    return round(min(ratio, 1.0), 3)


def parse_count(raw: str) -> int | None:
    """« 1,234 » / « 1 234 » / « 2K » / « 1,2 k » / « 3.4M » → entier."""
    s = raw.strip().lower().replace(" ", " ").replace("\xa0", " ")
    m = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*([km])", s)
    if m:
        value = float(m.group(1).replace(",", "."))
        return int(value * (1000 if m.group(2) == "k" else 1_000_000))
    digits = re.sub(r"[ ,.]", "", s)
    return int(digits) if digits.isdigit() else None
