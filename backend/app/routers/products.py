from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import MovementKind, Product, Shop, StockMovement
from ..schemas import ProductIn, ProductOut, ProductUpdate, Restock
from ..security import current_shop

router = APIRouter(prefix="/api/products", tags=["products"])


def to_out(p: Product) -> ProductOut:
    out = ProductOut.model_validate(p)
    out.low_stock = p.stock <= p.reorder_level
    return out


def get_owned(db: Session, shop: Shop, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.shop_id != shop.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


@router.get("", response_model=list[ProductOut])
def list_products(shop: Shop = Depends(current_shop), db: Session = Depends(get_db)):
    rows = db.scalars(select(Product).where(Product.shop_id == shop.id).order_by(Product.name)).all()
    return [to_out(p) for p in rows]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductIn, shop: Shop = Depends(current_shop), db: Session = Depends(get_db)):
    product = Product(shop_id=shop.id, **body.model_dump())
    product.sku = product.sku.strip().upper()
    db.add(product)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"SKU {product.sku} already exists") from None
    if product.stock:
        db.add(StockMovement(product_id=product.id, kind=MovementKind.restock, change=product.stock, note="opening stock"))
    db.commit()
    return to_out(product)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, shop: Shop = Depends(current_shop), db: Session = Depends(get_db)):
    product = get_owned(db, shop, product_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    db.commit()
    return to_out(product)


@router.post("/{product_id}/restock", response_model=ProductOut)
def restock(product_id: int, body: Restock, shop: Shop = Depends(current_shop), db: Session = Depends(get_db)):
    product = get_owned(db, shop, product_id)
    product.stock += body.quantity
    db.add(StockMovement(product_id=product.id, kind=MovementKind.restock, change=body.quantity, note=body.note))
    db.commit()
    return to_out(product)
