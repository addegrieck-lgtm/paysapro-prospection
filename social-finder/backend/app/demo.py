"""DONNÉES DE DÉMONSTRATION — entreprises FICTIVES, toujours marquées « DÉMO » (is_demo = 1).

Elles servent uniquement à découvrir l'interface sans clé d'API. Elles ne proviennent d'aucune recherche,
sont exclues des statistiques réelles par défaut et se suppriment en un clic.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .db import now_iso, session
from .repo import create_company, location_payload, match_company, rescore, set_website_check, upsert_profile

DEMO = [
    ("restaurant", "Le Havre", "instagram", "demo.lepetitquai", "Le Petit Quai (démo)", "Restaurant bistronomique au Havre 🍽 Cuisine maison, produits locaux. Réservations par message. facebook.com/demo.lepetitquai", 820, 64, None, 12),
    ("restaurant", "Le Havre", "facebook", "demo.lepetitquai", "Le Petit Quai (démo)", "Le Petit Quai, Le Havre. Restaurant bistronomique. Insta @demo.lepetitquai", None, None, 1350, None),
    ("coiffeur", "Le Havre", "instagram", "demo.atelier.coiffure", "L'Atelier Coiffure (démo)", "Salon de coiffure & barbier — Le Havre. Nouvelle adresse depuis septembre ! RDV en DM", 240, 18, None, 4),
    ("garage", "Le Havre", "facebook", "demo.garagedesdocks", "Garage des Docks (démo)", "Garage automobile, mécanique toutes marques, Le Havre (76600). Devis gratuit.", None, None, 410, None),
    ("boulangerie", "Le Havre", "instagram", "demo.fournil.sanvic", "Le Fournil de Sanvic (démo)", "Boulangerie artisanale 🥖 Pain au levain. Ouvert du mardi au dimanche.", 1900, 210, None, 2),
    ("boutique", "Le Havre", "instagram", "demo.maison.oceane", "Maison Océane (démo)", "Concept store déco & créateurs normands. Grande ouverture le 15 novembre ✨", 150, 9, None, 1),
    ("paysagiste", "Le Havre", "facebook", "demo.vertjardin76", "Vert Jardin 76 (démo)", "Paysagiste — création et entretien de jardins en Seine-Maritime. Devis : vertjardin76.example", None, None, 95, None),
    ("restaurant", "Le Havre", "instagram", "demo.pizzanapoli.lyon", "Pizza Napoli (démo)", "Pizzeria au feu de bois à Lyon 7e", 3400, 520, None, 3),
]


def load_demo() -> int:
    created = 0
    with session() as conn:
        for act, city, platform, handle, name, bio, followers, posts, likes, last_days in DEMO:
            data = {"platform": platform, "handle": handle, "display_name": name, "bio": bio, "followers": followers, "posts": posts,
                    "likes": likes, "source": "demo",
                    "url": f"https://www.instagram.com/{handle}/" if platform == "instagram" else f"https://www.facebook.com/{handle}/",
                    "mentioned_handles": ["demo.lepetitquai"] if "Insta @" in bio else [],
                    "last_post_at": (datetime.now(timezone.utc) - timedelta(days=last_days)).isoformat() if last_days is not None else None}
            pid, new = upsert_profile(conn, data)
            if not new:
                continue
            cid = create_company(conn, pid, {"activity_key": act, "location": location_payload(city, "76", "28", ["instagram", "facebook"]),
                                             "source": "Démonstration", "is_demo": True})
            if "vertjardin76" in handle:
                set_website_check(conn, cid, {"reachable": True, "https": False, "mobile": False, "copyright_year": 2017, "free_host": False,
                                              "issues": ["pas de HTTPS", "pas adapté au téléphone (aucune balise viewport)", "mention de copyright ancienne (2017)"],
                                              "title": "Vert Jardin 76 (démo)", "social_links": [], "checked_at": now_iso()[:10], "demo": True})
                conn.execute("UPDATE companies SET website='http://vertjardin76.example' WHERE id=?", (cid,))
            rescore(conn, cid)
            match_company(conn, cid)
            created += 1
        conn.execute("UPDATE companies SET status='contacted' WHERE is_demo=1 AND name LIKE 'Garage%'")
        conn.execute("UPDATE companies SET status='interested' WHERE is_demo=1 AND name LIKE 'L''Atelier%'")
    return created


def clear_demo() -> int:
    with session() as conn:
        ids = [r["id"] for r in conn.execute("SELECT id FROM companies WHERE is_demo=1")]
        conn.execute("DELETE FROM profiles WHERE source='demo' OR company_id IN (SELECT id FROM companies WHERE is_demo=1)")
        conn.execute("DELETE FROM companies WHERE is_demo=1")
    return len(ids)


__all__ = ["load_demo", "clear_demo"]
