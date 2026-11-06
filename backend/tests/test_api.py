from pathlib import Path

from tests.conftest import auth_headers

SAMPLE = Path(__file__).resolve().parents[2] / "sample-data" / "momo_statement_sample.csv"


def make_product(client, headers, sku="MILO", price=4500, stock=10, reorder=3, name="Milo"):
    r = client.post(
        "/api/products",
        headers=headers,
        json={"name": name, "sku": sku, "price_pesewas": price, "stock": stock, "reorder_level": reorder},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "database": "ok"}


def test_register_login_and_me(client):
    auth_headers(client, "kofi@example.com")
    r = client.post("/api/auth/login", data={"username": "KOFI@example.com", "password": "strong-pass-1"})
    assert r.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.json()["email"] == "kofi@example.com"


def test_duplicate_email_and_wrong_password(client):
    auth_headers(client, "esi@example.com")
    r = client.post("/api/auth/register", json={"shop_name": "Esi", "email": "esi@example.com", "password": "strong-pass-1"})
    assert r.status_code == 409
    r = client.post("/api/auth/login", data={"username": "esi@example.com", "password": "nope-nope-nope"})
    assert r.status_code == 401


def test_routes_need_a_token(client):
    assert client.get("/api/products").status_code == 401
    assert client.get("/api/products", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_product_crud_and_duplicate_sku(client, owner):
    p = make_product(client, owner, sku="milo")
    assert p["sku"] == "MILO" and p["low_stock"] is False
    assert client.post("/api/products", headers=owner, json={"name": "x", "sku": "MILO", "price_pesewas": 1}).status_code == 409
    r = client.patch(f"/api/products/{p['id']}", headers=owner, json={"price_pesewas": 5000})
    assert r.json()["price_pesewas"] == 5000
    r = client.post(f"/api/products/{p['id']}/restock", headers=owner, json={"quantity": 5})
    assert r.json()["stock"] == 15


def test_shops_cannot_see_each_others_products(client, owner):
    p = make_product(client, owner)
    other = auth_headers(client, "rival@example.com")
    assert client.get("/api/products", headers=other).json() == []
    assert client.patch(f"/api/products/{p['id']}", headers=other, json={"price_pesewas": 1}).status_code == 404


def test_sale_reduces_stock_and_prices_server_side(client, owner):
    p = make_product(client, owner, stock=5, reorder=3)
    r = client.post(
        "/api/sales",
        headers=owner,
        json={
            "payment_method": "momo",
            "momo_reference": "T1",
            "items": [{"product_id": p["id"], "quantity": 1}, {"product_id": p["id"], "quantity": 1}],
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["total_pesewas"] == 9000
    stock = client.get("/api/products", headers=owner).json()[0]
    assert stock["stock"] == 3 and stock["low_stock"] is True


def test_cannot_oversell(client, owner):
    p = make_product(client, owner, stock=1)
    r = client.post(
        "/api/sales", headers=owner, json={"payment_method": "cash", "items": [{"product_id": p["id"], "quantity": 2}]}
    )
    assert r.status_code == 409 and "have 1, need 2" in r.json()["detail"]
    assert client.get("/api/products", headers=owner).json()[0]["stock"] == 1


def test_cash_sale_cannot_carry_momo_reference(client, owner):
    p = make_product(client, owner)
    r = client.post(
        "/api/sales",
        headers=owner,
        json={"payment_method": "cash", "momo_reference": "T1", "items": [{"product_id": p["id"], "quantity": 1}]},
    )
    assert r.status_code == 422


def test_daily_report(client, owner):
    p = make_product(client, owner, stock=10)
    for method in ("cash", "momo", "momo"):
        client.post(
            "/api/sales",
            headers=owner,
            json={
                "payment_method": method,
                "items": [{"product_id": p["id"], "quantity": 1}],
                "created_at": "2026-11-05T09:00:00",
            },
        )
    r = client.get("/api/reports/daily?day=2026-11-05", headers=owner).json()
    assert r["sales_count"] == 3 and r["cash_pesewas"] == 4500 and r["momo_pesewas"] == 9000


def test_reconciliation_end_to_end_with_sample_statement(client, owner):
    milo = make_product(client, owner, sku="MILO", price=4500, stock=20)
    rice = make_product(client, owner, sku="RICE", price=12000, stock=5, name="Rice")
    oil = make_product(client, owner, sku="OIL", price=3800, stock=10, name="Oil")

    def sell(when, items, ref=None, method="momo"):
        body = {"payment_method": method, "created_at": when, "items": items}
        if ref:
            body["momo_reference"] = ref
        assert client.post("/api/sales", headers=owner, json=body).status_code == 201

    sell("2026-11-05T08:12:00", [{"product_id": milo["id"], "quantity": 1}], ref="MP251105.0812.A1")
    sell("2026-11-05T10:05:00", [{"product_id": rice["id"], "quantity": 1}])
    sell("2026-11-05T13:15:00", [{"product_id": oil["id"], "quantity": 2}], ref="MP251105.1316.C7")
    sell("2026-11-05T15:50:00", [{"product_id": milo["id"], "quantity": 2}])
    sell("2026-11-05T09:40:00", [{"product_id": milo["id"], "quantity": 1}], method="cash")  # ignored

    with SAMPLE.open("rb") as f:
        r = client.post("/api/reconciliation", headers=owner, files={"file": ("statement.csv", f, "text/csv")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["momo_sales_count"] == 4
    assert {m["transaction_id"] for m in body["matches"]} == {"MP251105.0812.A1", "MP251105.1007.B4"}
    kinds = sorted(e["kind"] for e in body["exceptions"])
    # 11:33 GHS 51 and 14:00 GHS 25 have no sale here, the oil sale was underpaid,
    # the 15:50 Milo sale never got paid, and one line is a duplicate.
    assert kinds == ["amount_mismatch", "duplicate_transaction", "missing_payment", "unrecorded_payment", "unrecorded_payment"]
    assert body["received_pesewas"] == 4500 + 12000 + 5100 + 7000 + 2500
    assert body["expected_pesewas"] == 4500 + 12000 + 7600 + 9000


def test_reconciliation_rejects_unusable_file(client, owner):
    r = client.post("/api/reconciliation", headers=owner, files={"file": ("x.csv", b"hello,world\n1,2\n", "text/csv")})
    assert r.status_code == 422 and "missing required columns" in r.json()["detail"]


def test_production_refuses_placeholder_signing_key():
    import pytest

    from app.config import Settings

    with pytest.raises(RuntimeError):
        Settings(environment="production", jwt_secret="change-me-in-production").check()
    Settings(environment="production", jwt_secret="x" * 40).check()
