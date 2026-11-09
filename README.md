# ShopTally

Stock, sales and mobile money reconciliation for small shops.

A provisions shop in Accra can take dozens of MoMo payments a day. At closing time the owner has two lists that should agree: the sales they recorded and the money that actually landed on their MoMo wallet. Checking them by hand is slow, so short payments, forgotten sales and "I've sent it" payments that never arrived slip through. ShopTally keeps the stock and sales side, reads the MoMo statement, matches every payment to a sale, and lists only what doesn't add up.

![CI](https://github.com/Davinchigh/shoptally/actions/workflows/ci.yml/badge.svg)

## What it does

* **Sell:** pick items, choose MoMo or cash, optionally type the MoMo transaction ID. Prices come from the server and stock is checked and reduced in the same database transaction, so a sale can never oversell.
* **Stock:** products with SKUs, opening stock, restocks and a "warn me at" level. Every change is written to a stock movement log.
* **Today:** totals by payment method and what is running low, for any day.
* **Reconcile:** upload the CSV statement. ShopTally reports what you recorded, what you received, what matched, the difference, and a plain-language list of problems.

## How matching works

The matcher is a pure function in [`backend/app/services/reconcile.py`](backend/app/services/reconcile.py), so it is tested without a database.

1. **By transaction ID.** If a sale recorded the MoMo transaction ID, it is matched to that line. If the amounts differ it becomes an `amount_mismatch`, never a match.
2. **By amount and time.** Remaining sales are paired with remaining payments of exactly the same amount inside a time window (30 minutes by default). Pairs are chosen closest in time first, and each payment and each sale is used once, so two GHS 10 sales can't both claim the same GHS 10 payment.
3. **Leftovers become flags:** `missing_payment` (sold as MoMo, no money), `unrecorded_payment` (money, no sale), `duplicate_transaction` (same ID twice in the file, counted once).

Money is stored and compared as whole pesewas (integers), so totals never drift the way floats do.

The statement reader finds columns by name (for example `Transaction ID`, `TXN ID` or `Financial Transaction ID`), accepts several date formats and amounts like `GHS 1,250.50`, keeps only incoming payments and reports any line it cannot read instead of failing the whole file. Statement exports differ between networks and change over time, so treat the column list in [`statement.py`](backend/app/services/statement.py) as a starting point: it is tested against the sample in [`sample-data/`](sample-data/), not against every real export.

## Stack

| Part | Choice |
| --- | --- |
| Web app | React 19, TypeScript, Vite, plain CSS with design tokens |
| API | Python 3.12, FastAPI, Pydantic, SQLAlchemy 2 |
| Database | MySQL 8 (SQLite for quick local runs and unit tests) |
| Auth | Email and password (bcrypt), JWT bearer tokens, every query scoped to the signed-in shop |
| Infra | Docker images for API and web, Docker Compose for the full stack, nginx serving the app and proxying `/api` |
| CI | GitHub Actions: ruff lint and format check, pytest against a real MySQL service, TypeScript check, Vitest, production build, Docker builds and a full stack smoke test |

```
browser ──> nginx (web container) ──/api──> FastAPI (api container) ──> MySQL (db container)
```

## Run it

Whole stack with Docker:

```bash
docker compose up --build
# web  http://localhost:8080
# api  http://localhost:8000/docs  (interactive API docs)
docker compose exec api python -m app.seed   # optional demo shop
```

Without Docker:

```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt pytest httpx ruff
python -m app.seed            # demo shop on SQLite
uvicorn app.main:app --reload # http://localhost:8000/docs

cd ../frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api to port 8000
```

Demo login: `demo@shoptally.app` / `demo-pass-123`. Its sales line up with the sample statement, so **Reconcile → Use the sample statement** shows every kind of flag.

Settings come from environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `MATCH_WINDOW_MINUTES` and `ENVIRONMENT`. With `ENVIRONMENT=production` the API refuses to start until `JWT_SECRET` is a real random value.

## Tests

```bash
cd backend && pytest -q      # 45 tests: statement parsing, matching rules, API flows, shop isolation, abuse limits
cd frontend && npm test      # money formatting and parsing
```

## API

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a shop, returns a token |
| POST | `/api/auth/login` | Form login, returns a token |
| GET | `/api/auth/me` | The signed-in shop |
| GET, POST | `/api/products` | List or add products |
| PATCH | `/api/products/{id}` | Change name, price or warning level |
| POST | `/api/products/{id}/restock` | Add stock |
| GET, POST | `/api/sales` | List or record sales |
| GET | `/api/reports/daily?day=YYYY-MM-DD` | Totals and low stock for a day |
| POST | `/api/reconciliation` | Upload a CSV statement, get matches and flags |
| GET | `/api/health` | Liveness and database check |

## What I'd add next

* Alembic migrations instead of creating tables on start.
* Reading statements straight from a MoMo provider's API instead of CSV uploads.
* Letting the owner resolve a flag (for example "personal transfer, not a sale") and keeping that history.
* Multiple staff accounts per shop with roles.

Built by [Benedict Frimpong Boateng](https://benedict-frimpong-boateng.vercel.app) with Claude Code.
