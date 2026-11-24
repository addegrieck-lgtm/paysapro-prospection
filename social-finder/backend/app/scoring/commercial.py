"""SCORE DE POTENTIEL COMMERCIAL (/100) : « Cette entreprise est-elle une opportunité pour Signe & Seine ? »

Besoin en communication/visibilité 25 · Site Internet (création/refonte) 20 · Présence sociale perfectible 15 ·
Identité visuelle 15 · Pertinence des services pour l'activité 15 · Activité réelle et actuelle 10.

Règles : aucun besoin inventé ; l'absence de site n'est jamais traitée comme une preuve de mauvais marketing
(seulement une opportunité à vérifier) ; observations et hypothèses sont distinguées ; une donnée inconnue
ne rapporte rien.
"""
from __future__ import annotations

import re
from typing import Any

from ..social_urls import LINK_HUBS
from ..text import name_similarity
from .common import COMMERCIAL_LEVELS, CONTRADICTION, HYPOTHESIS, OBSERVED, UNKNOWN, VERIFIED, Criterion, level, total
from .facts import CompanyFacts

CLOSED = re.compile(r"(fermé définitivement|fermeture définitive|définitivement fermé|permanently closed|cessation d.activité|liquidation)", re.I)
NEW_BUSINESS = re.compile(r"(nouvelle ouverture|grande ouverture|ouverture (?:le|prochaine|en|officielle|imminente)|ouvre (?:ses portes|bientôt)|"
                          r"nouveau (?:salon|restaurant|commerce|magasin|lieu|concept)|nouvelle adresse|bientôt|prochainement|inauguration|"
                          r"vient d.ouvrir|coming soon|grand opening|nouveaux propriétaires|nouvelle équipe|reprise de)", re.I)


def _src_status(p) -> str:
    return VERIFIED if p.api_verified else OBSERVED


def _need(f: CompanyFacts) -> Criterion:
    c = Criterion("communication_need", "Besoin potentiel en communication ou visibilité", 25)
    ig = f.ig
    if ig and ig.followers is not None:
        n = ig.followers
        pts, txt = (12, "audience très réduite") if n < 300 else (9, "audience modeste") if n < 1000 else (5, "audience moyenne") if n < 3000 else (1, "audience déjà importante")
        c.add(f"{n} abonnés Instagram — {txt}", _src_status(ig), pts, ig.src_label)
    if ig and ig.posts is not None:
        n = ig.posts
        pts = 8 if n < 20 else 5 if n < 60 else 1
        c.add(f"{n} publications Instagram", _src_status(ig), pts, ig.src_label)
    fb = f.fb
    if fb and (fb.likes is not None or fb.followers is not None):
        n = fb.followers if fb.followers is not None else fb.likes
        pts = 10 if n < 300 else 7 if n < 1000 else 3 if n < 3000 else 0
        c.add(f"{n} abonnés / « J'aime » sur Facebook", _src_status(fb), pts, fb.src_label)
    if not c.evidence:
        c.add("Taille d'audience inconnue (aucune statistique publique disponible)", UNKNOWN, 0)
        c.missing.append("Nombre d'abonnés et de publications")
    return c


def _website(f: CompanyFacts) -> Criterion:
    c = Criterion("website", "Opportunité de création ou refonte de site Internet", 20)
    chk = f.website_check
    if f.website and LINK_HUBS.search(f.website):
        c.add(f"Le lien principal est une page de liens ({f.website}) et non un site propre", OBSERVED, 10, "Profil")
        return c
    if f.website and chk:
        if not chk.get("reachable"):
            c.add(f"Le site indiqué ({f.website}) ne répond pas ({chk.get('error', 'erreur')})", OBSERVED, 12, "Diagnostic du site")
        elif chk.get("issues"):
            for issue in chk["issues"]:
                c.add(f"Site : {issue}", OBSERVED, 6, "Diagnostic du site")
        else:
            c.add("Site existant sans défaut technique constaté : opportunité de refonte faible", OBSERVED, 2, "Diagnostic du site")
        return c
    if f.website:
        c.add(f"Site connu ({f.website}) mais non analysé", UNKNOWN, 0)
        c.missing.append("Diagnostic du site")
        return c
    api_profiles = [p for p in f.profiles if p.api_verified]
    if api_profiles and all(not p.website for p in api_profiles):
        c.add("Aucun site renseigné sur le profil vérifié par l'API — opportunité de création à confirmer", OBSERVED, 12, api_profiles[0].src_label)
    else:
        c.add("Aucun site identifié dans les informations disponibles (hypothèse : l'entreprise peut en avoir un)", HYPOTHESIS, 6, "Extraits indexés")
        c.missing.append("Existence d'un site Internet")
    return c


def _social(f: CompanyFacts) -> Criterion:
    c = Criterion("social_presence", "Qualité perfectible de la présence sociale", 15)
    lp = f.last_post()
    if lp:
        days, src = lp
        if days > 90:
            c.add(f"Dernière publication il y a {days} jours", src.status, 7, src.src_label)
        elif days > 30:
            c.add(f"Dernière publication il y a {days} jours", src.status, 3, src.src_label)
    for p in f.profiles:
        if p.api_verified and (not p.bio or len(p.bio.strip()) < 30):
            c.add(f"Description {'absente' if not p.bio else 'très courte'} sur {p.src_label}", VERIFIED, 5, p.src_label)
    if f.ig and f.ig.posts is not None and f.ig.posts < 30:
        c.add(f"Peu de contenus publiés ({f.ig.posts})", _src_status(f.ig), 4, f.ig.src_label)
    both_searched = {"instagram", "facebook"} <= set(f.searched_platforms or [])
    if both_searched and len({p.platform for p in f.profiles}) == 1:
        net = "Instagram" if f.profiles[0].platform == "instagram" else "Facebook"
        c.add(f"Présence identifiée uniquement sur {net} (l'autre réseau n'a pas été trouvé, il peut exister)", HYPOTHESIS, 3, "Recherche")
    if not c.evidence:
        c.add("Pas assez d'informations pour juger la présence sociale", UNKNOWN, 0)
        c.missing.append("Régularité des publications")
    return c


def _visual(f: CompanyFacts) -> Criterion:
    c = Criterion("visual_identity", "Opportunité en identité visuelle et graphisme", 15)
    text = " ".join(p.text() for p in f.profiles)
    m = NEW_BUSINESS.search(text)
    if m:
        c.add(f"Signal d'activité récente ou de lancement (« {m.group(1)} ») : besoins fréquents en logo, cartes, flyers", OBSERVED, 10, "Profil")
    if f.ig and f.fb and f.ig.display_name and f.fb.display_name and name_similarity(f.ig.display_name, f.fb.display_name) < 0.7:
        c.add("Nom présenté différemment sur Instagram et Facebook : identité à harmoniser", OBSERVED, 4, "Instagram + Facebook")
    for p in f.profiles:
        if p.display_name and not p.handle.isdigit() and name_similarity(p.display_name, p.handle) < 0.5:
            c.add(f"Identifiant @{p.handle} éloigné du nom commercial", OBSERVED, 3, p.src_label)
            break
    if (f.website_check or {}).get("free_host"):
        c.add("Site sans nom de domaine propre", OBSERVED, 3, "Diagnostic du site")
    act = f.activity()
    if act and act.relevance >= 13:
        c.add(f"Activité où l'image de marque compte particulièrement ({act.label}) — hypothèse non vérifiée visuellement", HYPOTHESIS, 4, "Référentiel")
    if not c.evidence:
        c.add("Identité visuelle non évaluable sans observation des visuels", UNKNOWN, 0)
        c.missing.append("Observation des visuels (logo, photos)")
    return c


def _relevance(f: CompanyFacts) -> Criterion:
    c = Criterion("services_fit", "Pertinence des services Signe & Seine pour l'activité", 15)
    act = f.activity()
    if act:
        c.add(act.relevance_reason, OBSERVED if f.search_activity or f.detected_activity() else HYPOTHESIS, act.relevance, f"Référentiel ({act.label})")
    else:
        c.add("Activité inconnue : pertinence non évaluable", UNKNOWN, 0)
        c.missing.append("Activité")
    return c


def _real_activity(f: CompanyFacts) -> Criterion:
    c = Criterion("real_activity", "Indices d'une activité commerciale réelle et actuelle", 10)
    text = " ".join(p.text() for p in f.profiles)
    closed = CLOSED.search(text)
    if closed:
        c.add(f"Mention « {closed.group(1)} » : l'entreprise semble fermée", CONTRADICTION, -10, "Profil")
        return c
    lp = f.last_post()
    if lp:
        days, src = lp
        pts = 10 if days <= 30 else 7 if days <= 90 else 3 if days <= 365 else 0
        c.add(f"Dernière publication il y a {days} jours", src.status, pts, src.src_label)
    else:
        for p in f.profiles:
            if (p.posts or 0) > 0 and (p.followers or 0) >= 50:
                c.add(f"Compte alimenté ({p.posts} publications, {p.followers} abonnés) — date de dernière publication inconnue", _src_status(p), 4, p.src_label)
                break
    if any((p.checkins or 0) > 0 for p in f.profiles):
        c.add("Établissement fréquenté (« personnes étaient ici »)", OBSERVED, 3, "Facebook")
    if f.website_check and f.website_check.get("reachable"):
        c.add("Site Internet en ligne", OBSERVED, 2, "Diagnostic du site")
    if not c.evidence:
        c.add("Aucun indice d'activité récente disponible", UNKNOWN, 0)
        c.missing.append("Date de dernière publication")
    return c


def is_closed(f: CompanyFacts) -> bool:
    return CLOSED.search(" ".join(p.text() for p in f.profiles)) is not None


def compute_commercial(f: CompanyFacts) -> dict[str, Any]:
    criteria = [_need(f), _website(f), _social(f), _visual(f), _relevance(f), _real_activity(f)]
    score = total(criteria)
    return {"score": score, "level": level(score, COMMERCIAL_LEVELS), "criteria": [cr.to_dict() for cr in criteria],
            "missing": [m for cr in criteria for m in cr.missing], "closed": is_closed(f), "method": "règles déterministes v1",
            "hypotheses": sum(1 for cr in criteria for e in cr.evidence if e.status == HYPOTHESIS and e.points > 0)}


__all__ = ["compute_commercial"]
