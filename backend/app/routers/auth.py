from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import throttle
from ..db import get_db
from ..models import Shop
from ..schemas import Register, ShopOut, Token
from ..security import create_token, current_shop, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(body: Register, db: Session = Depends(get_db)) -> Token:
    email = body.email.lower()
    if db.scalar(select(Shop).where(Shop.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    shop = Shop(name=body.shop_name.strip(), email=email, password_hash=hash_password(body.password))
    db.add(shop)
    db.commit()
    return Token(access_token=create_token(shop.id))


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    email = form.username.lower()
    wait = throttle.seconds_locked(email)
    if wait:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many wrong passwords. Try again in {wait // 60 + 1} minutes.",
            headers={"Retry-After": str(wait)},
        )
    shop = db.scalar(select(Shop).where(Shop.email == email))
    if shop is None or not verify_password(form.password, shop.password_hash):
        throttle.record_failure(email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    throttle.clear(email)
    return Token(access_token=create_token(shop.id))


@router.get("/me", response_model=ShopOut)
def me(shop: Shop = Depends(current_shop)) -> Shop:
    return shop
