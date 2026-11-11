"""Lien avec Paysapro Prospection : fichier CSV prêt à importer dans l'espace Signe & Seine.

Les en-têtes reprennent EXACTEMENT les libellés que l'import de Prospection reconnaît tout seul
(src/domain/mapping.ts : « Nom entreprise », « Ville », « Departement », « Activite », « Site web »,
« Facebook », « Instagram », « URL source »). Prospection se charge ensuite des coordonnées (e-mail,
téléphone, SIRENE) — Social Finder ne les cherche pas.

Les scores et l'opportunité n'ont pas de champ équivalent dans Prospection : ils sont ajoutés en colonnes
d'information préfixées « SF » (ignorées à l'import, lisibles dans le fichier). Ces libellés ont été choisis
pour ne jamais être confondus avec un champ de Prospection (pas de « note », « site », « services »…).

Jamais exportées : les données de démonstration et les entreprises « Ne plus contacter » ou en opposition.
"""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any

from .db import add_event, now_iso, rows
from .repo import COMPANY_JSON, STATUS_LABELS

# Contrat partagé avec Paysapro Prospection (vérifié des deux côtés par les tests)
_SPEC = json.loads((Path(__file__).resolve().parents[2] / "prospection-import.json").read_text(encoding="utf-8"))
MAPPED: list[str] = list(_SPEC["mapped"])
HEADERS: list[str] = MAPPED + list(_SPEC["informative"])


def select(conn, ids: list[int] | None = None, min_confidence: int = 50, min_commercial: int = 0,
           campaign_id: int | None = None, only_new: bool = False) -> list[dict[str, Any]]:
    where = ["is_demo=0", "status<>'do_not_contact'"]
    args: list[Any] = []
    if ids:
        where.append(f"id IN ({','.join('?' * len(ids))})")
        args += ids
    else:
        where += ["confidence_score>=?", "commercial_score>=?"]
        args += [min_confidence, min_commercial]
        if campaign_id:
            where.append("campaign_id=?")
            args.append(campaign_id)
        if only_new:
            where.append("exported_at IS NULL")
    return rows(conn.execute(f"SELECT * FROM companies WHERE {' AND '.join(where)} ORDER BY priority DESC", args).fetchall(), COMPANY_JSON)


def build_csv(conn, companies: list[dict[str, Any]], mark: bool = True) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(HEADERS)
    ts = now_iso()
    for c in companies:
        urls = {p["platform"]: p["url"] for p in conn.execute("SELECT platform, url FROM profiles WHERE company_id=? ORDER BY api_verified DESC", (c["id"],))}
        loc = c.get("search_location") or {}
        opp = ((c.get("analysis") or {}).get("main_opportunity") or {}).get("text") or ""
        w.writerow([
            c["name"], c["city"] or "", c["department"] or loc.get("department") or "", c["activity_label"] or "", c["website"] or "",
            urls.get("facebook", ""), urls.get("instagram", ""), urls.get("instagram") or urls.get("facebook") or "",
            c["confidence_score"], c["commercial_score"], c["priority"], opp, STATUS_LABELS.get(c["status"], c["status"]), (c["discovered_at"] or "")[:10],
        ])
        if mark:
            conn.execute("UPDATE companies SET exported_at=? WHERE id=?", (ts, c["id"]))
            add_event(conn, c["id"], "export_prospection", "Envoyé vers Paysapro Prospection (fichier d'import)")
    return "﻿" + buf.getvalue()
