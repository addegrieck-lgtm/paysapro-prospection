from app.social_urls import extract_website, parse_snippet, parse_social_url


def test_instagram_profiles_and_exclusions():
    assert parse_social_url("https://www.instagram.com/LePetitQuai/?hl=fr").handle == "lepetitquai"
    assert parse_social_url("instagram.com/le.petit_quai").url == "https://www.instagram.com/le.petit_quai/"
    for url in ("https://www.instagram.com/p/Cx123/", "https://www.instagram.com/reel/abc/", "https://www.instagram.com/explore/tags/rouen/",
                "https://www.instagram.com/", "https://www.instagram.com/stories/foo/"):
        assert parse_social_url(url) is None, url


def test_facebook_pages_and_exclusions():
    assert parse_social_url("https://fr-fr.facebook.com/garagedupont/").handle == "garagedupont"
    assert parse_social_url("https://m.facebook.com/garagedupont/photos/123").handle == "garagedupont"
    assert parse_social_url("https://www.facebook.com/p/Le-Petit-Quai-100063123456789/").handle == "100063123456789"
    assert parse_social_url("https://www.facebook.com/profile.php?id=1000123").handle == "1000123"
    assert parse_social_url("https://www.facebook.com/Garage-Dupont-123456789012/").handle == "123456789012"
    for url in ("https://www.facebook.com/groups/rouen/", "https://www.facebook.com/events/1/", "https://www.facebook.com/watch/?v=1",
                "https://www.facebook.com/sharer.php?u=x", "https://www.facebook.com/marketplace/", "https://www.pagesjaunes.fr/x"):
        assert parse_social_url(url) is None, url


def test_instagram_snippet_english_and_french():
    a = parse_snippet("instagram", "Le Petit Quai (@lepetitquai) • Instagram photos and videos",
                      '1,234 Followers, 567 Following, 89 Posts - Le Petit Quai (@lepetitquai) on Instagram: "Restaurant au Havre"')
    assert (a.display_name, a.followers, a.following, a.posts, a.bio) == ("Le Petit Quai", 1234, 567, 89, "Restaurant au Havre")
    b = parse_snippet("instagram", "Coiffure Léa (@coiffure.lea) • Photos et vidéos Instagram",
                      "2,1 k abonnés, 300 abonnements, 120 publications - Voir les photos et vidéos Instagram de Coiffure Léa (@coiffure.lea)")
    assert (b.display_name, b.followers, b.posts) == ("Coiffure Léa", 2100, 120)


def test_facebook_snippet():
    s = parse_snippet("facebook", "Le Petit Quai | Le Havre - Facebook",
                      "Le Petit Quai, Le Havre. 2 345 J’aime · 56 en parlent · 120 personnes étaient ici. Restaurant bistronomique. Insta @lepetitquai")
    assert s.display_name == "Le Petit Quai"
    assert s.likes == 2345 and s.checkins == 120
    assert "lepetitquai" in s.mentioned_handles
    assert "2 345" not in (s.bio or "")


def test_extract_website_ignores_socials_and_emails():
    assert extract_website("Réservez sur www.lepetitquai.fr") == "https://www.lepetitquai.fr"
    assert extract_website("contact@lepetitquai.fr / instagram.com/x / facebook.com/y") is None
    assert extract_website("Rdv sur planity.com/salon") is None
