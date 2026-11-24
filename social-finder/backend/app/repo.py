"""Accès aux données métier : profils, entreprises, rapprochements, recalcul des scores."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from .analysis import analyze
from .db import add_event, now_iso, row, rows
from .discovery.matching import compare_profiles
from .referentials import department_name, detect_activity, region_of_department
from .scoring.commercial import compute_commercial
from .scoring.common import priority
from .scoring.confidence import compute_confidence
from .scoring.facts import build_facts
from .social_urls import extract_website
from .text import compact, norm

COMPANY_JSON = ("confidence_detail", "commercial_detail", "analysis", "website_check", "search_location")
PROFILE_JSON = ("mentioned_handles", "api_data")
STATUSES = ["new", "to_contact", "message_ready", "contacted", "replied", "interested", "not_interested", "follow_up", "do_not_contact"]
STATUS_LABELS = {"new": "Nouveau", "to_contact": "À contacter", "message_ready": "Message préparé", "contacted": "Contacté",
                 "replied": "Réponse reçue", "interested": "Intéressé", "not_interested": "Non intéressé", "follow_up": "À relancer",
                 "do_not_contact": "Ne plus contacter"}


# --- Liste de suppression (oppositions) ---------------------------------------------------------------------------
def is_suppressed(conn: sqlite3.Connection, platform: str | None, handle: str | None, name: str | None = None) -> bool:
    if handle and conn.execute("SELECT 1 FROM suppression_list WHERE platform=? AND handle=?", (platform, handle.lower())).fetchone():
        return True
    if name:
        n = compact(name)
        if n and conn.execute("SELECT 1 FROM suppression_list WHERE handle IS NULL AND name=?", (n,)).fetchone():
            return True
    return False


# --- Profils -------------------------------------------------------------------------------------------------------
def get_profile(conn: sqlite3.Connection, platform: str, handle: str) -> dict[str, Any] | None:
    return row(conn.execute("SELECT * FROM profiles WHERE platform=? AND handle=?", (platform, handle.lower())).fetchone(), PROFILE_JSON)


def upsert_profile(conn: sqlite3.Connection, data: dict[str, Any]) -> tuple[int, bool]:
    """Insère ou complète un profil (jamais d'écrasement d'une donnée vérifiée par une donnée indexée)."""
    existing = get_profile(conn, data["platform"], data["handle"])
    ts = now_iso()
    fields = ["display_name", "bio", "category", "location", "website", "followers", "following", "posts", "likes", "checkins",
              "last_post_at", "title", "snippet", "search_query"]
    if existing is None:
        cols = ["platform", "handle", "url", "source", "discovered_at", "updated_at", "mentioned_handles", "api_verified", "api_data", *fields]
        vals = [data["platform"], data["handle"].lower(), data["url"], data.get("source", "manual"), ts, ts,
                json.dumps(data.get("mentioned_handles") or []), int(bool(data.get("api_verified"))),
                json.dumps(data["api_data"]) if data.get("api_data") else None, *[data.get(f) for f in fields]]
        cur = conn.execute(f"INSERT INTO profiles({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", vals)
        return int(cur.lastrowid), True
    updates: dict[str, Any] = {}
    verified = bool(existing["api_verified"])
    for f in fields:
        v = data.get(f)
        if v in (None, ""):
            continue
        if existing.get(f) in (None, "") or (data.get("api_verified") or not verified):
            updates[f] = v
    mentions = sorted(set(existing.get("mentioned_handles") or []) | set(data.get("mentioned_handles") or []))
    updates["mentioned_handles"] = json.dumps(mentions)
    if data.get("api_verified"):
        updates["api_verified"] = 1
        updates["api_data"] = json.dumps(data.get("api_data") or {})
    updates["updated_at"] = ts
    conn.execute(f"UPDATE profiles SET {', '.join(f'{k}=?' for k in updates)} WHERE id=?", [*updates.values(), existing["id"]])
    return int(existing["id"]), False


def profiles_of(conn: sqlite3.Connection, company_id: int) -> list[dict[str, Any]]:
    return rows(conn.execute("SELECT * FROM profiles WHERE company_id=? ORDER BY platform DESC", (company_id,)).fetchall(), PROFILE_JSON)


# --- Entreprises ---------------------------------------------------------------------------------------------------
def get_company(conn: sqlite3.Connection, company_id: int) -> dict[str, Any] | None:
    return row(conn.execute("SELECT * FROM companies WHERE id=?", (company_id,)).fetchone(), COMPANY_JSON)


def create_company(conn: sqlite3.Connection, profile_id: int, ctx: dict[str, Any]) -> int:
    p = row(conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone(), PROFILE_JSON)
    assert p is not None
    ts = now_iso()
    loc = ctx.get("location") or {}
    cur = conn.execute(
        "INSERT INTO companies(name, search_activity, search_location, campaign_id, search_id, source, discovered_at, updated_at, is_demo, city, department, region) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (p.get("display_name") or p["handle"], ctx.get("activity_key"), json.dumps(loc), ctx.get("campaign_id"), ctx.get("search_id"),
         ctx.get("source") or p["source"], ts, ts, int(bool(ctx.get("is_demo"))), loc.get("city"), loc.get("department"),
         loc.get("region_name")))
    cid = int(cur.lastrowid)
    conn.execute("UPDATE profiles SET company_id=? WHERE id=?", (cid, profile_id))
    add_event(conn, cid, "discovered", f"Découvert via {p['source']} ({p['platform']} @{p['handle']})")
    return cid


def _best_name(profiles: list[dict[str, Any]]) -> str | None:
    ranked = sorted(profiles, key=lambda p: (not p.get("api_verified"), p["platform"] != "instagram"))
    for p in ranked:
        if p.get("display_name"):
            return p["display_name"]
    return ranked[0]["handle"] if ranked else None


def _website(profiles: list[dict[str, Any]]) -> str | None:
    for p in sorted(profiles, key=lambda p: not p.get("api_verified")):
        if p.get("website"):
            return p["website"]
    for p in profiles:
        w = extract_website(p.get("bio")) or extract_website(p.get("snippet"))
        if w:
            return w
    return None


def rescore(conn: sqlite3.Connection, company_id: int) -> dict[str, Any] | None:
    """Recalcule les champs dérivés, les deux scores, la priorité et l'analyse. Reproductible : mêmes faits → mêmes scores."""
    c = get_company(conn, company_id)
    if c is None:
        return None
    profiles = profiles_of(conn, company_id)
    if not profiles:
        conn.execute("DELETE FROM companies WHERE id=?", (company_id,))
        return None
    if not c.get("name_locked"):
        c["name"] = _best_name(profiles) or c["name"]
    site = _website(profiles) or c.get("website")
    if site != c.get("website"):
        c["website"] = site
        c["website_check"] = None
    facts = build_facts({**c, "search_location": c.get("search_location")}, profiles)
    conf = compute_confidence(facts)
    com = compute_commercial(facts)
    loc_crit = next(cr for cr in conf["criteria"] if cr["key"] == "location")
    # La ville n'est affichée que si le profil la confirme (sinon : zone recherchée seulement)
    city_ok = facts.target_city if facts.target_city and any("ville" in e["text"] and e["points"] > 0 for e in loc_crit["evidence"]) else None
    city = c.get("city") if c.get("city_locked") else city_ok
    ana = analyze(facts, conf, com, city)
    act = facts.activity() or detect_activity(" ".join(p.get("display_name") or "" for p in profiles))
    dep = c.get("department")
    conn.execute(
        "UPDATE companies SET city=?, name=?, website=?, website_check=?, activity_key=?, activity_label=?, description=?, region=?, "
        "confidence_score=?, confidence_detail=?, commercial_score=?, commercial_detail=?, priority=?, analysis=?, updated_at=? WHERE id=?",
        (city, c["name"], c.get("website"), json.dumps(c["website_check"]) if c.get("website_check") else None,
         act.key if act else None, act.label if act else None,
         next((p["bio"] for p in profiles if p.get("bio")), None), c.get("region") or region_of_department(dep),
         conf["score"], json.dumps(conf), com["score"], json.dumps(com), priority(conf["score"], com["score"]), json.dumps(ana), now_iso(), company_id))
    return get_company(conn, company_id)


def set_website_check(conn: sqlite3.Connection, company_id: int, check: dict[str, Any]) -> None:
    conn.execute("UPDATE companies SET website_check=? WHERE id=?", (json.dumps(check), company_id))


# --- Rapprochement / fusion --------------------------------------------------------------------------------------
def merge_companies(conn: sqlite3.Connection, keep_id: int, remove_id: int, reason: str, auto: bool = False) -> None:
    if keep_id == remove_id:
        return
    keep, rem = get_company(conn, keep_id), get_company(conn, remove_id)
    if not keep or not rem:
        return
    conn.execute("UPDATE profiles SET company_id=? WHERE company_id=?", (keep_id, remove_id))
    conn.execute("UPDATE messages SET company_id=? WHERE company_id=?", (keep_id, remove_id))
    conn.execute("UPDATE events SET company_id=? WHERE company_id=?", (keep_id, remove_id))
    if rem.get("notes"):
        conn.execute("UPDATE companies SET notes = trim(notes || char(10) || ?) WHERE id=?", (rem["notes"], keep_id))
    if STATUSES.index(rem["status"]) > STATUSES.index(keep["status"]):
        conn.execute("UPDATE companies SET status=? WHERE id=?", (rem["status"], keep_id))
    conn.execute("UPDATE match_suggestions SET status='merged', decided_at=? WHERE status='pending' AND "
                 "((company_a=? AND company_b=?) OR (company_a=? AND company_b=?))", (now_iso(), keep_id, remove_id, remove_id, keep_id))
    conn.execute("DELETE FROM match_suggestions WHERE company_a=? OR company_b=?", (remove_id, remove_id))
    conn.execute("DELETE FROM companies WHERE id=?", (remove_id,))
    detail = json.dumps({"keep": keep_id, "keep_name": keep["name"], "removed": remove_id, "removed_name": rem["name"], "reason": reason}, ensure_ascii=False)
    conn.execute("INSERT INTO match_history(action, detail, created_at) VALUES (?,?,?)", ("auto_link" if auto else "merge", detail, now_iso()))
    add_event(conn, keep_id, "merged", f"{'Rapprochement automatique' if auto else 'Fusion manuelle'} avec « {rem['name']} » : {reason}")
    rescore(conn, keep_id)


def split_profile(conn: sqlite3.Connection, profile_id: int) -> int | None:
    p = row(conn.execute("SELECT * FROM profiles WHERE id=?", (profile_id,)).fetchone())
    if not p or not p["company_id"]:
        return None
    old = get_company(conn, p["company_id"])
    if not old or len(profiles_of(conn, old["id"])) < 2:
        return None
    ctx = {"activity_key": old.get("search_activity"), "location": old.get("search_location") or {}, "campaign_id": old.get("campaign_id"),
           "search_id": old.get("search_id"), "is_demo": old.get("is_demo")}
    new_id = create_company(conn, profile_id, ctx)
    conn.execute("INSERT INTO match_history(action, detail, created_at) VALUES (?,?,?)",
                 ("split", json.dumps({"from": old["id"], "new": new_id, "profile": f"{p['platform']}:@{p['handle']}"}, ensure_ascii=False), now_iso()))
    add_event(conn, old["id"], "split", f"Profil {p['platform']} @{p['handle']} séparé")
    rescore(conn, old["id"])
    rescore(conn, new_id)
    return new_id


def match_company(conn: sqlite3.Connection, company_id: int) -> dict[str, int]:
    """Cherche l'autre réseau de cette entreprise parmi les entreprises connues. Fusion auto si preuve forte,
    sinon suggestion pour validation humaine."""
    stats = {"auto": 0, "suggested": 0, "into": company_id}
    c = get_company(conn, company_id)
    if not c:
        return stats
    mine = profiles_of(conn, company_id)
    platforms = {p["platform"] for p in mine}
    if len(platforms) != 1:
        return stats
    other_platform = "facebook" if "instagram" in platforms else "instagram"
    city = (c.get("search_location") or {}).get("city")
    me = mine[0]
    candidates = rows(conn.execute(
        "SELECT p.*, c.is_demo FROM profiles p JOIN companies c ON c.id=p.company_id WHERE p.platform=? AND p.company_id<>? "
        "AND (SELECT COUNT(DISTINCT platform) FROM profiles x WHERE x.company_id=p.company_id)=1 AND c.is_demo=?",
        (other_platform, company_id, c["is_demo"])).fetchall(), PROFILE_JSON)
    rejected = {(r["company_a"], r["company_b"]) for r in conn.execute("SELECT company_a, company_b FROM match_suggestions WHERE status='rejected'")}
    best = None
    for cand in candidates:
        ig, fb = (me, cand) if me["platform"] == "instagram" else (cand, me)
        v = compare_profiles(ig, fb, city)
        pair = tuple(sorted((company_id, cand["company_id"])))
        if pair in rejected or v.score < 40:
            continue
        if best is None or v.score > best[0].score:
            best = (v, cand, pair)
    if best:
        v, cand, pair = best
        if v.auto:
            merge_companies(conn, cand["company_id"], company_id, " ; ".join(v.reasons), auto=True)
            stats["auto"] += 1
            stats["into"] = cand["company_id"]
        else:
            conn.execute("INSERT OR IGNORE INTO match_suggestions(company_a, company_b, score, reasons, created_at) VALUES (?,?,?,?,?)",
                         (pair[0], pair[1], v.score, json.dumps(v.reasons, ensure_ascii=False), now_iso()))
            stats["suggested"] += 1
    return stats


def find_duplicate_names(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Entreprises au nom très proche (même plateforme ou non) : doublons potentiels à vérifier."""
    from .text import name_similarity
    cs = rows(conn.execute("SELECT id, name, city, is_demo FROM companies").fetchall())
    out = []
    for i, a in enumerate(cs):
        for b in cs[i + 1:]:
            if a["is_demo"] != b["is_demo"]:
                continue
            sim = name_similarity(a["name"], b["name"])
            if sim >= 0.9 and norm(a.get("city")) == norm(b.get("city")):
                out.append({"a": a, "b": b, "similarity": sim})
    return out[:200]


def status_label(s: str) -> str:
    return STATUS_LABELS.get(s, s)


def location_payload(city: str | None, department: str | None, region: str | None, platforms: list[str]) -> dict[str, Any]:
    from .referentials import REGIONS
    return {"city": city or None, "department": department or None, "department_name": department_name(department),
            "region": region or None, "region_name": REGIONS.get(region or "") or region_of_department(department), "platforms": platforms}

