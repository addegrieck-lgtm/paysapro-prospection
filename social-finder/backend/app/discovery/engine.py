"""MOTEUR AUTONOME DE DÉCOUVERTE SOCIALE.

1. Génère les requêtes (métier × lieu × réseau).            4. Vérifie via l'API Meta si elle est configurée.
2. Interroge les moteurs autorisés (API officielles).        5. Rapproche Facebook ↔ Instagram, élimine les doublons.
3. Extrait les URL de profils / pages professionnels.        6. Diagnostique le site, calcule les deux scores, enregistre.

Aucun résultat n'est simulé : sans source configurée, la recherche s'arrête avec le statut « no_source » et
propose la recherche assistée.
"""
from __future__ import annotations

import json
import threading
import traceback
from dataclasses import dataclass, field
from typing import Any

from .. import settings_store
from ..connectors import geo
from ..connectors.base import ConnectorError
from ..connectors.meta import meta
from ..connectors.search_engines import ready_search_connectors
from ..connectors.website import check_website
from ..db import add_event, now_iso, row, session
from ..logs import log
from ..referentials import REGIONS, department_name, resolve_activity
from ..repo import create_company, get_company, is_suppressed, location_payload, match_company, rescore, set_website_check, upsert_profile
from ..social_urls import parse_snippet, parse_social_url
from .queries import Query, assisted_links, build_queries

_cancel: set[int] = set()
_running: dict[int, threading.Thread] = {}


@dataclass
class SearchParams:
    activities: list[str]
    platforms: list[str]
    target: int = 25
    country: str = "FR"
    region: str | None = None
    department: str | None = None
    city: str | None = None
    radius_km: int = 0
    keywords: list[str] = field(default_factory=list)
    filters: dict[str, bool] = field(default_factory=dict)
    campaign_id: int | None = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "SearchParams":
        return cls(activities=[a for a in d.get("activities", []) if a] or [], platforms=[p for p in d.get("platforms", []) if p in ("instagram", "facebook")] or ["instagram", "facebook"],
                   target=max(1, min(100, int(d.get("target") or 25))), country=d.get("country") or "FR", region=d.get("region") or None,
                   department=d.get("department") or None, city=(d.get("city") or "").strip() or None, radius_km=int(d.get("radius_km") or 0),
                   keywords=[k.strip() for k in d.get("keywords", []) if k and k.strip()], filters=d.get("filters") or {}, campaign_id=d.get("campaign_id"))

    def places(self) -> tuple[list[str], list[str]]:
        notes: list[str] = []
        if self.city:
            places = [self.city]
            if self.radius_km > 0 and settings_store.get("geo_api_enabled"):
                around, err = geo.communes_around(self.city, self.radius_km)
                if err:
                    notes.append(err)
                places += around
            return places, notes
        if self.department:
            return [department_name(self.department) or self.department], notes
        if self.region:
            return [REGIONS.get(self.region, self.region)], notes
        return ["France"], notes


def passes_filters(company: dict[str, Any], profiles_count: dict[str, int], filters: dict[str, bool], is_new: bool) -> bool:
    nets = len(profiles_count)
    if filters.get("both_networks") and nets < 2:
        return False
    if filters.get("single_network") and nets != 1:
        return False
    if filters.get("high_potential") and company["commercial_score"] < 70:
        return False
    if filters.get("new_only") and not is_new:
        return False
    if filters.get("recent_activity"):
        crit = next((c for c in (company.get("commercial_detail") or {}).get("criteria", []) if c["key"] == "real_activity"), None)
        if crit and crit["status"] == "verified" and crit["points"] < 7:
            return False  # date connue et ancienne
    return True


class Job:
    def __init__(self, search_id: int, params: SearchParams):
        self.search_id = search_id
        self.p = params
        self.stats: dict[str, Any] = {"requests": 0, "results": 0, "profiles_found": 0, "instagram": 0, "facebook": 0, "new_companies": 0,
                                      "already_known": 0, "suppressed": 0, "ignored_urls": 0, "auto_merged": 0, "suggestions": 0,
                                      "meta_verified": 0, "websites_checked": 0, "qualified": 0, "errors": 0, "target": params.target,
                                      "queries_total": 0, "queries_done": 0}
        self.lines: list[str] = []
        self.new_company_ids: list[int] = []
        self.touched: set[int] = set()

    # --- Journal visible dans l'interface ---
    def say(self, msg: str) -> None:
        self.lines.append(f"{now_iso()[11:19]}  {msg}")
        log.info("search#%s %s", self.search_id, msg)
        self.flush()

    def flush(self, status: str | None = None, finished: bool = False) -> None:
        with session() as conn:
            sets, vals = ["stats=?", "log=?"], [json.dumps(self.stats), json.dumps(self.lines[-400:], ensure_ascii=False)]
            if status:
                sets.append("status=?")
                vals.append(status)
            if finished:
                sets.append("finished_at=?")
                vals.append(now_iso())
            conn.execute(f"UPDATE searches SET {', '.join(sets)} WHERE id=?", [*vals, self.search_id])

    def cancelled(self) -> bool:
        return self.search_id in _cancel

    # --- Déroulement ---
    def run(self) -> None:
        try:
            self._run()
        except Exception as e:  # noqa: BLE001 — toute erreur est journalisée et affichée
            log.error("search#%s erreur : %s\n%s", self.search_id, e, traceback.format_exc())
            self.stats["errors"] += 1
            self.say(f"Erreur inattendue : {e}")
            self.flush("failed", True)
        finally:
            _cancel.discard(self.search_id)
            _running.pop(self.search_id, None)

    def _done_queries(self) -> set[str]:
        """Requêtes déjà exécutées dans la campagne : une campagne reprise ne refait pas les mêmes recherches."""
        if not self.p.campaign_id:
            return set()
        with session() as conn:
            done: set[str] = set()
            for r in conn.execute("SELECT queries_done FROM searches WHERE campaign_id=? AND id<>?", (self.p.campaign_id, self.search_id)):
                done.update(json.loads(r["queries_done"] or "[]"))
            return done

    def _run(self) -> None:
        p = self.p
        activities = [resolve_activity(a) for a in p.activities] or [resolve_activity(k) for k in p.keywords[:1]]
        if not activities:
            self.say("Aucune activité sélectionnée.")
            self.flush("failed", True)
            return
        places, notes = p.places()
        for n in notes:
            self.say(n)
        if len(places) > 1:
            self.say(f"Zone élargie (rayon {p.radius_km} km) : {', '.join(places)}")
        queries = build_queries(activities, places, p.platforms, p.keywords if p.activities else [])
        done = self._done_queries()
        pending = [q for q in queries if f"{q.text}#0" not in done]
        self.stats["queries_total"] = len(queries)
        if done:
            self.say(f"Reprise de campagne : {len(queries) - len(pending)} requête(s) déjà effectuée(s) ignorée(s).")
        connectors = ready_search_connectors()
        if not connectors:
            self.say("Aucune source de recherche automatique n'est configurée. Utilisez la recherche assistée ou configurez une API (Sources & connecteurs).")
            self.stats["assisted_queries"] = [{"query": q.text, "platform": q.platform, "links": assisted_links(q.text)} for q in queries[:30]]
            self.flush("no_source", True)
            return
        self.say(f"Sources actives : {', '.join(c.label for c in connectors)}. {len(pending)} requête(s) prévue(s).")
        max_requests = max(10, p.target * 2)
        location = location_payload(p.city, p.department, p.region, p.platforms)
        executed: list[str] = []
        for q in pending:
            if self.cancelled() or self.stats["qualified"] >= p.target or self.stats["requests"] >= max_requests:
                break
            page = 0
            while page < 5:
                if self.cancelled() or self.stats["qualified"] >= p.target or self.stats["requests"] >= max_requests:
                    break
                results, connector = self._search(connectors, q, page)
                if results is None:
                    if not connectors:
                        self.say("Toutes les sources sont indisponibles ou ont atteint leur quota : arrêt de la recherche.")
                        self._finish(executed, "done")
                        return
                    break
                executed.append(f"{q.text}#{page}")
                new_here = self._ingest(results, q, connector, location)
                self.stats["queries_done"] = len({e.split('#')[0] for e in executed})
                self.flush()
                if len(results) < 8 or new_here == 0 or page + 1 >= connector.max_offset_pages:
                    break
                page += 1
        self._finish(executed, "cancelled" if self.cancelled() else "done")

    def _search(self, connectors: list, q: Query, page: int):
        while connectors:
            c = connectors[0]
            try:
                self.stats["requests"] += 1
                res = c.search(q.text, page)
                self.stats["results"] += len(res)
                self.say(f"[{c.label}] « {q.text} »{' p.' + str(page + 1) if page else ''} → {len(res)} résultat(s)")
                return res, c
            except ConnectorError as e:
                self.stats["errors"] += 1
                self.say(f"[{c.label}] {e.message}")
                if e.kind in ("quota", "auth", "not_configured"):
                    connectors.pop(0)
                    continue
                return None, c
        return None, None

    def _ingest(self, results: list, q: Query, connector, location: dict[str, Any]) -> int:
        new_here = 0
        for r in results:
            ref = parse_social_url(r.url)
            if not ref or ref.platform != q.platform:
                if not ref:
                    self.stats["ignored_urls"] += 1
                continue
            info = parse_snippet(ref.platform, r.title, r.snippet)
            with session() as conn:
                if is_suppressed(conn, ref.platform, ref.handle, info.display_name):
                    self.stats["suppressed"] += 1
                    continue
                pid, created = upsert_profile(conn, {
                    "platform": ref.platform, "handle": ref.handle, "url": ref.url, "display_name": info.display_name, "bio": info.bio,
                    "followers": info.followers, "following": info.following, "posts": info.posts, "likes": info.likes, "checkins": info.checkins,
                    "mentioned_handles": info.mentioned_handles, "title": r.title, "snippet": r.snippet, "search_query": q.text,
                    "source": f"search:{connector.id}"})
                prof = row(conn.execute("SELECT company_id FROM profiles WHERE id=?", (pid,)).fetchone())
                if prof and prof["company_id"]:
                    self.stats["already_known"] += 1
                    cid = prof["company_id"]
                    rescore(conn, cid)
                    self._count(conn, cid, is_new=False)
                    continue
                self.stats["profiles_found"] += 1
                self.stats[ref.platform] += 1
                cid = create_company(conn, pid, {"activity_key": q.activity_key, "location": location, "campaign_id": self.p.campaign_id,
                                                 "search_id": self.search_id, "source": connector.label})
                self.stats["new_companies"] += 1
                new_here += 1
                self.new_company_ids.append(cid)
            self._enrich(cid, ref.platform, ref.handle)
            with session() as conn:
                rescore(conn, cid)
                m = match_company(conn, cid)
                self.stats["auto_merged"] += m["auto"]
                self.stats["suggestions"] += m["suggested"]
                if m["auto"]:
                    self.stats["new_companies"] -= 1
                self._count(conn, m["into"], is_new=m["into"] == cid)
            if m["auto"]:  # journal écrit hors transaction (évite un verrou SQLite)
                self.say(f"Rapprochement automatique Facebook ↔ Instagram pour « {info.display_name or ref.handle} »")
        return new_here

    def _enrich(self, cid: int, platform: str, handle: str) -> None:
        """Vérification par l'API Meta (si configurée) puis diagnostic du site."""
        if platform == "instagram" and meta.ig_ready():
            try:
                bd = meta.instagram_business_discovery(handle)
                if bd:
                    media = (bd.get("media") or {}).get("data") or []
                    with session() as conn:
                        upsert_profile(conn, {"platform": "instagram", "handle": handle, "url": f"https://www.instagram.com/{handle}/",
                                              "display_name": bd.get("name"), "bio": bd.get("biography"), "website": bd.get("website"),
                                              "followers": bd.get("followers_count"), "following": bd.get("follows_count"), "posts": bd.get("media_count"),
                                              "last_post_at": media[0]["timestamp"] if media else None, "api_verified": True, "api_data": bd, "source": "meta_api"})
                    self.stats["meta_verified"] += 1
            except ConnectorError as e:
                if e.kind != "forbidden":
                    self.say(f"[API Meta] {e.message}")
        if settings_store.get("website_check_enabled"):
            with session() as conn:
                c = rescore(conn, cid)
            if c and c.get("website") and not c.get("website_check") and "linktr" not in (c["website"] or ""):
                chk = check_website(c["website"])
                with session() as conn:
                    set_website_check(conn, cid, chk)
                self.stats["websites_checked"] += 1

    def _count(self, conn, cid: int, is_new: bool) -> None:
        if cid in self.touched:
            return
        c = get_company(conn, cid)
        if not c:
            return
        nets = {r["platform"]: 1 for r in conn.execute("SELECT platform FROM profiles WHERE company_id=?", (cid,))}
        if passes_filters(c, nets, self.p.filters, is_new):
            self.touched.add(cid)
            self.stats["qualified"] = len(self.touched)

    def _finish(self, executed: list[str], status: str) -> None:
        with session() as conn:
            prev = json.loads(conn.execute("SELECT queries_done FROM searches WHERE id=?", (self.search_id,)).fetchone()["queries_done"])
            conn.execute("UPDATE searches SET queries_done=? WHERE id=?", (json.dumps(sorted(set(prev + executed))), self.search_id))
            # Recalcul final : les rapprochements ont pu enrichir des entreprises déjà évaluées
            for cid in set(self.new_company_ids):
                if get_company(conn, cid):
                    rescore(conn, cid)
            if self.p.campaign_id:
                add_event(conn, None, "search", f"Recherche #{self.search_id} (campagne {self.p.campaign_id}) : {self.stats['new_companies']} nouvelle(s) entreprise(s)")
        reached = self.stats["qualified"] >= self.p.target
        self.say(f"Terminé : {self.stats['qualified']} entreprise(s) correspondant aux critères"
                 + ("" if reached else f" (objectif {self.p.target} non atteint : sources ou quotas insuffisants, essayez d'élargir la zone ou la recherche assistée)") + ".")
        self.flush(status, True)


def start_search(params_dict: dict[str, Any], background: bool = True) -> int:
    params = SearchParams.from_dict(params_dict)
    with session() as conn:
        cur = conn.execute("INSERT INTO searches(campaign_id, params, status, started_at) VALUES (?,?,?,?)",
                           (params.campaign_id, json.dumps(params_dict, ensure_ascii=False), "running", now_iso()))
        sid = int(cur.lastrowid)
    job = Job(sid, params)
    if background:
        t = threading.Thread(target=job.run, name=f"search-{sid}", daemon=True)
        _running[sid] = t
        t.start()
    else:
        job.run()
    return sid


def cancel_search(search_id: int) -> None:
    _cancel.add(search_id)


def mark_interrupted() -> None:
    """Au démarrage : une recherche restée « running » (logiciel fermé pendant la recherche) est marquée interrompue."""
    with session() as conn:
        conn.execute("UPDATE searches SET status='cancelled', finished_at=? WHERE status='running'", (now_iso(),))
