"""Vercel entry point: serves the FastAPI app under /api on the same domain as the web app."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app import seed
from app.config import get_settings
from app.db import Base, engine
from app.main import app
from fastapi.staticfiles import StaticFiles

# Serverless platforms may not run ASGI lifespan events, so do the startup work at import (cold start).
get_settings().check()
Base.metadata.create_all(bind=engine)
seed.run()  # creates the demo shop once; does nothing if it already exists

# The web app is built into web-dist/ during the Vercel build; serve it after the /api routes.
WEB = Path(__file__).resolve().parent.parent / "web-dist"
if WEB.is_dir():
    app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
