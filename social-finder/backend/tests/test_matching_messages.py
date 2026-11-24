from app.ai.messages import elide, in_city, render_template
from app.discovery.matching import compare_profiles
from app.discovery.queries import build_queries
from app.referentials import resolve_activity


def test_cross_mention_allows_auto_merge():
    ig = {"handle": "lepetitquai", "display_name": "Le Petit Quai", "mentioned_handles": []}
    fb = {"handle": "petitquai76", "display_name": "Le Petit Quai", "mentioned_handles": ["lepetitquai"]}
    v = compare_profiles(ig, fb, "Le Havre")
    assert v.auto and v.score >= 70


def test_similar_names_without_proof_need_human_validation():
    ig = {"handle": "garagedupont", "display_name": "Garage Dupont", "bio": "Rouen"}
    fb = {"handle": "dupontautomobiles", "display_name": "Garage Dupont", "bio": "Rouen"}
    v = compare_profiles(ig, fb, "Rouen")
    assert not v.auto
    assert v.score >= 25


def test_different_names_are_not_matched():
    v = compare_profiles({"handle": "a", "display_name": "Boulangerie Martin"}, {"handle": "b", "display_name": "Coiffure Léa"})
    assert v.score == 0 and not v.auto


def test_queries_cover_each_combination_first():
    qs = build_queries([resolve_activity("restaurant"), resolve_activity("coiffeur")], ["Le Havre"], ["instagram", "facebook"])
    first = [q.text for q in qs[:4]]
    assert first == ['restaurant "Le Havre" site:instagram.com', 'restaurant "Le Havre" site:facebook.com',
                     'coiffeur "Le Havre" site:instagram.com', 'coiffeur "Le Havre" site:facebook.com']
    assert len(set(q.text for q in qs)) == len(qs)


def test_french_helpers():
    assert in_city("Le Havre") == " au Havre"
    assert in_city("Les Andelys") == " aux Andelys"
    assert in_city("Rouen") == " à Rouen"
    assert elide("je pense que un site de une") == "je pense qu'un site d'une"


def _ctx(observations):
    return {"entreprise": "X", "activite": "Restaurant", "activity_key": "restaurant", "ville": "Rouen", "canal": "Instagram DM", "reseau": "Instagram",
            "observations": observations, "services_recommandes": ["site_creation"], "presentation_agence": "Je travaille dans la communication.",
            "signature": "Alex — Signe & Seine"}


def test_hypothesis_is_phrased_as_question():
    msg = render_template(_ctx([{"fait": "Aucun site identifié dans les informations disponibles", "statut": "hypothese"}]), "professional", "instagram_dm")
    assert "?" in msg.split("\n\n")[1]
    assert "Alex — Signe & Seine" in msg
    assert len(msg.split()) < 120


def test_variants_and_styles_differ():
    ctx = _ctx([])
    styles = {render_template(ctx, s, "instagram_dm") for s in ("professional", "friendly", "direct")}
    assert len(styles) == 3
    assert render_template(ctx, "professional", "instagram_dm", 0) == render_template(ctx, "professional", "instagram_dm", 0)
