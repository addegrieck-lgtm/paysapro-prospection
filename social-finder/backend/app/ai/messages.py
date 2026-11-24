"""AI MESSAGE STUDIO : messages courts et personnalisés pour Instagram DM et Facebook Messenger.

Mode par défaut : modèles + fragments variés (gratuit, hors ligne, reproductible). Mode IA facultatif.
Règle commune : ne citer que des éléments réellement observés ; une hypothèse est formulée comme une question.
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from .. import settings_store
from ..referentials import resolve_activity
from .providers import AIError, complete

STYLES = {"professional": "Professionnel", "friendly": "Naturel et convivial", "direct": "Commercial direct mais respectueux"}
CHANNELS = {"instagram_dm": "Instagram DM", "messenger": "Facebook Messenger"}

ACTIVITY_PHRASE = {
    "restaurant": "votre restaurant", "bar": "votre établissement", "boulangerie": "votre boulangerie", "boucherie": "votre commerce",
    "coiffeur": "votre salon", "esthetique": "votre institut", "fleuriste": "votre boutique", "boutique": "votre boutique",
    "garage": "votre garage", "paysagiste": "votre activité de paysagiste", "btp": "votre entreprise", "immobilier": "votre agence",
    "sport": "votre activité", "hotel": "votre établissement", "photographe": "votre travail", "sante": "votre cabinet", "services": "votre activité",
}
SERVICE_PITCH = {
    "site_creation": "un site Internet simple et efficace, qui présente votre activité et facilite la prise de contact",
    "site_redesign": "une version plus moderne de votre site, agréable à consulter sur téléphone",
    "flyers": "des flyers et supports imprimés à votre image",
    "business_cards": "des cartes de visite soignées",
    "logo": "un logo et une identité visuelle cohérents",
    "visual_communication": "des visuels cohérents pour vos réseaux et vos supports",
    "storefront": "l'habillage de votre vitrine",
    "signage": "une signalétique qui attire l'œil",
    "advertising": "des supports publicitaires pour vous faire connaître localement",
}

SYSTEM_PROMPT = """Tu rédiges des messages de prospection B2B en français pour l'agence Signe & Seine (création de sites Internet,
communication visuelle, logos, flyers, cartes de visite, vitrines, signalétique) destinés à être envoyés MANUELLEMENT
en message privé Instagram ou Facebook Messenger à une entreprise locale.
Règles impératives :
- Message court : 50 à 90 mots, sans objet, sans liste à puces, sans majuscules agressives.
- Naturel, professionnel, jamais insistant ; pas de promesse de résultat (clients, chiffre d'affaires, classement Google).
- N'utilise QUE les faits fournis. Les éléments marqués "hypothese" ne doivent JAMAIS être présentés comme des faits :
  formule-les comme une question ou ne les cite pas.
- Ne prétends pas avoir analysé ce qui n'est pas dans les faits (pas de "j'ai étudié vos publications" si non fourni).
- Termine par une question ouverte simple et la signature fournie.
- Réponds uniquement avec le texte du message."""


def in_city(city: str | None) -> str:
    """« Le Havre » → « au Havre », « Les Andelys » → « aux Andelys », « Rouen » → « à Rouen »."""
    if not city:
        return ""
    c = city.strip()
    low = c.lower()
    if low.startswith("le "):
        return f" au {c[3:]}"
    if low.startswith("les "):
        return f" aux {c[4:]}"
    return f" à {c}"


def elide(text: str) -> str:
    """« que un » → « qu'un », « de un » → « d'un » (élisions françaises)."""
    return re.sub(r"\b(qu|d)e ([aeiouéèêàâîôû])", r"\1'\2", text)


def _pick(options: list[str], seed: str, variant: int) -> str:
    h = int(hashlib.sha256(f"{seed}:{variant}".encode()).hexdigest(), 16)
    return options[h % len(options)]


def build_context(company: dict[str, Any], profiles: list[dict[str, Any]], channel: str) -> dict[str, Any]:
    act = resolve_activity(company["activity_key"]) if company.get("activity_key") else None
    analysis = company.get("analysis") or {}
    commercial = company.get("commercial_detail") or {}
    observations: list[dict[str, str]] = []
    for crit in commercial.get("criteria", []):
        for e in crit.get("evidence", []):
            if e["points"] > 0 and crit["key"] in ("website", "visual_identity") and e["status"] in ("observed", "verified", "hypothesis"):
                observations.append({"fait": e["text"], "statut": "hypothese" if e["status"] == "hypothesis" else "constate"})
    services = [s["key"] for s in analysis.get("services", [])]
    s = settings_store.get_all()
    return {
        "entreprise": company["name"], "activite": act.label if act else None, "activity_key": act.key if act else None,
        "ville": company.get("city"), "canal": CHANNELS.get(channel, channel),
        "reseau": "Instagram" if channel == "instagram_dm" else "Facebook",
        "observations": observations[:3], "services_recommandes": services[:2],
        "presentation_agence": s["agency_pitch"], "signature": s["sender_signature"] or (f"{s['sender_name']} — {s['agency_name']}" if s["sender_name"] else s["agency_name"]),
    }


def _observation_sentence(ctx: dict[str, Any], seed: str, variant: int) -> str:
    for o in ctx["observations"]:
        f = o["fait"]
        if o["statut"] == "constate":
            if "téléphone" in f:
                return "En consultant votre site, j'ai remarqué qu'il n'est pas vraiment adapté à l'affichage sur téléphone."
            if "HTTPS" in f:
                return "En consultant votre site, j'ai remarqué qu'il n'est pas encore sécurisé (HTTPS), ce que certains navigateurs signalent aux visiteurs."
            if "copyright" in f:
                return "En consultant votre site, j'ai eu l'impression qu'il n'avait pas été mis à jour depuis un moment."
            if "page de liens" in f:
                return "J'ai vu que vos liens passent par une page de liens plutôt que par un site à votre nom."
            if "ne répond pas" in f:
                return "J'ai essayé d'ouvrir le site indiqué sur votre profil, mais il ne s'affiche pas actuellement."
            if "lancement" in f:
                return _pick(["Il semble que vous lanciez ou renouveliez votre activité : félicitations !",
                              "J'ai vu que votre activité est en pleine nouveauté, bravo pour ce lancement !"], seed, variant)
            if "Aucun site renseigné" in f:
                return "Je n'ai pas vu de site Internet indiqué sur votre profil."
        elif "Aucun site" in f:
            return _pick(["Je n'ai pas trouvé de site Internet à votre nom — peut-être en avez-vous déjà un ?",
                          "Je ne suis pas certain que vous ayez un site Internet : est-ce un projet pour vous ?"], seed, variant)
    return ""


def render_template(ctx: dict[str, Any], style: str, channel: str, variant: int = 0) -> str:
    seed = f"{ctx['entreprise']}|{style}|{channel}"
    what = ACTIVITY_PHRASE.get(ctx.get("activity_key") or "", "votre activité")
    where = in_city(ctx.get("ville"))
    net = ctx["reseau"]
    page = "votre compte Instagram" if net == "Instagram" else "votre page Facebook"
    services = ctx["services_recommandes"] or ["visual_communication"]
    pitch = SERVICE_PITCH.get(services[0], SERVICE_PITCH["visual_communication"])
    obs = _observation_sentence(ctx, seed, variant)
    sig = ctx["signature"]
    if style == "friendly":
        hello = _pick(["Bonjour 😊", "Bonjour !", "Hello, bonjour !"], seed, variant)
        hook = _pick([f"Je suis tombé sur {page} et j'ai bien aimé découvrir {what}{where}.",
                      f"En parcourant {net}, je suis tombé sur {what}{where}, et ça m'a donné envie de vous écrire.",
                      f"J'ai découvert {what}{where} via {page}, c'est sympa de voir des entreprises locales comme la vôtre."], seed, variant)
        offer = _pick([f"Je m'occupe de communication pour les entreprises du coin, et je me disais que {pitch} pourrait vous être utile.",
                       f"Je travaille avec des entreprises locales sur leur communication ; {pitch}, ça pourrait vous parler ?"], seed, variant)
        question = _pick(["Ça vous dirait qu'on en discute quelques minutes, sans engagement ?", "Est-ce que ce serait un sujet pour vous en ce moment ?"], seed, variant)
    elif style == "direct":
        hello = "Bonjour,"
        hook = _pick([f"Je me permets de vous contacter après avoir découvert {what}{where} sur {net}.",
                      f"Je vous écris directement après avoir vu {page}."], seed, variant)
        offer = _pick([f"{ctx['presentation_agence']} Je peux vous proposer {pitch}, avec un devis clair et rapide.",
                       f"Je vous propose {pitch} : c'est notre spécialité chez Signe & Seine, pour les entreprises locales."], seed, variant)
        question = _pick(["Seriez-vous disponible pour un court échange cette semaine ?", "Puis-je vous envoyer quelques exemples et une estimation ?"], seed, variant)
    else:
        hello = "Bonjour,"
        hook = _pick([f"J'ai découvert {what}{where} en consultant {page}.",
                      f"Je suis tombé sur {page} et j'ai découvert {what}{where}."], seed, variant)
        offer = _pick([f"{ctx['presentation_agence']} Je pense que {pitch} pourrait être intéressant pour vous.",
                       f"{ctx['presentation_agence']} Il y aurait peut-être des possibilités intéressantes, par exemple {pitch}."], seed, variant)
        question = _pick(["Est-ce que cela pourrait vous intéresser d'en discuter ?", "Seriez-vous ouvert à un premier échange, sans engagement ?"], seed, variant)
    parts = [hello, " ".join(x for x in (hook, obs) if x), offer, question, sig]
    return elide("\n\n".join(p.strip() for p in parts if p and p.strip()))


def apply_custom_template(body: str, ctx: dict[str, Any]) -> str:
    services = ctx["services_recommandes"] or ["visual_communication"]
    values = {"entreprise": ctx["entreprise"], "activite": (ctx.get("activite") or "votre activité").lower(), "ville": ctx.get("ville") or "",
              "reseau": ctx["reseau"], "observation": _observation_sentence(ctx, ctx["entreprise"], 0),
              "proposition": SERVICE_PITCH.get(services[0], ""), "presentation": ctx["presentation_agence"], "signature": ctx["signature"]}
    out = re.sub(r"\{(\w+)\}", lambda m: values.get(m.group(1), m.group(0)), body)
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", out)).strip()


def generate(company: dict[str, Any], profiles: list[dict[str, Any]], channel: str, style: str, variant: int = 0,
             custom_template: str | None = None) -> dict[str, Any]:
    ctx = build_context(company, profiles, channel)
    if custom_template:
        return {"body": apply_custom_template(custom_template, ctx), "provider": "templates", "note": "Modèle personnalisé"}
    provider = settings_store.get("ai_provider")
    if provider != "templates":
        facts = {k: v for k, v in ctx.items() if k not in ("activity_key",) and v}
        facts["services_recommandes"] = [SERVICE_PITCH.get(s, s) for s in ctx["services_recommandes"]]
        user = (f"Style : {STYLES.get(style, style)}. Canal : {ctx['canal']}. Variante n°{variant + 1}.\n"
                f"Faits (JSON) : {json.dumps(facts, ensure_ascii=False)}")
        try:
            text, used = complete(SYSTEM_PROMPT, user)
            text = text.strip().strip('"')
            if len(text) > 40:
                return {"body": text, "provider": used, "note": "Rédigé par l'IA à partir des seuls faits fournis — relisez avant envoi"}
        except AIError as e:
            return {"body": render_template(ctx, style, channel, variant), "provider": "templates",
                    "note": f"IA indisponible ({e}) : message rédigé à partir des modèles"}
    return {"body": render_template(ctx, style, channel, variant), "provider": "templates", "note": "Rédigé à partir des modèles (hors ligne)"}
