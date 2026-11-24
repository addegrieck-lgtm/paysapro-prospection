"""Moteur de découverte avec un connecteur de test (aucun appel réseau) et parcours complet par l'API."""
import pytest

from app import settings_store
from app.connectors.base import ConnectorError, SearchResult
from app.db import session
from app.discovery import engine


class FakeConnector:
    id = "fake"
    label = "Moteur de test"
    max_offset_pages = 1

    def __init__(self, pages):
        self.pages = pages
        self.calls = []

    def is_ready(self):
        return True

    def search(self, query, page=0):
        self.calls.append(query)
        return self.pages.get(query.split(" site:")[1], [])


RESULTS = {
    "instagram.com": [
        SearchResult("Le Petit Quai (@lepetitquai) • Instagram photos and videos", "https://www.instagram.com/lepetitquai/",
                     '820 Followers, 300 Following, 64 Posts - Le Petit Quai (@lepetitquai) on Instagram: "Restaurant bistronomique au Havre"'),
        SearchResult("Chez Marcel (@chezmarcel.lehavre) • Instagram", "https://www.instagram.com/chezmarcel.lehavre/",
                     "150 Followers, 20 Following, 12 Posts - Chez Marcel (@chezmarcel.lehavre) on Instagram: \"Brasserie, Le Havre. Nouvelle adresse !\""),
        SearchResult("Une publication", "https://www.instagram.com/p/abc/", "post"),
        SearchResult("Autre site", "https://www.tripadvisor.fr/x", "annuaire"),
    ],
    "facebook.com": [
        SearchResult("Le Petit Quai | Le Havre - Facebook", "https://www.facebook.com/lepetitquai76/",
                     "Le Petit Quai, Le Havre. 1 350 J’aime · 120 personnes étaient ici. Restaurant. Insta @lepetitquai"),
        SearchResult("Pizzeria Roma - Accueil | Facebook", "https://fr-fr.facebook.com/pizzeriaroma.lh/", "Pizzeria Roma, Le Havre. 500 J’aime."),
    ],
}

PARAMS = {"activities": ["restaurant"], "city": "Le Havre", "department": "76", "platforms": ["instagram", "facebook"], "target": 10}


@pytest.fixture
def fake(monkeypatch):
    conn = FakeConnector(RESULTS)
    monkeypatch.setattr(engine, "ready_search_connectors", lambda: [conn])
    settings_store.update({"website_check_enabled": False, "geo_api_enabled": False})
    return conn


def companies():
    with session() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM companies ORDER BY id")]


def test_discovery_extracts_profiles_merges_and_scores(fake):
    sid = engine.start_search(PARAMS, background=False)
    cs = companies()
    names = sorted(c["name"] for c in cs)
    assert names == ["Chez Marcel", "Le Petit Quai", "Pizzeria Roma"]
    quai = next(c for c in cs if c["name"] == "Le Petit Quai")
    with session() as conn:
        nets = {r["platform"] for r in conn.execute("SELECT platform FROM profiles WHERE company_id=?", (quai["id"],))}
        hist = conn.execute("SELECT action FROM match_history").fetchall()
        s = dict(conn.execute("SELECT * FROM searches WHERE id=?", (sid,)).fetchone())
    assert nets == {"instagram", "facebook"}  # rapprochement automatique grâce à la mention @lepetitquai
    assert [h["action"] for h in hist] == ["auto_link"]
    assert quai["confidence_score"] >= 75
    assert s["status"] == "done"
    import json
    assert json.loads(s["stats"])["ignored_urls"] >= 2  # publication + annuaire ignorés


def test_second_search_does_not_duplicate(fake):
    engine.start_search(PARAMS, background=False)
    engine.start_search(PARAMS, background=False)
    assert len(companies()) == 3


def test_suppression_list_is_respected(fake, client):
    client.post("/api/suppression", json={"url": "https://www.instagram.com/chezmarcel.lehavre/", "reason": "Opposition"})
    engine.start_search(PARAMS, background=False)
    assert "Chez Marcel" not in [c["name"] for c in companies()]


def test_campaign_resume_skips_done_queries(fake, client):
    r = client.post("/api/searches", json={**PARAMS, "campaign_name": "Restaurants au Havre"}).json()
    import time
    for _ in range(50):
        if client.get(f"/api/searches/{r['search_id']}").json()["status"] != "running":
            break
        time.sleep(0.05)
    first_calls = len(fake.calls)
    r2 = client.post(f"/api/campaigns/{r['campaign_id']}/resume").json()
    for _ in range(50):
        if client.get(f"/api/searches/{r2['search_id']}").json()["status"] != "running":
            break
        time.sleep(0.05)
    new_calls = fake.calls[first_calls:]
    assert first_calls > 0
    assert 'restaurant "Le Havre" site:instagram.com' not in new_calls
    camp = client.get(f"/api/campaigns/{r['campaign_id']}").json()
    assert camp["stats"]["discovered"] == 3 and camp["stats"]["searches"] == 2


def test_no_source_is_reported_without_fake_results(client):
    settings_store.update({"brave_api_key": "", "google_cse_key": "", "relay_url": ""})
    sid = engine.start_search(PARAMS, background=False)
    s = client.get(f"/api/searches/{sid}").json()
    assert s["status"] == "no_source"
    assert companies() == []
    assert s["stats"]["assisted_queries"][0]["links"]["google"].startswith("https://www.google.com/search?q=")


def test_quota_error_falls_back_to_next_connector(monkeypatch):
    class Broken(FakeConnector):
        label = "En panne"

        def search(self, query, page=0):
            raise ConnectorError("quota", "quota atteint")

    ok = FakeConnector(RESULTS)
    monkeypatch.setattr(engine, "ready_search_connectors", lambda: [Broken({}), ok])
    settings_store.update({"website_check_enabled": False, "geo_api_enabled": False})
    engine.start_search(PARAMS, background=False)
    assert len(companies()) == 3 and ok.calls


def test_filters_both_networks(fake):
    sid = engine.start_search({**PARAMS, "filters": {"both_networks": True}}, background=False)
    with session() as conn:
        import json
        stats = json.loads(conn.execute("SELECT stats FROM searches WHERE id=?", (sid,)).fetchone()["stats"])
    assert stats["qualified"] == 1


def test_full_workflow_api(fake, client):
    engine.start_search(PARAMS, background=False)
    best = client.get("/api/companies", params={"min_confidence": 75}).json()
    assert best["total"] >= 1
    cid = best["items"][0]["id"]
    detail = client.get(f"/api/companies/{cid}").json()
    assert detail["confidence_detail"]["criteria"][0]["evidence"]
    assert detail["analysis"]["summary"]
    # Message Studio
    m = client.post(f"/api/companies/{cid}/messages/generate", json={"channel": "instagram_dm", "style": "friendly"}).json()
    assert m["body"] and m["provider"] == "templates"
    m2 = client.post(f"/api/companies/{cid}/messages/generate", json={"channel": "instagram_dm", "style": "friendly", "variant": 1}).json()
    assert m2["id"] != m["id"]
    edited = client.patch(f"/api/messages/{m['id']}", json={"body": "Bonjour, message modifié."}).json()
    assert edited["provider"] == "templates+edit"
    # File de prospection et envoi manuel
    q = client.get("/api/queue").json()
    assert cid in [i["id"] for i in q["items"]]
    client.post(f"/api/queue/{cid}/sent", json={"message_id": m["id"], "platform": "instagram"})
    d = client.get(f"/api/companies/{cid}").json()
    assert d["status"] == "contacted"
    assert any(e["type"] == "sent" for e in d["events"])
    # Suivi
    client.patch(f"/api/companies/{cid}", json={"status": "interested", "notes": "Rappeler mardi"})
    dash = client.get("/api/dashboard").json()
    assert dash["kpi"]["interested"] == 1 and dash["kpi"]["messages_sent"] == 1
    # Export CSV
    csv_text = client.get("/api/export/companies.csv").text
    assert "Score de confiance" in csv_text and "Le Petit Quai" in csv_text


def test_manual_split_and_merge(fake, client):
    engine.start_search(PARAMS, background=False)
    quai = next(c for c in companies() if c["name"] == "Le Petit Quai")
    d = client.get(f"/api/companies/{quai['id']}").json()
    fb = next(p for p in d["profiles"] if p["platform"] == "facebook")
    new_id = client.post(f"/api/profiles/{fb['id']}/split").json()["company_id"]
    assert len(companies()) == 4
    client.post("/api/companies/merge", json={"keep_id": quai["id"], "remove_id": new_id})
    assert len(companies()) == 3
    actions = [h["action"] for h in client.get("/api/matches/history").json()]
    assert actions[:2] == ["merge", "split"]


def test_rgpd_opposition_deletes_and_blocks(fake, client):
    engine.start_search(PARAMS, background=False)
    roma = next(c for c in companies() if c["name"] == "Pizzeria Roma")
    client.delete(f"/api/companies/{roma['id']}", params={"suppress": True, "reason": "Demande d'opposition"})
    assert "Pizzeria Roma" not in [c["name"] for c in companies()]
    engine.start_search(PARAMS, background=False)
    assert "Pizzeria Roma" not in [c["name"] for c in companies()]
    assert len(client.get("/api/suppression").json()) == 1


def test_do_not_contact_blocks_messages(fake, client):
    engine.start_search(PARAMS, background=False)
    cid = companies()[0]["id"]
    client.patch(f"/api/companies/{cid}", json={"status": "do_not_contact"})
    r = client.post(f"/api/companies/{cid}/messages/generate", json={"channel": "messenger", "style": "professional"})
    assert r.status_code == 400


def test_settings_secrets_are_masked(client):
    client.put("/api/settings", json={"brave_api_key": "abcdef123456"})
    s = client.get("/api/settings").json()
    assert s["brave_api_key"] == "••••3456"
    client.put("/api/settings", json={"brave_api_key": "••••3456", "sender_name": "Alex"})
    assert settings_store.get("brave_api_key") == "abcdef123456"


def test_demo_data_is_flagged_and_removable(client):
    assert client.post("/api/demo/load").json()["created"] >= 5
    items = client.get("/api/companies").json()["items"]
    assert items and all(i["is_demo"] for i in items)
    assert client.get("/api/dashboard").json()["kpi"]["total"] == 0  # démo exclue des statistiques réelles
    client.post("/api/demo/clear")
    assert client.get("/api/companies").json()["total"] == 0


def test_validation_errors(client):
    assert client.post("/api/searches", json={"activities": [], "city": "Rouen"}).status_code == 400
    assert client.post("/api/searches", json={"activities": ["restaurant"]}).status_code == 400


def test_export_to_prospection(fake, client):
    import csv
    import io
    from app.prospection_export import HEADERS
    engine.start_search(PARAMS, background=False)
    client.post("/api/demo/load")
    preview = client.get("/api/export/prospection.csv", params={"min_confidence": 0, "preview": True}).json()
    assert preview["count"] == 3  # démo jamais exportée
    text = client.get("/api/export/prospection.csv", params={"min_confidence": 0}).text
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿")), delimiter=";"))
    assert rows[0] == HEADERS
    quai = next(r for r in rows[1:] if r[0] == "Le Petit Quai")
    assert quai[5].startswith("https://www.facebook.com/") and quai[6] == "https://www.instagram.com/lepetitquai/"
    assert quai[2] == "76" and quai[3] == "Restaurant"
    # Marquage : « nouveaux uniquement » ne renvoie plus rien
    again = client.get("/api/export/prospection.csv", params={"min_confidence": 0, "only_new": True, "preview": True}).json()
    assert again["count"] == 0
    cid = next(c["id"] for c in companies() if c["name"] == "Le Petit Quai")
    assert any(e["type"] == "export_prospection" for e in client.get(f"/api/companies/{cid}").json()["events"])
    # « Ne plus contacter » n'est jamais exporté
    client.patch(f"/api/companies/{cid}", json={"status": "do_not_contact"})
    assert client.get("/api/export/prospection.csv", params={"ids": str(cid), "preview": True}).json()["count"] == 0
