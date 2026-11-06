from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import MovementKind, PaymentMethod, Product, Sale, SaleItem, Shop, StockMovement, utcnow
from ..schemas import DailySummary, SaleIn, SaleOut
from ..security import current_shop
from .products import to_out

router = APIRouter(prefix="/api", tags=["sales"])


@router.post("/sales", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def record_sale(body: SaleIn, shop: Shop = Depends(current_shop), db: Session = Depends(get_db)):
    if body.payment_method == PaymentMethod.cash and body.momo_reference:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A cash sale cannot have a MoMo reference")

    # Lock the rows we are about to change so two tills cannot oversell the same item.
    ids = sorted({i.product_id for i in body.items})
    products = {
        p.id: p for p in db.scalars(select(Product).where(Product.id.in_(ids), Product.shop_id == shop.id).with_for_update())
    }
    missing = [i for i in ids if i not in products]
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown product id(s): {missing}")

    wanted: dict[int, int] = {}
    for item in body.items:
        wanted[item.product_id] = wanted.get(item.product_id, 0) + item.quantity
    short = [
        f"{products[pid].name} (have {products[pid].stock}, need {qty})"
        for pid, qty in wanted.items()
        if products[pid].stock < qty
    ]
    if short:
        raise HTTPException(status.HTTP_409_CONFLICT, "Not enough stock: " + "; ".join(short))

    sale = Sale(
        shop_id=shop.id,
        payment_method=body.payment_method,
        momo_reference=body.momo_reference,
        customer_phone=body.customer_phone,
        total_pesewas=0,
        created_at=(body.created_at.replace(tzinfo=None) if body.created_at else utcnow()),
    )
    total = 0
    for pid, qty in wanted.items():
        product = products[pid]
        product.stock -= qty
        total += product.price_pesewas * qty
        sale.items.append(SaleItem(product_id=pid, quantity=qty, unit_price_pesewas=product.price_pesewas))
    sale.total_pesewas = total
    db.add(sale)
    db.flush()
    for pid, qty in wanted.items():
        db.add(StockMovement(product_id=pid, kind=MovementKind.sale, change=-qty, note=f"sale #{sale.id}"))
    db.commit()
    return sale


@router.get("/sales", response_model=list[SaleOut])
def list_sales(
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(100, ge=1, le=500),
    shop: Shop = Depends(current_shop),
    db: Session = Depends(get_db),
):
    q = select(Sale).where(Sale.shop_id == shop.id).options(selectinload(Sale.items))
    if start:
        q = q.where(Sale.created_at >= start.replace(tzinfo=None))
    if end:
        q = q.where(Sale.created_at <= end.replace(tzinfo=None))
    return db.scalars(q.order_by(Sale.created_at.desc()).limit(limit)).all()


@router.get("/reports/daily", response_model=DailySummary)
def daily_summary(day: str | None = None, shop: Shop = Depends(current_shop), db: Session = Depends(get_db)):
    try:
        start = datetime.strptime(day, "%Y-%m-%d") if day else utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "day must look like 2026-11-06") from None
    sales = db.scalars(
        select(Sale).where(Sale.shop_id == shop.id, Sale.created_at >= start, Sale.created_at < start + timedelta(days=1))
    ).all()
    cash = sum(s.total_pesewas for s in sales if s.payment_method == PaymentMethod.cash)
    momo = sum(s.total_pesewas for s in sales if s.payment_method == PaymentMethod.momo)
    low = db.scalars(
        select(Product).where(Product.shop_id == shop.id, Product.stock <= Product.reorder_level).order_by(Product.stock)
    ).all()
    return DailySummary(
        date=start.date().isoformat(),
        sales_count=len(sales),
        cash_pesewas=cash,
        momo_pesewas=momo,
        total_pesewas=cash + momo,
        low_stock=[to_out(p) for p in low],
    )
