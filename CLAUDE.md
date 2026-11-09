# ShopTally: notes for Claude Code

Stock, sales and MoMo reconciliation for small shops in Ghana.
Backend: FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT, bcrypt (backend/app).
Frontend: React 19, TypeScript, Vite (frontend/src). nginx serves the build and proxies /api.

## Rules

- Money is always integer pesewas. Never use floats for money, in Python or TypeScript (see frontend/src/money.ts).
- Every query on shop data filters by the logged-in shop (`shop.id`). Shop isolation is tested; keep it that way.
- The server prices every sale from the product table. Never trust a price from the client.
- Datetimes are stored as naive UTC. Convert at the edge (see `SaleIn.sane_back_fill`).
- Secrets come from the environment only. Don't commit env files, keys or tokens.
- Add or update a test for every behaviour change. Security fixes get a test in backend/tests/test_hardening.py.

## Commands

```bash
# backend
cd backend && pip install -r requirements.txt pytest httpx ruff
uvicorn app.main:app --reload        # http://localhost:8000/docs
pytest -q && ruff check . && ruff format --check .

# frontend
cd frontend && npm install
npm run dev                           # http://localhost:5173
npm test && npx tsc --noEmit && npm run build

# everything
docker compose up --build             # web :8080, api :8000
docker compose exec api python -m app.seed   # demo shop: demo@shoptally.app / demo-pass-123
```

CI (.github/workflows/ci.yml) runs all of the above against MySQL. Keep it green.

## Next up

See "What I'd add next" in README.md. Before deploying publicly: Alembic migrations, a privacy notice in the app, and moving the login throttle (backend/app/throttle.py) to Redis if the API runs more than one worker.
