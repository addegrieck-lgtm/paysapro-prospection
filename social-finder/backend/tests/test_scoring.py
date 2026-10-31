from datetime import date

from app.scoring.commercial import compute_commercial
from app.scoring.common import priority
from app.scoring.confidence import compute_confidence
from app.scoring.facts import build_facts

LOC = {"city": "Le Havre", "department": "76", "region": "28", "platforms": ["instagram", "facebook"]}


def profile(**kw):
    base = {"platform": "instagram", "handle": "x", "url": "https://www.instagram.com/x/", "display_name": None, "bio": None, "source": "search:brave",
            "mentioned_handles": [], "api_verified": 0}
    base.update(kw)
    return base


def facts(profiles, activity="restaurant", **company):
    c = {"name": "x", "search_activity": activity, "search_location": LOC, "website": None, "website_check": None}
    c.update(company)
    return build_facts(c, profiles, today=date(2026, 10, 31))


def crit(result, key):
    return next(c for c in result["criteria"] if c["key"] == key)


def test_unknown_information_gives_zero_points():
    f = facts([profile(handle="abc123")])
    conf = compute_confidence(f)
    assert conf["score"] == 0
    assert all(c["points"] == 0 for c in conf["criteria"])
    assert "Nom affiché du profil" in conf["missing"]


def test_full_identification_with_cross_links():
    ig = profile(handle="lepetitquai", display_name="Le Petit Quai", bio="Restaurant bistronomique au Havre. Réservations")
    fb = profile(platform="facebook", handle="lepetitquai", url="https://www.facebook.com/lepetitquai/", display_name="Le Petit Quai",
                 bio="Restaurant, Le Havre", mentioned_handles=["lepetitquai"])
    conf = compute_confidence(facts([ig, fb]))
    assert crit(conf, "name")["points"] == 25
    assert crit(conf, "location")["points"] == 20
    assert crit(conf, "activity")["points"] == 20
    assert crit(conf, "cross_links")["points"] == 15
    assert conf["score"] >= 90
    assert conf["level"]["label"] == "Très fiable"


def test_contradictions_reduce_score():
    good = compute_confidence(facts([profile(handle="pizzanapoli", display_name="Pizza Napoli", bio="Pizzeria au feu de bois")]))
    bad = compute_confidence(facts([profile(handle="pizzanapoli", display_name="Pizza Napoli", bio="Pizzeria au feu de bois à Lyon 7e")]))
    assert crit(bad, "location")["points"] == -10
    assert crit(bad, "location")["status"] == "contradiction"
    assert bad["score"] < good["score"]
    other = compute_confidence(facts([profile(handle="lea", display_name="Léa", bio="Salon de coiffure au Havre")], activity="garage"))
    assert crit(other, "activity")["points"] == -10


def test_same_handle_is_only_a_hint():
    ig = profile(handle="dupont", display_name="Dupont")
    fb = profile(platform="facebook", handle="dupont", display_name="Dupont")
    conf = compute_confidence(facts([ig, fb]))
    cl = crit(conf, "cross_links")
    assert cl["points"] == 6 and cl["status"] == "hypothesis"


def test_commercial_does_not_invent_needs():
    com = compute_commercial(facts([profile(handle="x", display_name="X")], activity=None))
    # Sans aucune donnée : seuls des critères inconnus ou des hypothèses faibles
    assert com["score"] <= 10
    web = crit(com, "website")
    assert web["status"] == "hypothesis" and web["points"] == 6  # absence de site = hypothèse, pas une preuve


def test_commercial_observed_site_issues_and_new_business():
    p = profile(handle="maison", display_name="Maison Océane", bio="Concept store. Grande ouverture le 15 novembre", followers=150, posts=9,
                last_post_at="2026-10-30T10:00:00+00:00", api_verified=1)
    com = compute_commercial(facts([p], activity="boutique", website="http://maison.example",
                                   website_check={"reachable": True, "issues": ["pas de HTTPS", "pas adapté au téléphone"], "free_host": False}))
    assert crit(com, "website")["points"] == 12
    assert crit(com, "visual_identity")["points"] >= 10
    assert crit(com, "real_activity")["points"] == 10
    assert crit(com, "real_activity")["status"] == "verified"
    assert com["score"] >= 70


def test_closed_business_is_flagged():
    com = compute_commercial(facts([profile(handle="x", display_name="X", bio="Restaurant fermé définitivement")]))
    assert com["closed"] is True
    assert crit(com, "real_activity")["points"] == -10


def test_opening_hours_are_not_a_new_business_signal():
    com = compute_commercial(facts([profile(handle="x", display_name="X", bio="Horaires d'ouverture : 9h-19h")]))
    assert all("lancement" not in e["text"] for e in crit(com, "visual_identity")["evidence"])


def test_priority_formula_and_uncertain_cap():
    assert priority(90, 80) == 86.0
    assert priority(80, 50) == 68.0
    # Une identification incertaine n'est jamais compensée par un fort potentiel commercial
    assert priority(40, 100) == 40
    assert priority(40, 100) < priority(60, 30)


def test_scores_are_reproducible():
    p = profile(handle="lepetitquai", display_name="Le Petit Quai", bio="Restaurant au Havre", followers=820, posts=64)
    a, b = compute_confidence(facts([p])), compute_confidence(facts([p]))
    assert a == b
    assert compute_commercial(facts([p])) == compute_commercial(facts([p]))


def test_score_bounds():
    for p in (profile(), profile(handle="a", display_name="Zzz", bio="Lyon fermé définitivement coiffure")):
        f = facts([p], activity="garage")
        assert 0 <= compute_confidence(f)["score"] <= 100
        assert 0 <= compute_commercial(f)["score"] <= 100
