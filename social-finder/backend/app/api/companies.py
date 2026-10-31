"""Routes : entreprises, profils, rapprochements, messages, file de prospection, suivi."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..ai.messages import CHANNELS, STYLES, generate
from ..connectors.base import ConnectorError
from ..connectors.meta import meta
from ..connectors.website import check_website
from ..db import add_event, now_iso, row, rows, session
from ..repo import (COMPANY_JSON, STATUSES, find_duplicate_names, get_company, merge_companies, profiles_of, rescore,
                    set_website_check, split_profile, status_label, upsert_profile)
from ..text import compact

router = APIRouter(prefix="/api")

SORTS = {"priority": "c.priority", "confidence": "c.confidence_score", "commercial": "c.commercial_score", "name": "c.name COLLATE NOCASE",
         "discovered": "c.discovered_at", "updated": "c.updated_at"}


def _company_summary(conn, c: dict[str, Any]) -> dict[str, Any]:
    ps = profiles_of(conn, c["id"])
    return {
        "id": c["id"], "name": c["name"], "activity_label": c["activity_label"], "activity_key": c["activity_key"], "city": c["city"],
        "status": c["status"], "status_label": status_label(c["status"]), "validated": bool(c["validated"]), "is_demo": bool(c["is_demo"]),
        "confidence_score": c["confidence_score"], "commercial_score": c["commercial_score"], "priority": c["priority"],
        "confidence_level": (c.get("confidence_detail") or {}).get("level"), "commercial_level": (c.get("commercial_detail") or {}).get("level"),
        "main_opportunity": (c.get("analysis") or {}).get("main_opportunity"), "services": (c.get("analysis") or {}).get("services", []),
        "priority_label": (c.get("analysis") or {}).get("priority"), "campaign_id": c["campaign_id"], "discovered_at": c["discovered_at"],
        "follow_up_at": c["follow_up_at"], "website": c["website"], "source": c["source"], "exported_at": c.get("exported_at"),
        "zone": (c.get("search_location") or {}).get("city") or (c.get("search_location") or {}).get("department_name") or (c.get("search_location") or {}).get("region_name"),
        "profiles": [{"id": p["id"], "platform": p["platform"], "handle": p["handle"], "url": p["url"], "api_verified": bool(p["api_verified"])} for p in ps],
    }


@router.get("/companies")
def list_companies(q: str = "", status: str = "", campaign_id: int | None = None, min_confidence: int = 0, min_commercial: int = 0,
                   platform: str = "", networks: str = "", demo: str = "include", validated: str = "", best: bool = False,
                   sort: str = "priority", order: str = "desc", limit: int = 200, offset: int = 0, search_id: int | None = None) -> dict[str, Any]:
    where, args = ["1=1"], []
    if q:
        where.append("(c.name LIKE ? OR c.city LIKE ? OR c.notes LIKE ? OR EXISTS (SELECT 1 FROM profiles p WHERE p.company_id=c.id AND p.handle LIKE ?))")
        args += [f"%{q}%"] * 4
    if status:
        sts = status.split(",")
        where.append(f"c.status IN ({','.join('?' * len(sts))})")
        args += sts
    if campaign_id:
        where.append("c.campaign_id=?")
        args.append(campaign_id)
    if search_id:
        where.append("c.search_id=?")
        args.append(search_id)
    if best:
        min_confidence, min_commercial = max(min_confidence, 75), max(min_commercial, 70)
        where.append("c.status NOT IN ('do_not_contact','not_interested')")
    if min_confidence:
        where.append("c.confidence_score>=?")
        args.append(min_confidence)
    if min_commercial:
        where.append("c.commercial_score>=?")
        args.append(min_commercial)
    if platform in ("instagram", "facebook"):
        where.append("EXISTS (SELECT 1 FROM profiles p WHERE p.company_id=c.id AND p.platform=?)")
        args.append(platform)
    if networks == "both":
        where.append("(SELECT COUNT(DISTINCT platform) FROM profiles p WHERE p.company_id=c.id)=2")
    elif networks == "single":
        where.append("(SELECT COUNT(DISTINCT platform) FROM profiles p WHERE p.company_id=c.id)=1")
    if demo == "exclude":
        where.append("c.is_demo=0")
    elif demo == "only":
        where.append("c.is_demo=1")
    if validated in ("0", "1"):
        where.append("c.validated=?")
        args.append(int(validated))
    order_sql = SORTS.get(sort, "c.priority") + (" ASC" if order == "asc" else " DESC")
    with session() as conn:
        total = conn.execute(f"SELECT COUNT(*) n FROM companies c WHERE {' AND '.join(where)}", args).fetchone()["n"]
        rs = rows(conn.execute(f"SELECT c.* FROM companies c WHERE {' AND '.join(where)} ORDER BY {order_sql}, c.id DESC LIMIT ? OFFSET ?",
                               [*args, min(limit, 1000), offset]).fetchall(), COMPANY_JSON)
        return {"total": total, "items": [_company_summary(conn, c) for c in rs]}


@router.get("/companies/{company_id}")
def company_detail(company_id: int) -> dict[str, Any]:
    with session() as conn:
        c = get_company(conn, company_id)
        if not c:
            raise HTTPException(404, "Entreprise introuvable")
        c["status_label"] = status_label(c["status"])
        c["profiles"] = profiles_of(conn, company_id)
        c["messages"] = rows(conn.execute("SELECT * FROM messages WHERE company_id=? ORDER BY id DESC", (company_id,)).fetchall())
        c["events"] = rows(conn.execute("SELECT * FROM events WHERE company_id=? ORDER BY id DESC LIMIT 200", (company_id,)).fetchall())
        c["suggestions"] = rows(conn.execute(
            "SELECT m.*, a.name a_name, b.name b_name FROM match_suggestions m JOIN companies a ON a.id=m.company_a JOIN companies b ON b.id=m.company_b "
            "WHERE m.status='pending' AND (m.company_a=? OR m.company_b=?)", (company_id, company_id)).fetchall(), ("reasons",))
        camp = conn.execute("SELECT id, name FROM campaigns WHERE id=?", (c["campaign_id"],)).fetchone() if c["campaign_id"] else None
        c["campaign"] = dict(camp) if camp else None
        return c


class CompanyPatch(BaseModel):
    status: str | None = None
    notes: str | None = None
    name: str | None = None
    city: str | None = None
    validated: bool | None = None
    follow_up_at: str | None = None
    campaign_id: int | None = None


@router.patch("/companies/{company_id}")
def patch_company(company_id: int, body: CompanyPatch) -> dict[str, Any]:
    with session() as conn:
        c = get_company(conn, company_id)
        if not c:
            raise HTTPException(404, "Entreprise introuvable")
        data = body.model_dump(exclude_unset=True)
        if "status" in data:
            if data["status"] not in STATUSES:
                raise HTTPException(400, "Statut inconnu")
            if data["status"] != c["status"]:
                add_event(conn, company_id, "status", f"{status_label(c['status'])} → {status_label(data['status'])}")
            if data["status"] == "do_not_contact":
                _suppress(conn, company_id, "Statut « Ne plus contacter »")
        if "notes" in data and data["notes"] != c["notes"]:
            add_event(conn, company_id, "note", "Notes mises à jour")
        if "name" in data:
            data["name_locked"] = 1
            add_event(conn, company_id, "edit", f"Nom corrigé : {data['name']}")
        if "city" in data:
            data["city_locked"] = 1 if data["city"] else 0
        if "validated" in data:
            data["validated"] = int(bool(data["validated"]))
            add_event(conn, company_id, "validation", "Identification validée manuellement" if data["validated"] else "Validation retirée")
        if "follow_up_at" in data and data["follow_up_at"]:
            add_event(conn, company_id, "follow_up", f"Relance prévue le {data['follow_up_at'][:10]}")
        if data:
            data["updated_at"] = now_iso()
            conn.execute(f"UPDATE companies SET {', '.join(f'{k}=?' for k in data)} WHERE id=?", [*data.values(), company_id])
        if "city" in data or "name" in data:
            rescore(conn, company_id)
    return company_detail(company_id)


@router.post("/companies/{company_id}/rescore")
def rescore_company(company_id: int) -> dict[str, Any]:
    with session() as conn:
        if not rescore(conn, company_id):
            raise HTTPException(404, "Entreprise introuvable")
    return company_detail(company_id)


@router.post("/companies/{company_id}/verify")
def verify_company(company_id: int) -> dict[str, Any]:
    """Vérification à la demande : API Meta (si configurée) + diagnostic du site, puis recalcul des scores."""
    notes: list[str] = []
    with session() as conn:
        c = get_company(conn, company_id)
        if not c:
            raise HTTPException(404, "Entreprise introuvable")
        ps = profiles_of(conn, company_id)
    for p in ps:
        try:
            if p["platform"] == "instagram" and meta.ig_ready():
                bd = meta.instagram_business_discovery(p["handle"])
                if bd:
                    media = (bd.get("media") or {}).get("data") or []
                    with session() as conn:
                        upsert_profile(conn, {"platform": "instagram", "handle": p["handle"], "url": p["url"], "display_name": bd.get("name"),
                                              "bio": bd.get("biography"), "website": bd.get("website"), "followers": bd.get("followers_count"),
                                              "following": bd.get("follows_count"), "posts": bd.get("media_count"),
                                              "last_post_at": media[0]["timestamp"] if media else None, "api_verified": True, "api_data": bd, "source": "meta_api"})
                    notes.append(f"Instagram @{p['handle']} vérifié via l'API Meta")
            elif p["platform"] == "facebook" and meta.fb_ready():
                page = meta.facebook_page(p["handle"])
                loc = page.get("location") or {}
                with session() as conn:
                    upsert_profile(conn, {"platform": "facebook", "handle": p["handle"], "url": p["url"], "display_name": page.get("name"),
                                          "bio": page.get("about"), "category": page.get("category"), "website": page.get("website"),
                                          "location": " ".join(str(loc.get(k, "")) for k in ("city", "zip")).strip() or None,
                                          "followers": page.get("followers_count"), "likes": page.get("fan_count"),
                                          "api_verified": True, "api_data": page, "source": "meta_api"})
                notes.append(f"Page Facebook {p['handle']} vérifiée via l'API Meta")
        except ConnectorError as e:
            notes.append(e.message)
    with session() as conn:
        c = rescore(conn, company_id)
    if c and c.get("website"):
        chk = check_website(c["website"])
        with session() as conn:
            set_website_check(conn, company_id, chk)
            rescore(conn, company_id)
        notes.append("Site analysé" if chk.get("reachable") else f"Site injoignable ({chk.get('error')})")
    if not notes:
        notes.append("Aucune source de vérification disponible (API Meta non configurée, aucun site connu)")
    with session() as conn:
        add_event(conn, company_id, "verify", " ; ".join(notes))
    return {"notes": notes, "company": company_detail(company_id)}


def _suppress(conn, company_id: int, reason: str) -> None:
    for p in profiles_of(conn, company_id):
        conn.execute("INSERT INTO suppression_list(platform, handle, name, reason, created_at) VALUES (?,?,?,?,?)",
                     (p["platform"], p["handle"], compact(p.get("display_name")), reason, now_iso()))


@router.delete("/companies/{company_id}")
def delete_company(company_id: int, suppress: bool = False, reason: str = "Suppression manuelle") -> dict[str, Any]:
    """Suppression définitive des données. Avec suppress=true, l'entreprise est ajoutée à la liste de suppression
    (opposition) : elle ne sera plus jamais redécouverte. Seuls l'identifiant et le nom normalisé sont conservés."""
    with session() as conn:
        if not get_company(conn, company_id):
            raise HTTPException(404, "Entreprise introuvable")
        if suppress:
            _suppress(conn, company_id, reason)
        conn.execute("DELETE FROM profiles WHERE company_id=?", (company_id,))
        conn.execute("DELETE FROM companies WHERE id=?", (company_id,))
        add_event(conn, None, "deleted", f"Entreprise #{company_id} supprimée ({reason}{', ajoutée à la liste de suppression' if suppress else ''})")
    return {"ok": True}


# --- Profils & rapprochements ---------------------------------------------------------------------------------------
class ProfilePatch(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    website: str | None = None
    location: str | None = None
    category: str | None = None


@router.patch("/profiles/{profile_id}")
def patch_profile(profile_id: int, body: ProfilePatch) -> dict[str, Any]:
    data = body.model_dump(exclude_unset=True)
    with session() as conn:
        p = row(conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone())
        if not p:
            raise HTTPException(404, "Profil introuvable")
        if data:
            data["source"] = "manual"
            data["updated_at"] = now_iso()
            conn.execute(f"UPDATE profiles SET {', '.join(f'{k}=?' for k in data)} WHERE id=?", [*data.values(), profile_id])
            add_event(conn, p["company_id"], "edit", f"Profil {p['platform']} @{p['handle']} complété manuellement")
            rescore(conn, p["company_id"])
        return {"company_id": p["company_id"]}


@router.post("/profiles/{profile_id}/split")
def split(profile_id: int) -> dict[str, Any]:
    with session() as conn:
        new_id = split_profile(conn, profile_id)
    if not new_id:
        raise HTTPException(400, "Ce profil ne peut pas être séparé (entreprise à un seul profil)")
    return {"company_id": new_id}


class MergeBody(BaseModel):
    keep_id: int
    remove_id: int


@router.post("/companies/merge")
def merge(body: MergeBody) -> dict[str, Any]:
    with session() as conn:
        if not get_company(conn, body.keep_id) or not get_company(conn, body.remove_id):
            raise HTTPException(404, "Entreprise introuvable")
        merge_companies(conn, body.keep_id, body.remove_id, "Fusion manuelle validée par l'utilisateur")
    return company_detail(body.keep_id)


@router.get("/matches")
def list_matches(status: str = "pending") -> list[dict[str, Any]]:
    with session() as conn:
        ms = rows(conn.execute("SELECT * FROM match_suggestions WHERE status=? ORDER BY score DESC, id DESC", (status,)).fetchall(), ("reasons",))
        out = []
        for m in ms:
            a, b = get_company(conn, m["company_a"]), get_company(conn, m["company_b"])
            if a and b:
                out.append({**m, "a": _company_summary(conn, a), "b": _company_summary(conn, b),
                            "a_profiles": profiles_of(conn, a["id"]), "b_profiles": profiles_of(conn, b["id"])})
        return out


@router.post("/matches/{match_id}/{decision}")
def decide_match(match_id: int, decision: str) -> dict[str, Any]:
    with session() as conn:
        m = row(conn.execute("SELECT * FROM match_suggestions WHERE id=?", (match_id,)).fetchone())
        if not m:
            raise HTTPException(404, "Suggestion introuvable")
        if decision == "accept":
            a, b = get_company(conn, m["company_a"]), get_company(conn, m["company_b"])
            # On conserve la fiche la plus avancée dans le suivi, sinon la plus ancienne
            keep, rem = (m["company_b"], m["company_a"]) if a and b and a["status"] == "new" and b["status"] != "new" else (m["company_a"], m["company_b"])
            merge_companies(conn, keep, rem, "Correspondance validée manuellement : " + " ; ".join(json.loads(m["reasons"])))
            return {"company_id": keep}
        if decision == "reject":
            conn.execute("UPDATE match_suggestions SET status='rejected', decided_at=? WHERE id=?", (now_iso(), match_id))
            conn.execute("INSERT INTO match_history(action, detail, created_at) VALUES (?,?,?)",
                         ("reject", json.dumps({"a": m["company_a"], "b": m["company_b"]}), now_iso()))
            return {"ok": True}
    raise HTTPException(400, "Décision inconnue")


@router.get("/matches/history")
def match_history() -> list[dict[str, Any]]:
    with session() as conn:
        return rows(conn.execute("SELECT * FROM match_history ORDER BY id DESC LIMIT 300").fetchall(), ("detail",))


@router.get("/duplicates")
def duplicates() -> list[dict[str, Any]]:
    with session() as conn:
        return find_duplicate_names(conn)


# --- Messages ------------------------------------------------------------------------------------------------------
class GenerateBody(BaseModel):
    channel: str = "instagram_dm"
    style: str = "professional"
    variant: int = 0
    template_id: int | None = None


@router.post("/companies/{company_id}/messages/generate")
def generate_message(company_id: int, body: GenerateBody) -> dict[str, Any]:
    if body.channel not in CHANNELS or body.style not in STYLES:
        raise HTTPException(400, "Canal ou style inconnu")
    with session() as conn:
        c = get_company(conn, company_id)
        if not c:
            raise HTTPException(404, "Entreprise introuvable")
        if c["status"] == "do_not_contact":
            raise HTTPException(400, "Cette entreprise ne doit plus être contactée")
        tpl = None
        if body.template_id:
            t = conn.execute("SELECT body FROM message_templates WHERE id=?", (body.template_id,)).fetchone()
            tpl = t["body"] if t else None
        ps = profiles_of(conn, company_id)
    out = generate(c, ps, body.channel, body.style, body.variant, tpl)
    ts = now_iso()
    with session() as conn:
        cur = conn.execute("INSERT INTO messages(company_id, channel, style, body, provider, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                           (company_id, body.channel, body.style, out["body"], out["provider"], ts, ts))
        if c["status"] in ("new", "to_contact"):
            conn.execute("UPDATE companies SET status='message_ready', updated_at=? WHERE id=?", (ts, company_id))
            add_event(conn, company_id, "status", f"{status_label(c['status'])} → {status_label('message_ready')}")
        add_event(conn, company_id, "message", f"Message {STYLES[body.style].lower()} préparé pour {CHANNELS[body.channel]} ({out['provider']})")
        msg = row(conn.execute("SELECT * FROM messages WHERE id=?", (cur.lastrowid,)).fetchone())
    return {**msg, "note": out["note"]}  # type: ignore[dict-item]


class MessagePatch(BaseModel):
    body: str | None = None
    status: str | None = None


@router.patch("/messages/{message_id}")
def patch_message(message_id: int, body: MessagePatch) -> dict[str, Any]:
    data = body.model_dump(exclude_unset=True)
    with session() as conn:
        m = row(conn.execute("SELECT * FROM messages WHERE id=?", (message_id,)).fetchone())
        if not m:
            raise HTTPException(404, "Message introuvable")
        if "body" in data and data["body"] != m["body"]:
            data["provider"] = m["provider"] if m["provider"].endswith("+edit") else m["provider"] + "+edit"
        data["updated_at"] = now_iso()
        conn.execute(f"UPDATE messages SET {', '.join(f'{k}=?' for k in data)} WHERE id=?", [*data.values(), message_id])
        return row(conn.execute("SELECT * FROM messages WHERE id=?", (message_id,)).fetchone()) or {}


@router.delete("/messages/{message_id}")
def delete_message(message_id: int) -> dict[str, Any]:
    with session() as conn:
        conn.execute("DELETE FROM messages WHERE id=?", (message_id,))
    return {"ok": True}


# --- File de prospection (envoi MANUEL) ---------------------------------------------------------------------------
@router.get("/queue")
def queue(campaign_id: int | None = None, include_demo: bool = True, min_confidence: int = 0) -> dict[str, Any]:
    now = now_iso()
    where = ["(c.status IN ('to_contact','message_ready') OR (c.status='follow_up' AND (c.follow_up_at IS NULL OR c.follow_up_at<=?)))",
             "(c.follow_up_at IS NULL OR c.follow_up_at<=? OR c.status<>'message_ready')"]
    args: list[Any] = [now, now]
    if campaign_id:
        where.append("c.campaign_id=?")
        args.append(campaign_id)
    if not include_demo:
        where.append("c.is_demo=0")
    if min_confidence:
        where.append("c.confidence_score>=?")
        args.append(min_confidence)
    with session() as conn:
        cs = rows(conn.execute(f"SELECT c.* FROM companies c WHERE {' AND '.join(where)} ORDER BY c.priority DESC LIMIT 300", args).fetchall(), COMPANY_JSON)
        items = []
        for c in cs:
            msg = row(conn.execute("SELECT * FROM messages WHERE company_id=? AND status='draft' ORDER BY id DESC LIMIT 1", (c["id"],)).fetchone())
            items.append({**_company_summary(conn, c), "message": msg})
        postponed = conn.execute("SELECT COUNT(*) n FROM companies WHERE follow_up_at>? AND status IN ('message_ready','to_contact','follow_up')", (now,)).fetchone()["n"]
        return {"items": items, "postponed": postponed}


class QueueAction(BaseModel):
    message_id: int | None = None
    days: int = 3
    platform: str | None = None


@router.post("/queue/{company_id}/{action}")
def queue_action(company_id: int, action: str, body: QueueAction) -> dict[str, Any]:
    ts = now_iso()
    with session() as conn:
        c = get_company(conn, company_id)
        if not c:
            raise HTTPException(404, "Entreprise introuvable")
        if action == "sent":
            if body.message_id:
                conn.execute("UPDATE messages SET status='sent', sent_at=? WHERE id=? AND company_id=?", (ts, body.message_id, company_id))
            conn.execute("UPDATE companies SET status='contacted', follow_up_at=?, updated_at=? WHERE id=?",
                         ((datetime.now(timezone.utc) + timedelta(days=7)).replace(microsecond=0).isoformat(), ts, company_id))
            add_event(conn, company_id, "sent", f"Message envoyé manuellement{' sur ' + body.platform if body.platform else ''}")
        elif action == "postpone":
            until = (datetime.now(timezone.utc) + timedelta(days=max(1, body.days))).replace(microsecond=0).isoformat()
            conn.execute("UPDATE companies SET follow_up_at=?, updated_at=? WHERE id=?", (until, ts, company_id))
            add_event(conn, company_id, "postpone", f"Reporté au {until[:10]}")
        elif action == "ignore":
            conn.execute("UPDATE companies SET status='not_interested', updated_at=? WHERE id=?", (ts, company_id))
            add_event(conn, company_id, "ignore", "Ignoré depuis la file de prospection")
        elif action == "enqueue":
            if c["status"] in ("new",):
                conn.execute("UPDATE companies SET status='to_contact', updated_at=? WHERE id=?", (ts, company_id))
                add_event(conn, company_id, "status", "Nouveau → À contacter")
        elif action == "opened":
            add_event(conn, company_id, "opened", f"Profil ouvert{' (' + body.platform + ')' if body.platform else ''}")
        else:
            raise HTTPException(400, "Action inconnue")
    return {"ok": True}


@router.post("/companies/bulk/enqueue")
def bulk_enqueue(ids: list[int]) -> dict[str, Any]:
    ts = now_iso()
    n = 0
    with session() as conn:
        for cid in ids:
            c = get_company(conn, cid)
            if c and c["status"] == "new":
                conn.execute("UPDATE companies SET status='to_contact', updated_at=? WHERE id=?", (ts, cid))
                add_event(conn, cid, "status", "Nouveau → À contacter")
                n += 1
    return {"updated": n}


@router.get("/events")
def recent_events(limit: int = 50) -> list[dict[str, Any]]:
    with session() as conn:
        return rows(conn.execute("SELECT e.*, c.name company_name FROM events e LEFT JOIN companies c ON c.id=e.company_id ORDER BY e.id DESC LIMIT ?",
                                 (min(limit, 500),)).fetchall())


__all__ = ["router"]
