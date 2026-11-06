"""Create a demo shop with products and a day of sales that lines up with sample-data/momo_statement_sample.csv.

Run: python -m app.seed
Login: demo@shoptally.app / demo-pass-123
"""

from datetime import datetime

from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .models import MovementKind, PaymentMethod, Product, Sale, SaleItem, Shop, StockMovement
from .security import hash_password

PRODUCTS = [
    ("Milo 400g tin", "MILO-400", 4500, 24, 6),
    ("Ideal milk (pack of 6)", "IDEAL-6", 3600, 15, 5),
    ("Rice 5kg bag", "RICE-5", 12000, 8, 3),
    ("Sunflower oil 1L", "OIL-1L", 3800, 4, 5),
    ("Bread, sliced", "BREAD", 1500, 30, 10),
]

# (time, payment method, momo reference, [(sku, qty)])
SALES = [
    ("2026-11-05 08:12", "momo", "MP251105.0812.A1", [("MILO-400", 1)]),
    ("2026-11-05 09:40", "cash", None, [("BREAD", 2)]),
    ("2026-11-05 10:05", "momo", None, [("RICE-5", 1)]),
    ("2026-11-05 11:30", "momo", None, [("IDEAL-6", 1), ("BREAD", 1)]),
    ("2026-11-05 13:15", "momo", "MP251105.1316.C7", [("OIL-1L", 2)]),
    ("2026-11-05 15:50", "momo", None, [("MILO-400", 2)]),
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.scalar(select(Shop).where(Shop.email == "demo@shoptally.app")):
            print("demo shop already exists")
            return
        shop = Shop(name="Auntie Ama's Provisions", email="demo@shoptally.app", password_hash=hash_password("demo-pass-123"))
        db.add(shop)
        db.flush()
        by_sku = {}
        for name, sku, price, stock, reorder in PRODUCTS:
            p = Product(shop_id=shop.id, name=name, sku=sku, price_pesewas=price, stock=stock, reorder_level=reorder)
            db.add(p)
            db.flush()
            db.add(StockMovement(product_id=p.id, kind=MovementKind.restock, change=stock, note="opening stock"))
            by_sku[sku] = p
        for when, method, ref, items in SALES:
            sale = Sale(
                shop_id=shop.id,
                payment_method=PaymentMethod(method),
                momo_reference=ref,
                total_pesewas=0,
                created_at=datetime.strptime(when, "%Y-%m-%d %H:%M"),
            )
            for sku, qty in items:
                p = by_sku[sku]
                p.stock -= qty
                sale.items.append(SaleItem(product_id=p.id, quantity=qty, unit_price_pesewas=p.price_pesewas))
                sale.total_pesewas += p.price_pesewas * qty
            db.add(sale)
        db.commit()
        print("demo shop created: demo@shoptally.app / demo-pass-123")


if __name__ == "__main__":
    run()
