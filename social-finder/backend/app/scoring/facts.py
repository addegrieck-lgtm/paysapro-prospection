"""Rassemble les faits connus d'une entreprise (profils, site, recherche d'origine) pour les deux scores."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from ..referentials import Activity, detect_activity, resolve_activity
from ..text import norm


@dataclass
class ProfileFacts:
    platform: str
    handle: str
    url: str
    display_name: str | None
    bio: str | None
    category: str | None
    location: str | None
    website: str | None
    followers: int | None
    posts: int | None
    likes: int | None
    checkins: int | None
    last_post_at: str | None
    mentioned_handles: list[str]
    snippet: str | None
    api_verified: bool
    api_data: dict[str, Any] | None
    source: str

    @property
    def src_label(self) -> str:
        net = "Instagram" if self.platform == "instagram" else "Facebook"
        if self.api_verified:
            return f"{net} (API officielle)"
        if self.source.startswith("search:"):
            return f"{net} (extrait indexé {self.source.split(':', 1)[1]})"
        if self.source in ("assisted", "manual"):
            return f"{net} (saisie manuelle)"
        if self.source == "demo":
            return f"{net} (donnée de démonstration)"
        return net

    @property
    def status(self) -> str:
        from .common import OBSERVED, VERIFIED
        return VERIFIED if self.api_verified or self.source in ("assisted", "manual") else OBSERVED

    def text(self) -> str:
        return " ".join(x for x in (self.display_name, self.bio, self.category, self.location, self.snippet) if x)


@dataclass
class CompanyFacts:
    name: str
    profiles: list[ProfileFacts]
    website: str | None
    website_check: dict[str, Any] | None
    search_activity: Activity | None
    target_city: str | None
    target_department: str | None
    target_region: str | None
    searched_platforms: list[str] = field(default_factory=list)
    today: date = field(default_factory=date.today)

    @property
    def ig(self) -> ProfileFacts | None:
        return next((p for p in self.profiles if p.platform == "instagram"), None)

    @property
    def fb(self) -> ProfileFacts | None:
        return next((p for p in self.profiles if p.platform == "facebook"), None)

    def corpus(self) -> str:
        parts = [p.text() for p in self.profiles]
        if self.website_check and self.website_check.get("title"):
            parts.append(self.website_check["title"])
        return norm(" ".join(parts))

    def detected_activity(self) -> Activity | None:
        return detect_activity(" ".join(p.text() for p in self.profiles))

    def activity(self) -> Activity | None:
        return self.search_activity or self.detected_activity()

    def last_post(self) -> tuple[int, "ProfileFacts"] | None:
        """(jours depuis la dernière publication connue, profil source) — None si inconnu."""
        best: tuple[int, ProfileFacts] | None = None
        for p in self.profiles:
            if p.last_post_at:
                try:
                    d = datetime.fromisoformat(p.last_post_at.replace("Z", "+00:00").replace("+0000", "+00:00")).date()
                except ValueError:
                    continue
                days = (self.today - d).days
                if best is None or days < best[0]:
                    best = (days, p)
        return best

    def last_post_days(self) -> int | None:
        lp = self.last_post()
        return lp[0] if lp else None


def _loads(v: Any) -> Any:
    import json
    if isinstance(v, str):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return None
    return v


def build_facts(company: dict[str, Any], profiles: list[dict[str, Any]], today: date | None = None) -> CompanyFacts:
    loc = _loads(company.get("search_location")) or {}
    act_key = company.get("search_activity")
    pf = [ProfileFacts(
        platform=p["platform"], handle=p["handle"], url=p["url"], display_name=p.get("display_name"), bio=p.get("bio"),
        category=p.get("category"), location=p.get("location"), website=p.get("website"), followers=p.get("followers"),
        posts=p.get("posts"), likes=p.get("likes"), checkins=p.get("checkins"), last_post_at=p.get("last_post_at"),
        mentioned_handles=_loads(p.get("mentioned_handles")) or [], snippet=p.get("snippet"), api_verified=bool(p.get("api_verified")),
        api_data=_loads(p.get("api_data")), source=p.get("source") or "",
    ) for p in profiles]
    return CompanyFacts(
        name=company.get("name") or "", profiles=pf, website=company.get("website"),
        website_check=_loads(company.get("website_check")), search_activity=resolve_activity(act_key) if act_key else None,
        target_city=loc.get("city"), target_department=loc.get("department"), target_region=loc.get("region"),
        searched_platforms=loc.get("platforms") or [], today=today or date.today(),
    )


POSTAL = re.compile(r"\b(\d{5})\b")
