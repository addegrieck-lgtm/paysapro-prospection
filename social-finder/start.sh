#!/usr/bin/env bash
# Lancement sur macOS / Linux (équivalent de START.bat).
set -e
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/python -c "import fastapi, uvicorn, httpx" 2>/dev/null || .venv/bin/pip install -q -r backend/requirements.txt
[ -f frontend/dist/index.html ] || (cd frontend && npm install && npm run build)
cd backend
(sleep 2 && (xdg-open http://127.0.0.1:8765 2>/dev/null || open http://127.0.0.1:8765 2>/dev/null) ) &
exec ../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
