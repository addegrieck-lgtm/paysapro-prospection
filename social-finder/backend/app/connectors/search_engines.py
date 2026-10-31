"""Moteurs de recherche autorisés (API officielles). Aucune page de résultats n'est « scrapée ».

* Brave Search API — API officielle, offre gratuite limitée, opérateur site: pris en charge.
* Google Programmable Search (Custom Search JSON API) — API officielle, 100 requêtes/jour gratuites.
* Relais Paysapro — le relais Cloudflare déjà utilisé par l'application de prospection (route /search,
  qui appelle Brave Search avec la clé stockée sur le relais).
"""
from __future__ import annotations

import httpx

from .. import settings_store
from ..logs import log
from .base import ConnectorError, ConnectorStatus, SearchResult, check_quota, record_usage, usage_today
from .http import client, throttle


def _strip(s: str | None) -> str:
    import re
    return re.sub(r"<[^>]+>", "", s or "").replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"').strip()


def _http_error(provider: str, res: httpx.Response) -> ConnectorError:
    if res.status_code == 429:
        return ConnectorError("quota", f"{provider} : quota atteint (HTTP 429)")
    if res.status_code in (401, 403):
        return ConnectorError("auth", f"{provider} : clé refusée ou accès non autorisé (HTTP {res.status_code})")
    return ConnectorError("unavailable", f"{provider} : service indisponible (HTTP {res.status_code})")


class BraveConnector:
    id = "brave"
    label = "Brave Search API"
    max_offset_pages = 5

    def _cfg(self):
        s = settings_store.get_all()
        return s["brave_api_key"], s["brave_enabled"], int(s["brave_daily_limit"] or 0)

    def is_ready(self) -> bool:
        key, enabled, _ = self._cfg()
        return bool(key) and bool(enabled)

    def search(self, query: str, page: int = 0) -> list[SearchResult]:
        key, _, limit = self._cfg()
        if not key:
            raise ConnectorError("not_configured", "Brave Search : clé d'API absente")
        check_quota(self.id, limit)
        throttle(self.id, 1.1)  # offre gratuite : 1 requête par seconde
        with client() as c:
            try:
                res = c.get("https://api.search.brave.com/res/v1/web/search",
                            params={"q": query, "count": 20, "offset": page, "country": "fr", "search_lang": "fr", "safesearch": "moderate"},
                            headers={"Accept": "application/json", "X-Subscription-Token": key})
            except httpx.HTTPError as e:
                raise ConnectorError("unavailable", f"Brave Search injoignable : {e}") from e
        record_usage(self.id)
        if res.status_code != 200:
            raise _http_error("Brave Search", res)
        data = res.json()
        results = [SearchResult(_strip(r.get("title")), str(r.get("url", "")), _strip(r.get("description")))
                   for r in (data.get("web") or {}).get("results", [])]
        log.info("brave q=%r page=%s → %s résultats", query, page, len(results))
        return results

    def status(self) -> ConnectorStatus:
        key, enabled, limit = self._cfg()
        return ConnectorStatus(
            id=self.id, label=self.label, kind="search", configured=bool(key), enabled=bool(enabled),
            state="ok" if key and enabled else ("disabled" if key else "not_configured"),
            message="Prêt" if key and enabled else ("Désactivé" if key else "Clé d'API à renseigner"),
            used_today=usage_today(self.id), daily_limit=limit,
            free_tier="Offre gratuite Brave Search API (crédit mensuel offert, 1 requête/seconde) — vérifier les conditions en vigueur.",
            limits=["Résultats limités à ce que Brave a indexé publiquement.", "20 résultats par page, 5 pages maximum par requête dans ce logiciel.",
                    "Les extraits indexés peuvent être anciens (nombre d'abonnés, description)."],
            setup_steps=["Créez un compte sur https://api-dashboard.search.brave.com/", "Choisissez l'offre gratuite (« Free »).",
                         "Copiez la clé « Subscription token » dans Sources & connecteurs → Brave Search.", "Cliquez « Tester »."],
            features=["Découverte de profils Instagram et de pages Facebook indexés (requêtes site:instagram.com / site:facebook.com)."],
            docs_url="https://api-dashboard.search.brave.com/app/documentation/web-search/get-started",
        )


class GoogleCSEConnector:
    id = "google_cse"
    label = "Google Programmable Search"
    max_offset_pages = 3

    def _cfg(self):
        s = settings_store.get_all()
        return s["google_cse_key"], s["google_cse_cx"], s["google_cse_enabled"], int(s["google_cse_daily_limit"] or 0)

    def is_ready(self) -> bool:
        key, cx, enabled, _ = self._cfg()
        return bool(key and cx and enabled)

    def search(self, query: str, page: int = 0) -> list[SearchResult]:
        key, cx, _, limit = self._cfg()
        if not (key and cx):
            raise ConnectorError("not_configured", "Google Programmable Search : clé ou identifiant de moteur (cx) absent")
        check_quota(self.id, limit)
        throttle(self.id, 0.5)
        with client() as c:
            try:
                res = c.get("https://www.googleapis.com/customsearch/v1",
                            params={"key": key, "cx": cx, "q": query, "num": 10, "start": 1 + page * 10, "gl": "fr", "lr": "lang_fr", "hl": "fr"})
            except httpx.HTTPError as e:
                raise ConnectorError("unavailable", f"Google Programmable Search injoignable : {e}") from e
        record_usage(self.id)
        if res.status_code != 200:
            raise _http_error("Google Programmable Search", res)
        items = res.json().get("items", []) or []
        results = [SearchResult(_strip(i.get("title")), str(i.get("link", "")), _strip(i.get("snippet"))) for i in items]
        log.info("google_cse q=%r page=%s → %s résultats", query, page, len(results))
        return results

    def status(self) -> ConnectorStatus:
        key, cx, enabled, limit = self._cfg()
        ok = bool(key and cx)
        return ConnectorStatus(
            id=self.id, label=self.label, kind="search", configured=ok, enabled=bool(enabled),
            state="ok" if ok and enabled else ("disabled" if ok else "not_configured"),
            message="Prêt" if ok and enabled else ("Désactivé" if ok else "Clé d'API et identifiant cx à renseigner"),
            used_today=usage_today(self.id), daily_limit=limit,
            free_tier="100 requêtes/jour gratuites. Google a restreint l'accès des nouveaux comptes à cette API : disponibilité à vérifier.",
            limits=["10 résultats par page, 3 pages maximum par requête dans ce logiciel.", "Quota quotidien gratuit de 100 requêtes.",
                    "Le moteur doit être configuré pour « Rechercher sur l'ensemble du Web »."],
            setup_steps=["Créez un moteur sur https://programmablesearchengine.google.com/ (rechercher sur tout le Web).",
                         "Copiez l'identifiant du moteur (cx).", "Activez « Custom Search API » dans Google Cloud Console et créez une clé d'API.",
                         "Renseignez la clé et le cx dans Sources & connecteurs, puis « Tester »."],
            features=["Découverte de profils sociaux indexés par Google (requêtes site:)."],
            docs_url="https://developers.google.com/custom-search/v1/overview",
        )


class RelayConnector:
    """Relais Cloudflare existant de Paysapro Prospection (worker/web-proxy.js, route /search)."""
    id = "relay"
    label = "Relais Paysapro (Brave via Cloudflare)"
    max_offset_pages = 1

    def _cfg(self):
        s = settings_store.get_all()
        return (s["relay_url"] or "").rstrip("/"), s["relay_enabled"], int(s["relay_daily_limit"] or 0)

    def is_ready(self) -> bool:
        url, enabled, _ = self._cfg()
        return bool(url and enabled)

    def search(self, query: str, page: int = 0) -> list[SearchResult]:
        url, _, limit = self._cfg()
        if not url:
            raise ConnectorError("not_configured", "Relais : adresse absente")
        if page > 0:
            return []
        check_quota(self.id, limit)
        throttle(self.id, 1.1)
        with client() as c:
            try:
                res = c.get(f"{url}/search", params={"q": query, "count": 20})
            except httpx.HTTPError as e:
                raise ConnectorError("unavailable", f"Relais injoignable : {e}") from e
        record_usage(self.id)
        try:
            data = res.json()
        except ValueError as e:
            raise ConnectorError("unavailable", f"Relais : réponse illisible (HTTP {res.status_code})") from e
        if not data.get("ok"):
            kind = data.get("code") or ("quota" if res.status_code == 429 else "unavailable")
            raise ConnectorError(kind if kind in ("quota", "not_configured") else "unavailable", f"Relais : {data.get('error', 'erreur')}")
        return [SearchResult(r.get("title", ""), r.get("url", ""), r.get("snippet", "")) for r in data.get("results", [])]

    def status(self) -> ConnectorStatus:
        url, enabled, limit = self._cfg()
        return ConnectorStatus(
            id=self.id, label=self.label, kind="search", configured=bool(url), enabled=bool(enabled),
            state="ok" if url and enabled else ("disabled" if url else "not_configured"),
            message="Prêt" if url and enabled else ("Désactivé" if url else "Adresse du relais à renseigner (facultatif)"),
            used_today=usage_today(self.id), daily_limit=limit,
            free_tier="Réutilise le relais Cloudflare gratuit de Paysapro Prospection, s'il possède déjà la clé BRAVE_SEARCH_KEY.",
            limits=["Une seule page de 20 résultats par requête.", "Partage le quota Brave du relais avec l'application Paysapro."],
            setup_steps=["Déployez le relais (voir worker/README.md à la racine du dépôt) avec le secret BRAVE_SEARCH_KEY.",
                         "Collez l'adresse du relais (https://….workers.dev) dans Sources & connecteurs."],
            features=["Même découverte que Brave Search, sans stocker la clé sur cet ordinateur."],
            docs_url="",
        )


SEARCH_CONNECTORS = [BraveConnector(), GoogleCSEConnector(), RelayConnector()]


def ready_search_connectors() -> list:
    return [c for c in SEARCH_CONNECTORS if c.is_ready()]
