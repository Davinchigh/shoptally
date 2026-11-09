"""Vercel entry point: serves the FastAPI app under /api on the same domain as the web app."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app import seed  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402,F401  (Vercel serves this ASGI app)

# Serverless platforms may not run ASGI lifespan events, so do the startup work at import (cold start).
get_settings().check()
Base.metadata.create_all(bind=engine)
seed.run()  # creates the demo shop once; does nothing if it already exists
