"""Routes : recherche, recherche assistée, campagnes, tableau de bord, connecteurs, paramètres, RGPD, exports."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from .. import config, settings_store
from ..ai.messages import CHANNELS, STYLES
from ..ai.providers import provider_status
from ..connectors.base import ConnectorError
from ..connectors.meta import meta
from ..connectors.search_engines import SEARCH_CONNECTORS
from ..db import add_event, now_iso, row, rows, session
from ..demo import clear_demo, load_demo
from ..discovery.engine import SearchParams, cancel_search, start_search
from ..discovery.queries import assisted_links, build_queries
from ..logs import tail
from ..referentials import ACTIVITIES, DEPARTMENTS, REGIONS, SERVICES, resolve_activity
from ..repo import COMPANY_JSON, STATUS_LABELS, create_company, location_payload, match_company, rescore, upsert_profile
from ..social_urls import extract_website, parse_social_url

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "app": config.APP_NAME, "version": config.APP_VERSION, "db": str(config.DB_PATH)}


@router.get("/referentials")
def referentials() -> dict[str, Any]:
    return {
        "regions": [{"code": k, "name": v} for k, v in sorted(REGIONS.items(), key=lambda x: x[1])],
        "departments": [{"code": k, "name": n, "region": r} for k, (n, r) in DEPARTMENTS.items()],
        "activities": [{"key": a.key, "label": a.label, "sector": a.sector, "synonyms": list(a.synonyms), "relevance": a.relevance} for a in ACTIVITIES],
        "statuses": [{"key": k, "label": v} for k, v in STATUS_LABELS.items()],
        "styles": [{"key": k, "label": v} for k, v in STYLES.items()],
        "channels": [{"key": k, "label": v} for k, v in CHANNELS.items()],
        "services": [{"key": k, "label": v} for k, v in SERVICES.items()],
    }


# --- Recherche ----------------------------------------------------------------------------------------------------
class SearchBody(BaseModel):
    activities: list[str] = []
    keywords: list[str] = []
    platforms: list[str] = ["instagram", "facebook"]
    target: int = 25
    country: str = "FR"
    region: str | None = None
    department: str | None = None
    city: str | None = None
    radius_km: int = 0
    filters: dict[str, bool] = {}
    campaign_id: int | None = None
    campaign_name: str | None = None


@router.post("/searches")
def launch_search(body: SearchBody) -> dict[str, Any]:
    if not body.activities and not body.keywords:
        raise HTTPException(400, "Choisissez au moins une activité ou un mot-clé")
    if not (body.city or body.department or body.region):
        raise HTTPException(400, "Choisissez une ville, un département ou une région")
    data = body.model_dump()
    if not body.campaign_id and body.campaign_name:
        data["campaign_id"] = _create_campaign(body.campaign_name, data)
    data.pop("campaign_name", None)
    sid = start_search(data)
    return {"search_id": sid, "campaign_id": data.get("campaign_id")}


@router.get("/searches")
def list_searches(limit: int = 30) -> list[dict[str, Any]]:
    with session() as conn:
        return rows(conn.execute("SELECT id, campaign_id, params, status, started_at, finished_at, stats FROM searches ORDER BY id DESC LIMIT ?",
                                 (limit,)).fetchall(), ("params", "stats"))


@router.get("/searches/{search_id}")
def get_search(search_id: int) -> dict[str, Any]:
    with session() as conn:
        s = row(conn.execute("SELECT * FROM searches WHERE id=?", (search_id,)).fetchone(), ("params", "stats", "log", "queries_done"))
    if not s:
        raise HTTPException(404, "Recherche introuvable")
    return s


@router.post("/searches/{search_id}/cancel")
def cancel(search_id: int) -> dict[str, Any]:
    cancel_search(search_id)
    return {"ok": True}


@router.post("/assisted/queries")
def assisted_queries(body: SearchBody) -> list[dict[str, Any]]:
    p = SearchParams.from_dict(body.model_dump())
    acts = [resolve_activity(a) for a in p.activities] or [resolve_activity(k) for k in p.keywords[:1]]
    places, _ = p.places()
    return [{"query": q.text, "platform": q.platform, "links": assisted_links(q.text)} for q in build_queries(acts, places[:3], p.platforms, p.keywords)[:40]]


class AssistedProfile(BaseModel):
    url: str
    name: str | None = None
    bio: str | None = None
    location: str | None = None
    website: str | None = None


class AssistedBody(BaseModel):
    profiles: list[AssistedProfile]
    activity: str | None = None
    city: str | None = None
    department: str | None = None
    region: str | None = None
    campaign_id: int | None = None


@router.post("/assisted/profiles")
def add_assisted(body: AssistedBody) -> dict[str, Any]:
    """Recherche assistée : l'utilisateur a trouvé ces profils lui-même (navigation humaine) et les ajoute."""
    report = {"added": 0, "merged": 0, "already_known": 0, "invalid": [], "suppressed": 0, "company_ids": []}
    loc = location_payload(body.city, body.department, body.region, ["instagram", "facebook"])
    for item in body.profiles:
        ref = parse_social_url(item.url)
        if not ref:
            report["invalid"].append(item.url)
            continue
        with session() as conn:
            from ..repo import is_suppressed
            if is_suppressed(conn, ref.platform, ref.handle, item.name):
                report["suppressed"] += 1
                continue
            pid, _ = upsert_profile(conn, {"platform": ref.platform, "handle": ref.handle, "url": ref.url, "display_name": item.name or None,
                                           "bio": item.bio or None, "location": item.location or None,
                                           "website": item.website or extract_website(item.bio), "source": "assisted"})
            p = conn.execute("SELECT company_id FROM profiles WHERE id=?", (pid,)).fetchone()
            if p["company_id"]:
                report["already_known"] += 1
                rescore(conn, p["company_id"])
                continue
            cid = create_company(conn, pid, {"activity_key": body.activity, "location": loc, "campaign_id": body.campaign_id, "source": "Recherche assistée"})
            rescore(conn, cid)
            m = match_company(conn, cid)
            if m["into"] == cid:
                report["added"] += 1
            else:
                report["merged"] += 1  # autre réseau d'une entreprise déjà présente
            if m["into"] not in report["company_ids"]:
                report["company_ids"].append(m["into"])
    return report


# --- Campagnes ----------------------------------------------------------------------------------------------------
def _create_campaign(name: str, params: dict[str, Any], description: str = "") -> int:
    ts = now_iso()
    with session() as conn:
        cur = conn.execute("INSERT INTO campaigns(name, description, params, created_at, updated_at) VALUES (?,?,?,?,?)",
                           (name, description, json.dumps({k: v for k, v in params.items() if k not in ("campaign_id", "campaign_name")}, ensure_ascii=False), ts, ts))
        return int(cur.lastrowid)


def campaign_stats(conn, campaign_id: int) -> dict[str, Any]:
    q = lambda sql, *a: conn.execute(sql, (campaign_id, *a)).fetchone()["n"]  # noqa: E731
    discovered = q("SELECT COUNT(*) n FROM companies WHERE campaign_id=?")
    sent = q("SELECT COUNT(DISTINCT m.company_id) n FROM messages m JOIN companies c ON c.id=m.company_id WHERE c.campaign_id=? AND m.status='sent'")
    replied = q("SELECT COUNT(*) n FROM companies WHERE campaign_id=? AND status IN ('replied','interested','not_interested')")
    return {
        "discovered": discovered,
        "validated": q("SELECT COUNT(*) n FROM companies WHERE campaign_id=? AND (validated=1 OR confidence_score>=75)"),
        "high_potential": q("SELECT COUNT(*) n FROM companies WHERE campaign_id=? AND commercial_score>=70 AND confidence_score>=50"),
        "messages_ready": q("SELECT COUNT(DISTINCT m.company_id) n FROM messages m JOIN companies c ON c.id=m.company_id WHERE c.campaign_id=?"),
        "messages_sent": sent,
        "replies": replied,
        "interested": q("SELECT COUNT(*) n FROM companies WHERE campaign_id=? AND status='interested'"),
        "response_rate": round(100 * replied / sent, 1) if sent else None,
        "searches": q("SELECT COUNT(*) n FROM searches WHERE campaign_id=?"),
    }


class CampaignBody(BaseModel):
    name: str
    description: str = ""
    params: dict[str, Any] = {}
    archived: bool | None = None


@router.get("/campaigns")
def list_campaigns(include_archived: bool = False) -> list[dict[str, Any]]:
    with session() as conn:
        cs = rows(conn.execute("SELECT * FROM campaigns WHERE archived=0 OR ? ORDER BY id DESC", (int(include_archived),)).fetchall(), ("params",))
        return [{**c, "stats": campaign_stats(conn, c["id"])} for c in cs]


@router.post("/campaigns")
def create_campaign(body: CampaignBody) -> dict[str, Any]:
    cid = _create_campaign(body.name, body.params, body.description)
    return get_campaign(cid)


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: int) -> dict[str, Any]:
    with session() as conn:
        c = row(conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone(), ("params",))
        if not c:
            raise HTTPException(404, "Campagne introuvable")
        c["stats"] = campaign_stats(conn, campaign_id)
        c["searches"] = rows(conn.execute("SELECT id, status, started_at, finished_at, stats FROM searches WHERE campaign_id=? ORDER BY id DESC",
                                          (campaign_id,)).fetchall(), ("stats",))
        return c


@router.patch("/campaigns/{campaign_id}")
def update_campaign(campaign_id: int, body: CampaignBody) -> dict[str, Any]:
    with session() as conn:
        conn.execute("UPDATE campaigns SET name=?, description=?, archived=COALESCE(?, archived), updated_at=? WHERE id=?",
                     (body.name, body.description, None if body.archived is None else int(body.archived), now_iso(), campaign_id))
    return get_campaign(campaign_id)


@router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int) -> dict[str, Any]:
    """Supprime la campagne ; les entreprises sont conservées (détachées de la campagne)."""
    with session() as conn:
        conn.execute("DELETE FROM campaigns WHERE id=?", (campaign_id,))
    return {"ok": True}


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: int, target: int | None = None) -> dict[str, Any]:
    """Reprend la campagne : mêmes critères, en sautant les requêtes déjà effectuées."""
    c = get_campaign(campaign_id)
    params = dict(c["params"] or {})
    if not params.get("activities") and not params.get("keywords"):
        raise HTTPException(400, "Cette campagne n'a pas de critères de recherche enregistrés")
    params["campaign_id"] = campaign_id
    if target:
        params["target"] = target
    return {"search_id": start_search(params)}


# --- Tableau de bord ----------------------------------------------------------------------------------------------
@router.get("/dashboard")
def dashboard(include_demo: bool = False) -> dict[str, Any]:
    demo = "" if include_demo else " AND c.is_demo=0"
    today = datetime.now(timezone.utc).date().isoformat()
    week = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    with session() as conn:
        one = lambda sql, *a: conn.execute(sql, a).fetchone()["n"]  # noqa: E731
        kpi = {
            "total": one(f"SELECT COUNT(*) n FROM companies c WHERE 1=1{demo}"),
            "today": one(f"SELECT COUNT(*) n FROM companies c WHERE discovered_at>=?{demo}", today),
            "week": one(f"SELECT COUNT(*) n FROM companies c WHERE discovered_at>=?{demo}", week),
            "instagram": one(f"SELECT COUNT(*) n FROM profiles p JOIN companies c ON c.id=p.company_id WHERE p.platform='instagram'{demo}"),
            "facebook": one(f"SELECT COUNT(*) n FROM profiles p JOIN companies c ON c.id=p.company_id WHERE p.platform='facebook'{demo}"),
            "validated": one(f"SELECT COUNT(*) n FROM companies c WHERE validated=1{demo}"),
            "very_reliable": one(f"SELECT COUNT(*) n FROM companies c WHERE confidence_score>=90{demo}"),
            "high_potential": one(f"SELECT COUNT(*) n FROM companies c WHERE commercial_score>=70 AND confidence_score>=50{demo}"),
            "messages_ready": one(f"SELECT COUNT(DISTINCT m.company_id) n FROM messages m JOIN companies c ON c.id=m.company_id WHERE m.status='draft'{demo}"),
            "messages_sent": one(f"SELECT COUNT(*) n FROM messages m JOIN companies c ON c.id=m.company_id WHERE m.status='sent'{demo}"),
            "replies": one(f"SELECT COUNT(*) n FROM companies c WHERE status IN ('replied','interested','not_interested'){demo}"),
            "interested": one(f"SELECT COUNT(*) n FROM companies c WHERE status='interested'{demo}"),
            "pending_matches": one("SELECT COUNT(*) n FROM match_suggestions WHERE status='pending'"),
            "demo_count": one("SELECT COUNT(*) n FROM companies WHERE is_demo=1"),
        }
        conf_b = [conn.execute(f"SELECT COUNT(*) n FROM companies c WHERE confidence_score>=? AND confidence_score<?{demo}", (lo, hi)).fetchone()["n"]
                  for lo, hi in ((0, 50), (50, 75), (75, 90), (90, 101))]
        com_b = [conn.execute(f"SELECT COUNT(*) n FROM companies c WHERE commercial_score>=? AND commercial_score<?{demo}", (lo, hi)).fetchone()["n"]
                 for lo, hi in ((0, 50), (50, 70), (70, 85), (85, 101))]
        days = []
        for i in range(13, -1, -1):
            d = (datetime.now(timezone.utc) - timedelta(days=i)).date()
            nxt = (d + timedelta(days=1)).isoformat()
            days.append({"date": d.isoformat(),
                         "discovered": one(f"SELECT COUNT(*) n FROM companies c WHERE discovered_at>=? AND discovered_at<?{demo}", d.isoformat(), nxt),
                         "sent": one(f"SELECT COUNT(*) n FROM messages m JOIN companies c ON c.id=m.company_id WHERE m.sent_at>=? AND m.sent_at<?{demo}", d.isoformat(), nxt)})
        statuses = {r["status"]: r["n"] for r in conn.execute(f"SELECT status, COUNT(*) n FROM companies c WHERE 1=1{demo} GROUP BY status")}
        best = rows(conn.execute(f"SELECT c.* FROM companies c WHERE confidence_score>=75 AND commercial_score>=70 AND status NOT IN ('do_not_contact','not_interested'){demo} "
                                 "ORDER BY priority DESC LIMIT 8").fetchall(), COMPANY_JSON)
        events = rows(conn.execute("SELECT e.*, c.name company_name, c.is_demo FROM events e LEFT JOIN companies c ON c.id=e.company_id ORDER BY e.id DESC LIMIT 15").fetchall())
    return {
        "kpi": kpi,
        "confidence_distribution": [{"label": l, "count": n} for l, n in zip(("Incertain", "À vérifier", "Fiable", "Très fiable"), conf_b)],
        "commercial_distribution": [{"label": l, "count": n} for l, n in zip(("Faible", "Moyen", "Bon", "Excellent"), com_b)],
        "timeline": days,
        "statuses": [{"key": k, "label": v, "count": statuses.get(k, 0)} for k, v in STATUS_LABELS.items()],
        "best": [{"id": c["id"], "name": c["name"], "city": c["city"], "activity_label": c["activity_label"], "confidence_score": c["confidence_score"],
                  "commercial_score": c["commercial_score"], "priority": c["priority"], "is_demo": bool(c["is_demo"]),
                  "main_opportunity": (c.get("analysis") or {}).get("main_opportunity")} for c in best],
        "events": events,
    }


# --- Connecteurs & paramètres -------------------------------------------------------------------------------------
@router.get("/connectors")
def connectors() -> dict[str, Any]:
    from dataclasses import asdict
    search = [asdict(c.status()) for c in SEARCH_CONNECTORS]
    return {"search": search, "meta": asdict(meta.status()), "ai": provider_status(),
            "website_check": settings_store.get("website_check_enabled"), "geo": settings_store.get("geo_api_enabled"),
            "any_search_ready": any(s["state"] == "ok" for s in search)}


@router.post("/connectors/{connector_id}/test")
def test_connector(connector_id: str) -> dict[str, Any]:
    if connector_id == "meta":
        try:
            granted, declined = meta.permissions()
            return {"ok": True, "message": f"Jeton valide. Permissions accordées : {', '.join(granted) or 'aucune'}", "granted": granted, "declined": declined}
        except ConnectorError as e:
            return {"ok": False, "message": e.message}
    if connector_id == "ai":
        return {"ok": provider_status()["ready"], "message": provider_status()["message"]}
    conn = next((c for c in SEARCH_CONNECTORS if c.id == connector_id), None)
    if not conn:
        raise HTTPException(404, "Connecteur inconnu")
    try:
        res = conn.search("restaurant Rouen site:instagram.com", 0)
        profiles = [r.url for r in res if parse_social_url(r.url)]
        return {"ok": True, "message": f"{len(res)} résultat(s), dont {len(profiles)} profil(s) Instagram reconnu(s).", "sample": profiles[:5]}
    except ConnectorError as e:
        return {"ok": False, "message": e.message}


@router.post("/connectors/meta/detect")
def meta_detect() -> dict[str, Any]:
    try:
        ig = meta.detect_ig_user_id()
    except ConnectorError as e:
        return {"ok": False, "message": e.message}
    if not ig:
        return {"ok": False, "message": "Aucun compte Instagram professionnel relié à vos pages Facebook n'a été trouvé."}
    settings_store.update({"meta_ig_user_id": ig})
    return {"ok": True, "message": f"Compte Instagram professionnel détecté (id {ig}).", "ig_user_id": ig}


@router.get("/settings")
def get_settings() -> dict[str, Any]:
    return settings_store.public_view()


@router.put("/settings")
def put_settings(changes: dict[str, Any]) -> dict[str, Any]:
    return settings_store.update(changes)


# --- Modèles de messages ------------------------------------------------------------------------------------------
class TemplateBody(BaseModel):
    name: str
    style: str = "professional"
    channel: str = "any"
    body: str


@router.get("/templates")
def list_templates() -> list[dict[str, Any]]:
    with session() as conn:
        return rows(conn.execute("SELECT * FROM message_templates ORDER BY id DESC").fetchall())


@router.post("/templates")
def create_template(body: TemplateBody) -> dict[str, Any]:
    with session() as conn:
        cur = conn.execute("INSERT INTO message_templates(name, channel, style, body, created_at) VALUES (?,?,?,?,?)",
                           (body.name, body.channel, body.style, body.body, now_iso()))
        return row(conn.execute("SELECT * FROM message_templates WHERE id=?", (cur.lastrowid,)).fetchone()) or {}


@router.put("/templates/{tid}")
def update_template(tid: int, body: TemplateBody) -> dict[str, Any]:
    with session() as conn:
        conn.execute("UPDATE message_templates SET name=?, channel=?, style=?, body=? WHERE id=?", (body.name, body.channel, body.style, body.body, tid))
        return row(conn.execute("SELECT * FROM message_templates WHERE id=?", (tid,)).fetchone()) or {}


@router.delete("/templates/{tid}")
def delete_template(tid: int) -> dict[str, Any]:
    with session() as conn:
        conn.execute("DELETE FROM message_templates WHERE id=?", (tid,))
    return {"ok": True}


# --- RGPD : oppositions, suppression, conservation ---------------------------------------------------------------
class SuppressionBody(BaseModel):
    url: str | None = None
    name: str | None = None
    reason: str = "Opposition"


@router.get("/suppression")
def suppression_list() -> list[dict[str, Any]]:
    with session() as conn:
        return rows(conn.execute("SELECT * FROM suppression_list ORDER BY id DESC").fetchall())


@router.post("/suppression")
def add_suppression(body: SuppressionBody) -> dict[str, Any]:
    from ..text import compact
    ref = parse_social_url(body.url) if body.url else None
    if not ref and not body.name:
        raise HTTPException(400, "Indiquez l'URL d'un profil ou un nom d'entreprise")
    with session() as conn:
        conn.execute("INSERT INTO suppression_list(platform, handle, name, reason, created_at) VALUES (?,?,?,?,?)",
                     (ref.platform if ref else None, ref.handle if ref else None, compact(body.name) if body.name else None, body.reason, now_iso()))
        removed = 0
        if ref:
            p = conn.execute("SELECT company_id FROM profiles WHERE platform=? AND handle=?", (ref.platform, ref.handle)).fetchone()
            if p and p["company_id"]:
                cid = p["company_id"]
                conn.execute("DELETE FROM profiles WHERE company_id=?", (cid,))
                conn.execute("DELETE FROM companies WHERE id=?", (cid,))
                removed = 1
        add_event(conn, None, "opposition", f"Ajout à la liste de suppression ({body.reason}){' — données supprimées' if removed else ''}")
    return {"ok": True, "removed": removed}


@router.delete("/suppression/{sid}")
def remove_suppression(sid: int) -> dict[str, Any]:
    with session() as conn:
        conn.execute("DELETE FROM suppression_list WHERE id=?", (sid,))
    return {"ok": True}


@router.post("/rgpd/purge")
def purge_old(days: int | None = None) -> dict[str, Any]:
    """Supprime les entreprises jamais contactées découvertes depuis plus de N jours (durée de conservation)."""
    days = days or int(settings_store.get("retention_days") or 365)
    limit = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    with session() as conn:
        ids = [r["id"] for r in conn.execute("SELECT id FROM companies WHERE discovered_at<? AND status IN ('new','to_contact','message_ready')", (limit,))]
        for cid in ids:
            conn.execute("DELETE FROM profiles WHERE company_id=?", (cid,))
            conn.execute("DELETE FROM companies WHERE id=?", (cid,))
        add_event(conn, None, "purge", f"{len(ids)} entreprise(s) non contactée(s) de plus de {days} jours supprimée(s)")
    return {"deleted": len(ids)}


@router.post("/rgpd/delete-all")
def delete_all(confirm: str = "") -> dict[str, Any]:
    if confirm != "SUPPRIMER":
        raise HTTPException(400, "Confirmation requise : SUPPRIMER")
    backup()
    with session() as conn:
        for t in ("messages", "events", "match_suggestions", "match_history", "profiles", "companies", "searches", "campaigns"):
            conn.execute(f"DELETE FROM {t}")
    return {"ok": True}


# --- Exports & sauvegardes ----------------------------------------------------------------------------------------
@router.get("/export/companies.csv")
def export_csv(campaign_id: int | None = None, include_demo: bool = False, min_confidence: int = 0, min_commercial: int = 0) -> StreamingResponse:
    where, args = ["confidence_score>=?", "commercial_score>=?"], [min_confidence, min_commercial]
    if campaign_id:
        where.append("campaign_id=?")
        args.append(campaign_id)
    if not include_demo:
        where.append("is_demo=0")
    with session() as conn:
        cs = rows(conn.execute(f"SELECT * FROM companies WHERE {' AND '.join(where)} ORDER BY priority DESC", args).fetchall(), COMPANY_JSON)
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";")
        w.writerow(["Nom", "Activité", "Ville", "Instagram", "Facebook", "Site", "Score de confiance", "Niveau de confiance", "Score commercial",
                    "Potentiel", "Priorité", "Opportunité principale", "Services recommandés", "Statut", "Source", "Découvert le", "Notes", "Démo"])
        for c in cs:
            ps = conn.execute("SELECT platform, url FROM profiles WHERE company_id=?", (c["id"],)).fetchall()
            urls = {p["platform"]: p["url"] for p in ps}
            ana = c.get("analysis") or {}
            w.writerow([c["name"], c["activity_label"] or "", c["city"] or "", urls.get("instagram", ""), urls.get("facebook", ""), c["website"] or "",
                        c["confidence_score"], (c.get("confidence_detail") or {}).get("level", {}).get("label", ""), c["commercial_score"],
                        (c.get("commercial_detail") or {}).get("level", {}).get("label", ""), c["priority"],
                        ((ana.get("main_opportunity") or {}).get("text") or ""), ", ".join(s["label"] for s in ana.get("services", [])),
                        STATUS_LABELS.get(c["status"], c["status"]), c["source"], c["discovered_at"][:10], c["notes"], "oui" if c["is_demo"] else ""])
    data = "﻿" + buf.getvalue()  # BOM : ouverture correcte des accents dans Excel
    name = f"social-finder-{datetime.now().strftime('%Y%m%d-%H%M')}.csv"
    return StreamingResponse(iter([data]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/export/prospection.csv")
def export_prospection(ids: str = "", min_confidence: int = 50, min_commercial: int = 0, campaign_id: int | None = None,
                       only_new: bool = False, preview: bool = False):
    """Fichier d'import pour Paysapro Prospection (espace Signe & Seine). preview=true : compte sans marquer."""
    from ..prospection_export import build_csv, select
    id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
    with session() as conn:
        companies = select(conn, id_list or None, min_confidence, min_commercial, campaign_id, only_new)
        if preview:
            return {"count": len(companies), "already_exported": sum(1 for c in companies if c.get("exported_at"))}
        data = build_csv(conn, companies)
    name = f"vers-prospection-{datetime.now().strftime('%Y%m%d-%H%M')}.csv"
    return StreamingResponse(iter([data]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.post("/backup")
def backup() -> dict[str, Any]:
    config.ensure_dirs()
    name = f"social_finder-{datetime.now().strftime('%Y%m%d-%H%M%S')}.db"
    dest = config.BACKUP_DIR / name
    with session() as conn:
        target = __import__("sqlite3").connect(dest)
        conn.backup(target)
        target.close()
    backups = sorted(config.BACKUP_DIR.glob("social_finder-*.db"))
    for old in backups[:-20]:  # on garde les 20 dernières sauvegardes
        old.unlink(missing_ok=True)
    return {"file": str(dest), "name": name}


@router.get("/backup/list")
def backup_list() -> list[dict[str, Any]]:
    config.ensure_dirs()
    return [{"name": p.name, "size": p.stat().st_size, "date": datetime.fromtimestamp(p.stat().st_mtime).isoformat()}
            for p in sorted(config.BACKUP_DIR.glob("social_finder-*.db"), reverse=True)]


@router.get("/backup/download/{name}")
def backup_download(name: str) -> FileResponse:
    path = (config.BACKUP_DIR / name).resolve()
    if path.parent != config.BACKUP_DIR.resolve() or not path.exists():
        raise HTTPException(404, "Sauvegarde introuvable")
    return FileResponse(path, filename=name)


@router.post("/demo/load")
def demo_load() -> dict[str, Any]:
    return {"created": load_demo()}


@router.post("/demo/clear")
def demo_clear() -> dict[str, Any]:
    return {"deleted": clear_demo()}


@router.get("/logs")
def logs(lines: int = 300) -> dict[str, Any]:
    return {"lines": tail(min(lines, 2000))}


__all__ = ["router"]
