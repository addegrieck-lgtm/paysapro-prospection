"""Base SQLite locale : schéma, migrations, accès."""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from . import config

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  params TEXT NOT NULL DEFAULT '{}',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  params TEXT NOT NULL,
  status TEXT NOT NULL,              -- pending | running | done | failed | cancelled | no_source
  started_at TEXT NOT NULL,
  finished_at TEXT,
  stats TEXT NOT NULL DEFAULT '{}',
  log TEXT NOT NULL DEFAULT '[]',
  queries_done TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_locked INTEGER NOT NULL DEFAULT 0,
  activity_key TEXT,
  activity_label TEXT,
  city TEXT,
  city_locked INTEGER NOT NULL DEFAULT 0,
  department TEXT,
  region TEXT,
  description TEXT,
  website TEXT,
  website_check TEXT,                -- diagnostic du site (JSON) ou NULL
  search_activity TEXT,              -- activité recherchée lors de la découverte
  search_location TEXT,              -- localisation recherchée lors de la découverte
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  search_id INTEGER REFERENCES searches(id) ON DELETE SET NULL,
  source TEXT NOT NULL,              -- moteur / API / recherche assistée / démo
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  validated INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  confidence_score INTEGER NOT NULL DEFAULT 0,
  confidence_detail TEXT NOT NULL DEFAULT '{}',
  commercial_score INTEGER NOT NULL DEFAULT 0,
  commercial_detail TEXT NOT NULL DEFAULT '{}',
  priority REAL NOT NULL DEFAULT 0,
  analysis TEXT NOT NULL DEFAULT '{}',
  follow_up_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_companies_campaign ON companies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,            -- instagram | facebook
  handle TEXT NOT NULL,
  url TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  category TEXT,
  location TEXT,
  website TEXT,
  followers INTEGER,
  following INTEGER,
  posts INTEGER,
  likes INTEGER,
  checkins INTEGER,
  last_post_at TEXT,
  mentioned_handles TEXT NOT NULL DEFAULT '[]',
  title TEXT,
  snippet TEXT,
  search_query TEXT,
  source TEXT NOT NULL,              -- search:<connecteur> | meta_api | assisted | manual | demo
  api_verified INTEGER NOT NULL DEFAULT 0,
  api_data TEXT,
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(platform, handle)
);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);

CREATE TABLE IF NOT EXISTS match_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_a INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_b INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | merged | rejected
  created_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE(company_a, company_b)
);

CREATE TABLE IF NOT EXISTS match_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,              -- auto_link | merge | split | reject
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,             -- instagram_dm | messenger
  style TEXT NOT NULL,               -- professional | friendly | direct
  body TEXT NOT NULL,
  provider TEXT NOT NULL,            -- templates | ollama | openai | anthropic | manual
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | archived
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_company ON messages(company_id);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

CREATE TABLE IF NOT EXISTS suppression_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT,
  handle TEXT,
  name TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_usage (
  provider TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(provider, day)
);

CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'any',
  style TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
"""

_lock = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    config.ensure_dirs()
    conn = sqlite3.connect(config.DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def session() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with _lock, session() as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES ('schema_version', ?)", (json.dumps(SCHEMA_VERSION),))


def row(r: sqlite3.Row | None, json_fields: tuple[str, ...] = ()) -> dict[str, Any] | None:
    if r is None:
        return None
    d = dict(r)
    for f in json_fields:
        if f in d and isinstance(d[f], str):
            try:
                d[f] = json.loads(d[f])
            except json.JSONDecodeError:
                pass
    return d


def rows(rs: list[sqlite3.Row], json_fields: tuple[str, ...] = ()) -> list[dict[str, Any]]:
    return [row(r, json_fields) for r in rs]  # type: ignore[misc]


def add_event(conn: sqlite3.Connection, company_id: int | None, type_: str, detail: str = "") -> None:
    conn.execute("INSERT INTO events(company_id, type, detail, created_at) VALUES (?,?,?,?)", (company_id, type_, detail, now_iso()))
