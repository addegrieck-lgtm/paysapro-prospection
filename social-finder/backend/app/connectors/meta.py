"""API officielles Meta (Graph API) — uniquement avec VOS accès et permissions.

Ce que ces API permettent réellement :
* Instagram « Business Discovery » : lire les informations publiques d'un compte Instagram professionnel
  (nom, bio, site, abonnés, nombre de publications, dates des dernières publications) À PARTIR DE SON
  IDENTIFIANT. Nécessite votre propre compte Instagram professionnel relié à une page Facebook et les
  permissions instagram_basic + pages_read_engagement (+ business_management selon la configuration).
* Pages Facebook : lire les champs publics d'une page À PARTIR DE SON IDENTIFIANT nécessite la fonctionnalité
  « Page Public Metadata Access » (validation de l'application par Meta).

Ce qu'elles ne permettent PAS : lister tous les professionnels d'une ville, rechercher librement des comptes
Instagram, envoyer des messages à des personnes qui ne vous ont pas écrit (fenêtre de 24 h).
"""
from __future__ import annotations

from typing import Any

import httpx

from .. import settings_store
from .base import ConnectorError, ConnectorStatus, check_quota, record_usage, usage_today
from .http import client, throttle

GRAPH = "https://graph.facebook.com"
NEEDED_IG = ["instagram_basic", "pages_show_list", "pages_read_engagement"]
OPTIONAL = ["business_management", "instagram_manage_messages", "pages_messaging"]


class MetaConnector:
    id = "meta"
    label = "API officielles Meta (Facebook & Instagram)"

    def _cfg(self) -> dict[str, Any]:
        s = settings_store.get_all()
        return {"token": s["meta_access_token"], "ig_user_id": s["meta_ig_user_id"], "version": s["meta_graph_version"] or "v21.0",
                "limit": int(s["meta_daily_limit"] or 0)}

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        cfg = self._cfg()
        if not cfg["token"]:
            raise ConnectorError("not_configured", "Jeton d'accès Meta absent")
        check_quota(self.id, cfg["limit"])
        throttle(self.id, 0.4)
        with client() as c:
            try:
                res = c.get(f"{GRAPH}/{cfg['version']}/{path}", params={**params, "access_token": cfg["token"]})
            except httpx.HTTPError as e:
                raise ConnectorError("unavailable", f"Graph API injoignable : {e}") from e
        record_usage(self.id)
        data = res.json() if res.content else {}
        if res.status_code != 200 or "error" in data:
            err = data.get("error", {})
            code = err.get("code")
            msg = err.get("message", f"HTTP {res.status_code}")
            if code in (4, 17, 32, 613):
                raise ConnectorError("quota", f"Meta : limite de requêtes atteinte ({msg})")
            if code in (190, 102):
                raise ConnectorError("auth", f"Meta : jeton invalide ou expiré ({msg})")
            if code in (10, 200, 100) or res.status_code == 403:
                raise ConnectorError("forbidden", f"Meta : permission manquante ou ressource inaccessible ({msg})")
            raise ConnectorError("unavailable", f"Meta : {msg}")
        return data

    # --- Statut et permissions -------------------------------------------------------------------------------
    def permissions(self) -> tuple[list[str], list[str]]:
        data = self._get("me/permissions", {})
        granted = [p["permission"] for p in data.get("data", []) if p.get("status") == "granted"]
        declined = [p["permission"] for p in data.get("data", []) if p.get("status") != "granted"]
        return granted, declined

    def detect_ig_user_id(self) -> str | None:
        data = self._get("me/accounts", {"fields": "name,instagram_business_account"})
        for page in data.get("data", []):
            iba = page.get("instagram_business_account")
            if iba and iba.get("id"):
                return str(iba["id"])
        return None

    def ig_ready(self) -> bool:
        cfg = self._cfg()
        return bool(cfg["token"] and cfg["ig_user_id"])

    def fb_ready(self) -> bool:
        return bool(self._cfg()["token"])

    # --- Lecture de profils ---------------------------------------------------------------------------------
    def instagram_business_discovery(self, username: str) -> dict[str, Any]:
        cfg = self._cfg()
        if not cfg["ig_user_id"]:
            raise ConnectorError("not_configured", "Identifiant de votre compte Instagram professionnel absent")
        fields = ("business_discovery.username({u}){{id,username,name,biography,website,followers_count,follows_count,"
                  "media_count,media.limit(5){{timestamp}}}}").format(u=username)
        data = self._get(cfg["ig_user_id"], {"fields": fields})
        return data.get("business_discovery") or {}

    def facebook_page(self, page_ref: str) -> dict[str, Any]:
        return self._get(page_ref, {"fields": "id,name,about,category,link,website,location,fan_count,followers_count,instagram_business_account{username}"})

    def status(self) -> ConnectorStatus:
        cfg = self._cfg()
        base = dict(
            id=self.id, label=self.label, kind="meta", used_today=usage_today(self.id), daily_limit=cfg["limit"],
            free_tier="Gratuit (Graph API). Nécessite une application Meta for Developers et vos propres comptes professionnels.",
            limits=[
                "Les API Meta NE permettent PAS de lister tous les professionnels d'une ville : la découverte passe par les moteurs de recherche.",
                "Instagram Business Discovery : uniquement les comptes professionnels (Business/Créateur), consultés par leur identifiant.",
                "Pages Facebook : lecture des pages tierces soumise à la fonctionnalité « Page Public Metadata Access » (validation Meta).",
                "Messagerie : impossible d'envoyer un premier message à une entreprise qui ne vous a pas écrit (fenêtre de 24 h). L'envoi reste manuel.",
                "Limites de débit Meta (environ 200 appels/heure par utilisateur) : le logiciel ralentit automatiquement.",
            ],
            setup_steps=[
                "Convertissez votre compte Instagram en compte professionnel et reliez-le à la page Facebook de Signe & Seine.",
                "Créez une application sur https://developers.facebook.com/ (type « Entreprise »).",
                "Ajoutez les produits « Instagram Graph API » et « Facebook Login for Business ».",
                "Dans l'Explorateur de l'API Graph, générez un jeton utilisateur avec : instagram_basic, pages_show_list, pages_read_engagement (et business_management si demandé).",
                "Transformez-le en jeton longue durée (60 jours) via l'outil « Access Token Debugger ».",
                "Collez le jeton dans Sources & connecteurs → Meta, puis « Détecter mon compte Instagram ».",
                "Facultatif : demandez « Page Public Metadata Access » (App Review) pour lire les pages Facebook tierces.",
            ],
            features=[
                "Vérification d'un compte Instagram professionnel découvert : nom, bio, site, abonnés, publications, dernière publication (données marquées « vérifiées »).",
                "Lecture d'une page Facebook (si la fonctionnalité est accordée) : catégorie, ville, site, compte Instagram lié.",
            ],
            docs_url="https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery",
        )
        if not cfg["token"]:
            return ConnectorStatus(configured=False, enabled=False, state="not_configured", message="Jeton d'accès Meta non renseigné",
                                   permissions_missing=NEEDED_IG, **base)
        try:
            granted, _ = self.permissions()
        except ConnectorError as e:
            return ConnectorStatus(configured=True, enabled=False, state="error", message=e.message, **base)
        missing = [p for p in NEEDED_IG if p not in granted]
        ig_ok = not missing and bool(cfg["ig_user_id"])
        msg = "Business Discovery Instagram actif" if ig_ok else (
            "Permissions manquantes : " + ", ".join(missing) if missing else "Identifiant du compte Instagram professionnel à détecter")
        return ConnectorStatus(configured=True, enabled=ig_ok, state="ok" if ig_ok else "error", message=msg,
                               permissions_granted=granted, permissions_missing=missing + [p for p in OPTIONAL if p not in granted and p == "business_management"],
                               details={"ig_user_id": cfg["ig_user_id"]}, **base)


meta = MetaConnector()
