"""SCORE DE CONFIANCE (/100) : « Sommes-nous certains que ces profils correspondent réellement à cette entreprise ? »

Nom commercial 25 · Localisation 20 · Activité 20 · Description 10 · Liens croisés FB/IG 15 · Autres indices 10.
Une information inconnue ne rapporte rien ; une contradiction retire des points ; chaque point est justifié.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from ..referentials import MAJOR_CITIES, REGIONS, department_name, departments_of_region, detect_activity
from ..text import compact, contains_phrase, name_similarity, norm
from .common import CONFIDENCE_LEVELS, CONTRADICTION, HYPOTHESIS, OBSERVED, UNKNOWN, VERIFIED, Criterion, level, total
from .facts import POSTAL, CompanyFacts


def _name(f: CompanyFacts) -> Criterion:
    c = Criterion("name", "Correspondance du nom commercial", 25)
    named = [p for p in f.profiles if p.display_name]
    if not named:
        c.add("Aucun nom affiché disponible (seul l'identifiant est connu)", UNKNOWN, 0)
        c.missing.append("Nom affiché du profil")
        return c
    # 1. Concordance entre deux sources indépendantes (Facebook ↔ Instagram, profil ↔ site)
    if f.ig and f.fb and f.ig.display_name and f.fb.display_name:
        sim = name_similarity(f.ig.display_name, f.fb.display_name)
        st = VERIFIED if f.ig.api_verified or f.fb.api_verified else OBSERVED
        if sim >= 0.85:
            c.add(f"Même nom sur Instagram et Facebook (« {f.ig.display_name} » / « {f.fb.display_name} », similarité {sim:.0%})", st, 25, "Instagram + Facebook")
        elif sim >= 0.6:
            c.add(f"Noms proches sur Instagram et Facebook (similarité {sim:.0%})", st, 15, "Instagram + Facebook")
        elif sim < 0.4:
            c.add(f"Noms différents sur Instagram et Facebook (« {f.ig.display_name} » / « {f.fb.display_name} »)", CONTRADICTION, -10, "Instagram + Facebook")
    site_title = (f.website_check or {}).get("title")
    if site_title:
        best = max(name_similarity(p.display_name, site_title) for p in named)
        if best >= 0.75:
            c.add(f"Le nom figure dans le titre du site ({site_title[:60]})", OBSERVED, 20, "Site Internet")
    # 2. Une seule source : concordance nom affiché ↔ identifiant
    for p in named:
        sim = name_similarity(p.display_name, p.handle) if not p.handle.isdigit() else 0
        if sim >= 0.8:
            c.add(f"Nom « {p.display_name} » cohérent avec l'identifiant @{p.handle}", p.status, 15, p.src_label)
        elif sim >= 0.5:
            c.add(f"Nom « {p.display_name} » partiellement cohérent avec l'identifiant @{p.handle}", p.status, 8, p.src_label)
        elif not p.handle.isdigit():
            c.add(f"Identifiant @{p.handle} sans rapport évident avec le nom « {p.display_name} »", HYPOTHESIS, 3, p.src_label)
        else:
            c.add(f"Nom affiché « {p.display_name} » (identifiant numérique)", p.status, 5, p.src_label)
    return c


def _location(f: CompanyFacts) -> Criterion:
    c = Criterion("location", "Correspondance de la localisation", 20)
    if not (f.target_city or f.target_department or f.target_region):
        c.add("Aucune localisation cible définie pour la recherche", UNKNOWN, 0)
        return c
    corpus = f.corpus()
    raw = " ".join(p.text() for p in f.profiles)
    api_loc = " ".join(p.location or "" for p in f.profiles if p.api_verified and p.location)
    dep = f.target_department
    found = False
    if f.target_city and contains_phrase(corpus, f.target_city):
        st = VERIFIED if api_loc and contains_phrase(norm(api_loc), f.target_city) else OBSERVED
        c.add(f"La ville « {f.target_city} » apparaît dans le profil", st, 20, "Profil")
        found = True
    target_deps: set[str] = set()
    if dep:
        target_deps.add(dep)
    if f.target_region:
        target_deps.update(departments_of_region(f.target_region))
    if not found:
        for d in sorted(target_deps):
            name = department_name(d)
            postal_hit = any(pc.startswith(d) for pc in POSTAL.findall(raw)) if d.isdigit() else False
            if (name and contains_phrase(corpus, name)) or postal_hit or f"({d})" in raw:
                pts = 20 if not f.target_city else 12
                c.add(f"Le département {name} ({d}) est mentionné", OBSERVED, pts, "Profil")
                found = True
                break
    if not found and f.target_region:
        rname = REGIONS.get(f.target_region)
        if rname and contains_phrase(corpus, rname):
            c.add(f"La région {rname} est mentionnée", OBSERVED, 8 if (f.target_city or dep) else 20, "Profil")
            found = True
    # Contradictions : autre grande ville hors zone, code postal d'un autre département
    if not found:
        allowed = target_deps or set()
        for city, cdep in MAJOR_CITIES.items():
            if cdep not in allowed and contains_phrase(corpus, city) and norm(city) != norm(f.target_city):
                c.add(f"Le profil mentionne « {city} », hors de la zone recherchée", CONTRADICTION, -10, "Profil")
                break
        else:
            other = [pc for pc in POSTAL.findall(raw) if allowed and not any(pc.startswith(d) for d in allowed if d.isdigit())]
            if other:
                c.add(f"Code postal {other[0]} hors de la zone recherchée", CONTRADICTION, -10, "Profil")
            else:
                c.add("Aucune mention de la localisation dans les informations disponibles", UNKNOWN, 0)
                c.missing.append("Ville ou adresse sur le profil")
    return c


def _activity(f: CompanyFacts) -> Criterion:
    c = Criterion("activity", "Correspondance de l'activité", 20)
    act = f.search_activity
    if not act:
        det = f.detected_activity()
        if det:
            c.add(f"Activité reconnue : {det.label} (aucune activité cible imposée)", OBSERVED, 15, "Profil")
        else:
            c.add("Activité non identifiable dans les informations disponibles", UNKNOWN, 0)
            c.missing.append("Activité")
        return c
    texts = [(p, norm(" ".join(x for x in (p.display_name, p.bio, p.category, p.snippet) if x))) for p in f.profiles]
    for p, t in texts:
        hit = next((s for s in act.synonyms if contains_phrase(t, s)), None)
        if hit:
            st = VERIFIED if p.api_verified and (p.category or p.bio) else p.status
            c.add(f"« {hit} » figure dans le nom, la description ou la catégorie", st, 20, p.src_label)
            return c
    for p, _ in texts:
        handle = compact(p.handle)
        hit = next((s for s in act.synonyms if len(compact(s)) >= 4 and compact(s) in handle), None)
        if hit:
            c.add(f"« {hit} » figure dans l'identifiant @{p.handle}", OBSERVED, 12, p.src_label)
            return c
    other = detect_activity(" ".join(p.text() for p in f.profiles))
    if other and other.key != act.key:
        c.add(f"Le profil évoque une autre activité ({other.label}) que celle recherchée ({act.label})", CONTRADICTION, -10, "Profil")
    else:
        c.add(f"Activité « {act.label} » non confirmée par le profil (seul le moteur de recherche l'a associé)", UNKNOWN, 0)
        c.missing.append("Description de l'activité")
    return c


BUSINESS_HINTS = ("horaires", "ouvert", "réservation", "reservation", "devis", "commande", "livraison", "rdv", "rendez vous",
                  "adresse", "tel", "téléphone", "contact", "depuis", "artisan", "boutique", "salon", "atelier", "services", "click and collect")


def _description(f: CompanyFacts) -> Criterion:
    c = Criterion("description", "Cohérence de la description", 10)
    bios = [(p, p.bio) for p in f.profiles if p.bio and len(p.bio.strip()) >= 15]
    if not bios:
        c.add("Aucune description publique disponible", UNKNOWN, 0)
        c.missing.append("Description (bio) du profil")
        return c
    p, bio = max(bios, key=lambda x: len(x[1] or ""))
    t = norm(bio)
    act = f.activity()
    mentions_act = bool(act and any(contains_phrase(t, s) for s in act.synonyms))
    mentions_loc = bool(f.target_city and contains_phrase(t, f.target_city))
    pro = [h for h in BUSINESS_HINTS if contains_phrase(t, h)]
    if mentions_act or mentions_loc:
        c.add("La description présente l'activité ou la ville de façon cohérente", p.status, 10, p.src_label)
    elif pro:
        c.add(f"Description à caractère professionnel ({', '.join(pro[:3])})", p.status, 7, p.src_label)
    else:
        c.add("Description présente mais peu informative", p.status, 4, p.src_label)
    return c


def _cross_links(f: CompanyFacts) -> Criterion:
    c = Criterion("cross_links", "Liens croisés Facebook / Instagram", 15)
    ig, fb = f.ig, f.fb
    if not (ig and fb):
        site_links = (f.website_check or {}).get("social_links") or []
        c.add("Un seul réseau identifié : pas de lien croisé possible" if not site_links else "Un seul réseau identifié", UNKNOWN, 0)
        return c
    api_ig = ((fb.api_data or {}).get("instagram_business_account") or {}).get("username")
    if api_ig and api_ig.lower() == ig.handle:
        c.add(f"La page Facebook déclare le compte Instagram @{ig.handle} (API officielle)", VERIFIED, 15, "Facebook (API officielle)")
        return c
    if ig.handle in [h.lower() for h in fb.mentioned_handles]:
        c.add(f"La page Facebook mentionne @{ig.handle}", OBSERVED, 15, fb.src_label)
        return c
    fb_refs = {fb.handle, compact(fb.display_name)}
    if any(h.lower() in fb_refs for h in ig.mentioned_handles if h.lower() != ig.handle) or (ig.bio and "facebook.com/" + fb.handle in (ig.bio or "").lower()):
        c.add("Le profil Instagram renvoie vers la page Facebook", OBSERVED, 15, ig.src_label)
        return c
    site_links = [s.lower() for s in (f.website_check or {}).get("social_links") or []]
    if any(f"instagram.com/{ig.handle}" in s for s in site_links) and any(fb.handle in s for s in site_links):
        c.add("Le site de l'entreprise renvoie vers les deux profils", OBSERVED, 15, "Site Internet")
        return c
    if compact(ig.handle) == compact(fb.handle):
        c.add(f"Même identifiant sur les deux réseaux (@{ig.handle}) — indice, pas une preuve", HYPOTHESIS, 6, "Instagram + Facebook")
    else:
        c.add("Aucun lien explicite entre la page Facebook et le compte Instagram", UNKNOWN, 0)
        c.missing.append("Lien entre la page Facebook et le compte Instagram")
    return c


def _domain_matches(website: str | None, names: list[str]) -> bool:
    if not website:
        return False
    host = (urlparse(website if "://" in website else "https://" + website).hostname or "").replace("www.", "")
    flat = compact(host.rsplit(".", 1)[0])
    return any(name_similarity(n, flat) >= 0.75 for n in names if n)


def _other(f: CompanyFacts) -> Criterion:
    c = Criterion("other", "Autres indices publics concordants", 10)
    if any(p.api_verified for p in f.profiles):
        c.add("Profil confirmé par l'API officielle Meta (compte professionnel existant)", VERIFIED, 4, "API Meta")
    names = [p.display_name or "" for p in f.profiles] + [p.handle for p in f.profiles if not p.handle.isdigit()]
    if _domain_matches(f.website, names):
        c.add(f"Le nom de domaine du site ({f.website}) correspond au nom", OBSERVED, 3, "Site Internet")
    site_links = [s.lower() for s in (f.website_check or {}).get("social_links") or []]
    if any(p.handle in s for p in f.profiles for s in site_links if not p.handle.isdigit()):
        c.add("Le site de l'entreprise renvoie vers son profil social", OBSERVED, 4, "Site Internet")
    if any((p.checkins or 0) > 0 for p in f.profiles):
        c.add("Lieu physique fréquenté (« personnes étaient ici » sur Facebook)", OBSERVED, 2, "Facebook (extrait indexé)")
    if any(p.source in ("assisted", "manual") for p in f.profiles):
        c.add("Profil sélectionné manuellement lors d'une recherche assistée", VERIFIED, 2, "Utilisateur")
    if not c.evidence:
        c.add("Aucun autre indice concordant disponible", UNKNOWN, 0)
    return c


def compute_confidence(f: CompanyFacts) -> dict[str, Any]:
    criteria = [_name(f), _location(f), _activity(f), _description(f), _cross_links(f), _other(f)]
    score = total(criteria)
    sources = sorted({e.source for cr in criteria for e in cr.evidence if e.source})
    return {"score": score, "level": level(score, CONFIDENCE_LEVELS),
            "criteria": [cr.to_dict() for cr in criteria], "sources": sources,
            "missing": [m for cr in criteria for m in cr.missing], "method": "règles déterministes v1"}


__all__ = ["compute_confidence"]
