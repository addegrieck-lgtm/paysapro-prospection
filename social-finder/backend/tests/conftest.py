import os
import sys
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="ssf-tests-")
os.environ["SSF_DATA_DIR"] = _tmp
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.db import init_db, session  # noqa: E402

TABLES = ("messages", "events", "match_suggestions", "match_history", "profiles", "companies", "searches", "campaigns",
          "suppression_list", "api_usage", "message_templates", "settings")


@pytest.fixture(autouse=True)
def clean_db():
    init_db()
    with session() as conn:
        for t in TABLES:
            conn.execute(f"DELETE FROM {t}")
    yield


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)
