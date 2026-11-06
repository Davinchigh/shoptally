from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import get_settings
from .db import Base, engine
from .routers import auth, products, reconciliation, sales


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings().check()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="ShopTally API",
    version="1.0.0",
    description="Stock, sales and mobile money reconciliation for small shops.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(reconciliation.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    with engine.connect() as conn:
        conn.execute(text("select 1"))
    return {"status": "ok", "database": "ok"}
