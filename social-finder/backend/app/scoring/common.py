"""Structures communes aux deux scores : chaque critère conserve ses points, son statut et ses preuves."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

# Statuts d'un élément de preuve
VERIFIED = "verified"        # donnée lue via une API officielle ou validée par l'utilisateur
OBSERVED = "observed"        # constatée dans un extrait indexé / sur le site (peut être ancienne)
HYPOTHESIS = "hypothesis"    # déduction plausible, non prouvée
UNKNOWN = "unknown"          # information indisponible : 0 point
CONTRADICTION = "contradiction"  # information contradictoire : points retirés


@dataclass
class Evidence:
    text: str
    status: str
    points: int
    source: str = ""


@dataclass
class Criterion:
    key: str
    label: str
    max: int
    evidence: list[Evidence] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)

    def add(self, text: str, status: str, points: int, source: str = "") -> None:
        self.evidence.append(Evidence(text, status, points, source))

    @property
    def points(self) -> int:
        positive = sum(e.points for e in self.evidence if e.points > 0)
        negative = sum(e.points for e in self.evidence if e.points < 0)
        return max(-self.max, min(self.max, positive) + negative)

    @property
    def status(self) -> str:
        statuses = {e.status for e in self.evidence if e.points != 0}
        for s in (CONTRADICTION, VERIFIED, OBSERVED, HYPOTHESIS):
            if s in statuses:
                return s
        return UNKNOWN

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "label": self.label, "max": self.max, "points": self.points, "status": self.status,
                "evidence": [asdict(e) for e in self.evidence], "missing": self.missing}


def total(criteria: list[Criterion]) -> int:
    return max(0, min(100, sum(c.points for c in criteria)))


CONFIDENCE_LEVELS = [(90, "very_high", "Très fiable", "Priorité"), (75, "high", "Fiable", "Prospect exploitable"),
                     (50, "medium", "À vérifier", "Validation manuelle"), (0, "low", "Incertain", "Ne pas contacter sans vérification")]
COMMERCIAL_LEVELS = [(85, "excellent", "Excellent potentiel", "Priorité élevée"), (70, "good", "Bon potentiel", "À contacter"),
                     (50, "medium", "Potentiel moyen", "À étudier"), (0, "low", "Faible potentiel", "Priorité basse")]


def level(score: int, table: list[tuple[int, str, str, str]]) -> dict[str, str]:
    for threshold, key, label, action in table:
        if score >= threshold:
            return {"key": key, "label": label, "action": action}
    return {"key": table[-1][1], "label": table[-1][2], "action": table[-1][3]}


def priority(confidence: int, commercial: int) -> float:
    """Priorité = confiance × 0,60 + commercial × 0,40. Une identification incertaine (< 50) plafonne la priorité
    au score de confiance : un fort potentiel commercial ne compense jamais un doute sur l'identité."""
    p = confidence * 0.6 + commercial * 0.4
    if confidence < 50:
        p = min(p, confidence)
    return round(p, 1)
