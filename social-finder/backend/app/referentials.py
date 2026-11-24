"""Référentiels : régions, départements, activités (synonymes, pertinence pour Signe & Seine)."""
from __future__ import annotations

from dataclasses import dataclass, field

from .text import contains_phrase, norm

REGIONS: dict[str, str] = {
    "84": "Auvergne-Rhône-Alpes", "27": "Bourgogne-Franche-Comté", "53": "Bretagne", "24": "Centre-Val de Loire",
    "94": "Corse", "44": "Grand Est", "32": "Hauts-de-France", "11": "Île-de-France", "28": "Normandie",
    "75": "Nouvelle-Aquitaine", "76": "Occitanie", "52": "Pays de la Loire", "93": "Provence-Alpes-Côte d'Azur",
    "01": "Guadeloupe", "02": "Martinique", "03": "Guyane", "04": "La Réunion", "06": "Mayotte",
}

# code département → (nom, code région)
DEPARTMENTS: dict[str, tuple[str, str]] = {
    "01": ("Ain", "84"), "02": ("Aisne", "32"), "03": ("Allier", "84"), "04": ("Alpes-de-Haute-Provence", "93"),
    "05": ("Hautes-Alpes", "93"), "06": ("Alpes-Maritimes", "93"), "07": ("Ardèche", "84"), "08": ("Ardennes", "44"),
    "09": ("Ariège", "76"), "10": ("Aube", "44"), "11": ("Aude", "76"), "12": ("Aveyron", "76"),
    "13": ("Bouches-du-Rhône", "93"), "14": ("Calvados", "28"), "15": ("Cantal", "84"), "16": ("Charente", "75"),
    "17": ("Charente-Maritime", "75"), "18": ("Cher", "24"), "19": ("Corrèze", "75"), "2A": ("Corse-du-Sud", "94"),
    "2B": ("Haute-Corse", "94"), "21": ("Côte-d'Or", "27"), "22": ("Côtes-d'Armor", "53"), "23": ("Creuse", "75"),
    "24": ("Dordogne", "75"), "25": ("Doubs", "27"), "26": ("Drôme", "84"), "27": ("Eure", "28"),
    "28": ("Eure-et-Loir", "24"), "29": ("Finistère", "53"), "30": ("Gard", "76"), "31": ("Haute-Garonne", "76"),
    "32": ("Gers", "76"), "33": ("Gironde", "75"), "34": ("Hérault", "76"), "35": ("Ille-et-Vilaine", "53"),
    "36": ("Indre", "24"), "37": ("Indre-et-Loire", "24"), "38": ("Isère", "84"), "39": ("Jura", "27"),
    "40": ("Landes", "75"), "41": ("Loir-et-Cher", "24"), "42": ("Loire", "84"), "43": ("Haute-Loire", "84"),
    "44": ("Loire-Atlantique", "52"), "45": ("Loiret", "24"), "46": ("Lot", "76"), "47": ("Lot-et-Garonne", "75"),
    "48": ("Lozère", "76"), "49": ("Maine-et-Loire", "52"), "50": ("Manche", "28"), "51": ("Marne", "44"),
    "52": ("Haute-Marne", "44"), "53": ("Mayenne", "52"), "54": ("Meurthe-et-Moselle", "44"), "55": ("Meuse", "44"),
    "56": ("Morbihan", "53"), "57": ("Moselle", "44"), "58": ("Nièvre", "27"), "59": ("Nord", "32"),
    "60": ("Oise", "32"), "61": ("Orne", "28"), "62": ("Pas-de-Calais", "32"), "63": ("Puy-de-Dôme", "84"),
    "64": ("Pyrénées-Atlantiques", "75"), "65": ("Hautes-Pyrénées", "76"), "66": ("Pyrénées-Orientales", "76"),
    "67": ("Bas-Rhin", "44"), "68": ("Haut-Rhin", "44"), "69": ("Rhône", "84"), "70": ("Haute-Saône", "27"),
    "71": ("Saône-et-Loire", "27"), "72": ("Sarthe", "52"), "73": ("Savoie", "84"), "74": ("Haute-Savoie", "84"),
    "75": ("Paris", "11"), "76": ("Seine-Maritime", "28"), "77": ("Seine-et-Marne", "11"), "78": ("Yvelines", "11"),
    "79": ("Deux-Sèvres", "75"), "80": ("Somme", "32"), "81": ("Tarn", "76"), "82": ("Tarn-et-Garonne", "76"),
    "83": ("Var", "93"), "84": ("Vaucluse", "93"), "85": ("Vendée", "52"), "86": ("Vienne", "75"),
    "87": ("Haute-Vienne", "75"), "88": ("Vosges", "44"), "89": ("Yonne", "27"), "90": ("Territoire de Belfort", "27"),
    "91": ("Essonne", "11"), "92": ("Hauts-de-Seine", "11"), "93": ("Seine-Saint-Denis", "11"),
    "94": ("Val-de-Marne", "11"), "95": ("Val-d'Oise", "11"), "971": ("Guadeloupe", "01"), "972": ("Martinique", "02"),
    "973": ("Guyane", "03"), "974": ("La Réunion", "04"), "976": ("Mayotte", "06"),
}

# Grandes villes : servent à détecter une localisation CONTRADICTOIRE (profil d'une autre ville).
MAJOR_CITIES: dict[str, str] = {
    "Paris": "75", "Marseille": "13", "Lyon": "69", "Toulouse": "31", "Nice": "06", "Nantes": "44",
    "Montpellier": "34", "Strasbourg": "67", "Bordeaux": "33", "Lille": "59", "Rennes": "35", "Reims": "51",
    "Toulon": "83", "Saint-Étienne": "42", "Le Havre": "76", "Grenoble": "38", "Dijon": "21", "Angers": "49",
    "Nîmes": "30", "Villeurbanne": "69", "Clermont-Ferrand": "63", "Le Mans": "72", "Aix-en-Provence": "13",
    "Brest": "29", "Tours": "37", "Amiens": "80", "Limoges": "87", "Annecy": "74", "Perpignan": "66",
    "Metz": "57", "Besançon": "25", "Orléans": "45", "Rouen": "76", "Caen": "14", "Mulhouse": "68",
    "Nancy": "54", "Argenteuil": "95", "Roubaix": "59", "Tourcoing": "59", "Avignon": "84", "Poitiers": "86",
    "Pau": "64", "La Rochelle": "17", "Calais": "62", "Cannes": "06", "Antibes": "06", "Dunkerque": "59",
    "Béziers": "34", "Bourges": "18", "Saint-Malo": "35", "Quimper": "29", "Valence": "26", "Troyes": "10",
    "Lorient": "56", "Vannes": "56", "Évreux": "27", "Cherbourg": "50", "Dieppe": "76", "Fécamp": "76",
    "Bolbec": "76", "Yvetot": "76", "Elbeuf": "76", "Lisieux": "14", "Alençon": "61", "Saint-Lô": "50",
    "Honfleur": "14", "Deauville": "14", "Bayeux": "14", "Vernon": "27", "Louviers": "27", "Beauvais": "60",
    "Chartres": "28", "Laval": "53", "Niort": "79", "Angoulême": "16", "Colmar": "68", "Chambéry": "73",
    "Ajaccio": "2A", "Bastia": "2B",
}


def department_of_city(city: str | None) -> str | None:
    n = norm(city)
    for name, dep in MAJOR_CITIES.items():
        if norm(name) == n:
            return dep
    return None


def department_name(code: str | None) -> str | None:
    return DEPARTMENTS.get(code or "", (None, None))[0]


def region_of_department(code: str | None) -> str | None:
    dep = DEPARTMENTS.get(code or "")
    return REGIONS.get(dep[1]) if dep else None


def departments_of_region(region_code: str) -> list[str]:
    return [code for code, (_, reg) in DEPARTMENTS.items() if reg == region_code]


@dataclass(frozen=True)
class Activity:
    key: str
    label: str
    sector: str
    # Mots servant à la fois aux requêtes et à la reconnaissance de l'activité dans un profil
    synonyms: tuple[str, ...]
    # Pertinence des services Signe & Seine (0..15) et justification
    relevance: int
    relevance_reason: str
    # Services Signe & Seine les plus adaptés à ce métier
    services: tuple[str, ...] = field(default_factory=tuple)


SERVICES = {
    "site_creation": "Création de site Internet",
    "site_redesign": "Refonte de site Internet",
    "flyers": "Création de flyers",
    "business_cards": "Cartes de visite",
    "logo": "Création de logo",
    "visual_communication": "Communication visuelle",
    "storefront": "Habillage de vitrine",
    "signage": "Signalétique commerciale",
    "advertising": "Supports publicitaires",
}

ACTIVITIES: tuple[Activity, ...] = (
    Activity("restaurant", "Restaurant", "Restauration & métiers de bouche",
             ("restaurant", "bistrot", "brasserie", "pizzeria", "crêperie", "traiteur", "cuisine", "resto"), 15,
             "Restauration : vitrine, menus, flyers, site avec réservation et carte — besoins récurrents en supports.",
             ("site_creation", "flyers", "storefront", "signage", "advertising")),
    Activity("bar", "Bar / café", "Restauration & métiers de bouche",
             ("bar", "café", "pub", "cave à bière", "bar à vin", "salon de thé"), 13,
             "Bars et cafés : communication événementielle, flyers, vitrine, signalétique.",
             ("flyers", "storefront", "signage", "visual_communication")),
    Activity("boulangerie", "Boulangerie / pâtisserie", "Restauration & métiers de bouche",
             ("boulangerie", "pâtisserie", "boulanger", "pâtissier", "chocolatier"), 13,
             "Commerce de bouche : vitrine, étiquetage, cartes, supports en boutique.",
             ("storefront", "signage", "business_cards", "flyers")),
    Activity("boucherie", "Boucherie / épicerie fine", "Restauration & métiers de bouche",
             ("boucherie", "charcuterie", "épicerie fine", "fromagerie", "primeur", "caviste", "épicerie"), 12,
             "Commerce de proximité : vitrine, signalétique, supports promotionnels.",
             ("storefront", "signage", "flyers", "logo")),
    Activity("coiffeur", "Coiffeur / barbier", "Beauté & bien-être",
             ("coiffeur", "coiffeuse", "coiffure", "barbier", "barber", "salon de coiffure"), 14,
             "Salon : image de marque forte, cartes de fidélité, vitrine, site avec prise de rendez-vous.",
             ("logo", "business_cards", "storefront", "site_creation")),
    Activity("esthetique", "Institut de beauté / esthétique", "Beauté & bien-être",
             ("institut de beauté", "esthéticienne", "esthétique", "onglerie", "prothésiste ongulaire", "spa", "maquilleuse"), 14,
             "Beauté : identité visuelle soignée, cartes, flyers, site vitrine.",
             ("logo", "business_cards", "flyers", "site_creation")),
    Activity("fleuriste", "Fleuriste", "Commerces",
             ("fleuriste", "fleurs", "artisan fleuriste"), 13,
             "Fleuriste : vitrine, cartes, supports saisonniers.",
             ("storefront", "business_cards", "flyers", "site_creation")),
    Activity("boutique", "Boutique / commerce indépendant", "Commerces",
             ("boutique", "concept store", "magasin", "commerce", "prêt-à-porter", "créatrice", "bijouterie", "décoration"), 15,
             "Commerce indépendant : vitrine, signalétique, communication visuelle, site.",
             ("storefront", "signage", "visual_communication", "site_creation")),
    Activity("garage", "Garage automobile", "Automobile",
             ("garage", "garage automobile", "mécanique auto", "carrosserie", "carrossier", "contrôle technique", "pneus"), 11,
             "Garage : signalétique, cartes, site vitrine ; la communication visuelle est souvent secondaire.",
             ("signage", "site_creation", "business_cards")),
    Activity("paysagiste", "Paysagiste", "Artisans du bâtiment & extérieur",
             ("paysagiste", "jardinier", "espaces verts", "entretien de jardin", "élagage", "aménagement extérieur"), 12,
             "Artisan : site vitrine avec réalisations, cartes, marquage véhicule, flyers.",
             ("site_creation", "business_cards", "flyers", "logo")),
    Activity("btp", "Artisan du bâtiment", "Artisans du bâtiment & extérieur",
             ("artisan", "maçon", "maçonnerie", "plombier", "plomberie", "électricien", "menuisier", "menuiserie",
              "peintre en bâtiment", "couvreur", "carreleur", "plaquiste", "chauffagiste", "rénovation"), 12,
             "Artisan BTP : site vitrine avec réalisations, cartes de visite, logo, signalétique chantier.",
             ("site_creation", "business_cards", "logo", "signage")),
    Activity("immobilier", "Agence immobilière", "Services",
             ("agence immobilière", "immobilier", "mandataire immobilier", "conseiller immobilier"), 10,
             "Immobilier : vitrine et supports, mais souvent liés à un réseau avec charte imposée.",
             ("storefront", "business_cards", "flyers")),
    Activity("sport", "Salle de sport / coach", "Beauté & bien-être",
             ("salle de sport", "coach sportif", "fitness", "crossfit", "yoga", "pilates", "danse"), 12,
             "Sport : identité visuelle, flyers, site avec planning et réservation.",
             ("logo", "flyers", "site_creation", "visual_communication")),
    Activity("hotel", "Hôtel / gîte / chambre d'hôtes", "Hôtellerie & tourisme",
             ("hôtel", "gîte", "chambre d'hôtes", "chambres d hotes", "camping", "location saisonnière"), 13,
             "Hébergement : site avec réservation directe, supports d'accueil, signalétique.",
             ("site_redesign", "site_creation", "signage", "flyers")),
    Activity("photographe", "Photographe / créatif", "Services",
             ("photographe", "vidéaste", "studio photo"), 8,
             "Créatifs : produisent souvent leurs visuels eux-mêmes ; besoin plutôt sur le site.",
             ("site_creation", "business_cards")),
    Activity("sante", "Santé / bien-être (profession libérale)", "Santé",
             ("ostéopathe", "kinésithérapeute", "naturopathe", "sophrologue", "psychologue", "diététicienne", "massage"), 8,
             "Professions de santé : communication encadrée ; site et cartes surtout.",
             ("site_creation", "business_cards")),
    Activity("services", "Services aux particuliers", "Services",
             ("nettoyage", "pressing", "toiletteur", "toilettage", "auto-école", "déménagement", "serrurier", "taxi", "vtc"), 11,
             "Services locaux : cartes, flyers, site vitrine, marquage.",
             ("business_cards", "flyers", "site_creation", "logo")),
)

ACTIVITY_BY_KEY = {a.key: a for a in ACTIVITIES}


def custom_activity(keyword: str) -> Activity:
    """Activité libre (mot-clé personnalisé) : pertinence neutre, faute de référentiel."""
    kw = keyword.strip()
    return Activity(f"custom:{norm(kw)}", kw, "Personnalisé", (kw,), 10,
                    "Activité personnalisée : pertinence moyenne par défaut (aucune donnée de référence).",
                    ("site_creation", "visual_communication", "business_cards"))


def resolve_activity(key_or_keyword: str) -> Activity:
    return ACTIVITY_BY_KEY.get(key_or_keyword) or custom_activity(key_or_keyword)


def detect_activity(text: str) -> Activity | None:
    """Activité reconnue dans un texte libre (nom, bio, catégorie). La plus spécifique (synonyme le plus long) gagne."""
    t = norm(text)
    best: tuple[int, Activity] | None = None
    for a in ACTIVITIES:
        for s in a.synonyms:
            if contains_phrase(t, s) and (best is None or len(s) > best[0]):
                best = (len(s), a)
    return best[1] if best else None
