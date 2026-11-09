"""Regression tests for issues found in the independent security review."""

from datetime import UTC, datetime, timedelta, timezone

from tests.test_api import make_product


def _stock(client, headers, product_id):
    return next(x["stock"] for x in client.get("/api/products", headers=headers).json() if x["id"] == product_id)


def _sale(client, headers, product_id, created_at):
    return client.post(
        "/api/sales",
        headers=headers,
        json={"payment_method": "cash", "items": [{"product_id": product_id, "quantity": 1}], "created_at": created_at},
    )


def test_sale_cannot_be_dated_in_the_future(client, owner):
    p = make_product(client, owner)
    when = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    r = _sale(client, owner, p["id"], when)
    assert r.status_code == 422
    assert _stock(client, owner, p["id"]) == 10


def test_sale_cannot_be_back_filled_years_ago(client, owner):
    p = make_product(client, owner)
    r = _sale(client, owner, p["id"], "1900-01-01T10:00:00")
    assert r.status_code == 422
    assert _stock(client, owner, p["id"]) == 10


def test_recent_back_fill_is_stored_in_utc(client, owner):
    p = make_product(client, owner)
    local = datetime.now(UTC).replace(microsecond=0) - timedelta(hours=2)
    # Same instant, written with a +01:00 offset.
    r = _sale(client, owner, p["id"], local.astimezone(timezone(timedelta(hours=1))).isoformat())
    assert r.status_code == 201, r.text
    assert r.json()["created_at"].startswith(local.replace(tzinfo=None).isoformat())


def test_login_locks_after_repeated_wrong_passwords(client, owner):
    for _ in range(5):
        r = client.post("/api/auth/login", data={"username": "ama@example.com", "password": "wrong-pass-1"})
        assert r.status_code == 401
    r = client.post("/api/auth/login", data={"username": "ama@example.com", "password": "strong-pass-1"})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_successful_login_clears_failures(client, owner):
    for _ in range(4):
        client.post("/api/auth/login", data={"username": "ama@example.com", "password": "wrong-pass-1"})
    assert client.post("/api/auth/login", data={"username": "ama@example.com", "password": "strong-pass-1"}).status_code == 200
    for _ in range(4):
        assert client.post("/api/auth/login", data={"username": "ama@example.com", "password": "wrong-pass-1"}).status_code == 401


def test_statement_with_too_many_rows_is_refused(client, owner):
    header = "Transaction ID,Date,Type,From,Amount (GHS),Reference\n"
    rows = "".join(f"T{i},2026-11-05 08:00:00,Payment Received,0244 *** 118,1.00,x\n" for i in range(5_001))
    r = client.post("/api/reconciliation", headers=owner, files={"file": ("big.csv", (header + rows).encode(), "text/csv")})
    assert r.status_code == 413
