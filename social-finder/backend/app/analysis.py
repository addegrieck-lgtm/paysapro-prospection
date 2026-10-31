"""Opportunity Analysis : synthèse commerciale à partir des deux scores et des faits observés.

Entièrement déterministe (reproductible). Une IA facultative peut reformuler la synthèse, jamais les scores.
"""
from __future__ import annotations

from typing import Any

from .referentials import SERVICES
from .scoring.common import HYPOTHESIS, OBSERVED, VERIFIED
from .scoring.facts import CompanyFacts


def analyze(f: CompanyFacts, confidence: dict[str, Any], commercial: dict[str, Any], city: str | None = None) -> dict[str, Any]:
    act = f.activity()
    crit = {c["key"]: c for c in commercial["criteria"]}
    opportunities: list[dict[str, str]] = []
    services: list[str] = []

    def opp(text: str, status: str, service: str | None = None) -> None:
        opportunities.append({"text": text, "status": status})
        if service and service not in services:
            services.append(service)

    web = crit["website"]
    for e in web["evidence"]:
        if e["points"] <= 0:
            continue
        if "page de liens" in e["text"]:
            opp("Présence centralisée sur une page de liens : un site propre pourrait regrouper offre, contact et réservation.", e["status"], "site_creation")
        elif e["text"].startswith("Site :") or "ne répond pas" in e["text"]:
            opp(f"Site existant à moderniser ({e['text'].removeprefix('Site : ')}).", e["status"], "site_redesign")
        elif "Aucun site" in e["text"]:
            label = "Aucun site renseigné sur le profil vérifié" if e["status"] == OBSERVED else "Aucun site identifié dans les informations disponibles (à vérifier)"
            opp(f"{label} : opportunité potentielle de site vitrine.", e["status"], "site_creation")
    for e in crit["visual_identity"]["evidence"]:
        if e["points"] <= 0:
            continue
        if "lancement" in e["text"]:
            opp("Activité récente ou en lancement : logo, cartes de visite et flyers sont souvent prioritaires.", e["status"], "logo")
            for s in ("business_cards", "flyers"):
                if s not in services:
                    services.append(s)
        elif "harmoniser" in e["text"] or "éloigné" in e["text"]:
            opp("Présentation du nom et de l'identité perfectible entre les supports.", e["status"], "visual_communication")
    social = crit["social_presence"]
    if social["points"] >= 7:
        opp("Présence sociale perfectible (publications rares ou description limitée) : supports visuels réutilisables.", social["status"], "visual_communication")
    need = crit["communication_need"]
    if need["points"] >= 12:
        opp("Audience encore modeste : des supports de communication locaux peuvent renforcer la visibilité.", need["status"], "advertising")
    if act:
        for s in act.services:
            if s not in services and len(services) < 4:
                services.append(s)
    services = services[:4]

    closed = commercial.get("closed")
    conf, com = confidence["score"], commercial["score"]
    if closed:
        prio = {"key": "excluded", "label": "Ne pas contacter (entreprise apparemment fermée)"}
    elif conf < 50:
        prio = {"key": "verify", "label": "Vérifier l'identité avant tout contact"}
    elif conf >= 75 and com >= 70:
        prio = {"key": "high", "label": "Priorité élevée"}
    elif com >= 50:
        prio = {"key": "medium", "label": "Priorité moyenne"}
    else:
        prio = {"key": "low", "label": "Priorité basse"}

    observed = [o for o in opportunities if o["status"] in (OBSERVED, VERIFIED)]
    hypo = [o for o in opportunities if o["status"] == HYPOTHESIS]
    who = f"{f.name}" + (f" ({act.label.lower()}" + (f", {city})" if city else ")") if act else "")
    nets = " et ".join(sorted({"Instagram" if p.platform == "instagram" else "Facebook" for p in f.profiles}))
    summary = (f"{who} : présence identifiée sur {nets}. Identification « {confidence['level']['label']} » ({conf}/100), "
               f"« {commercial['level']['label']} » commercial ({com}/100). ")
    if observed:
        summary += f"{len(observed)} opportunité(s) constatée(s)"
        summary += f" et {len(hypo)} hypothèse(s) à vérifier." if hypo else "."
    elif hypo:
        summary += f"Aucune opportunité constatée ; {len(hypo)} hypothèse(s) à vérifier."
    else:
        summary += "Aucune opportunité nette dans les informations disponibles."

    main = observed[0] if observed else (hypo[0] if hypo else None)
    recommendation = (f"Proposer : {', '.join(SERVICES[s].lower() for s in services[:2])}." if services else "Pas de recommandation tant que les informations manquent.")
    if prio["key"] in ("verify", "excluded"):
        recommendation = prio["label"] + "."
    justification = "; ".join(f"{c['label']} : {c['points']}/{c['max']}" for c in commercial["criteria"])
    return {
        "summary": summary,
        "main_opportunity": main,
        "opportunities": opportunities,
        "services": [{"key": s, "label": SERVICES[s]} for s in services],
        "recommendation": recommendation,
        "justification": justification,
        "priority": prio,
        "missing": sorted(set(confidence.get("missing", []) + commercial.get("missing", []))),
        "method": "règles déterministes v1",
    }
