"""Point d'entrée : API FastAPI + interface (frontend/dist) servies sur http://127.0.0.1:8765."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .api import companies, main_routes
from .db import init_db
from .discovery.engine import mark_interrupted
from .logs import log, setup_logging

setup_logging()
init_db()
mark_interrupted()

app = FastAPI(title=config.APP_NAME, version=config.APP_VERSION)
# Développement uniquement (Vite sur le port 5174) ; en production l'interface est servie par ce serveur.
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"], allow_methods=["*"], allow_headers=["*"])
app.include_router(main_routes.router)
app.include_router(companies.router)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Erreur sur %s %s", request.method, request.url.path)
    return JSONResponse({"detail": f"Erreur interne : {exc}"}, status_code=500)


if (config.FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    if path.startswith("api/"):
        return JSONResponse({"detail": "Route inconnue"}, status_code=404)
    file = (config.FRONTEND_DIST / path).resolve()
    if path and file.is_file() and config.FRONTEND_DIST.resolve() in file.parents:
        return FileResponse(file)
    index = config.FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return HTMLResponse("<h1>S&S Social Finder</h1><p>L'interface n'est pas encore construite. Lancez START.bat (ou <code>npm run build</code> dans "
                        "<code>frontend/</code>). L'API fonctionne : <a href='/docs'>/docs</a></p>")
