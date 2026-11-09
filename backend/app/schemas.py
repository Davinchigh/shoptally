from datetime import UTC, datetime, timedelta

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import PaymentMethod


class Register(BaseModel):
    shop_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ShopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sku: str = Field(min_length=1, max_length=60)
    price_pesewas: int = Field(gt=0)
    stock: int = Field(ge=0, default=0)
    reorder_level: int = Field(ge=0, default=5)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    price_pesewas: int | None = Field(default=None, gt=0)
    reorder_level: int | None = Field(default=None, ge=0)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    sku: str
    price_pesewas: int
    stock: int
    reorder_level: int
    low_stock: bool = False


class Restock(BaseModel):
    quantity: int = Field(gt=0, le=100_000)
    note: str | None = Field(default=None, max_length=200)


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=10_000)


class SaleIn(BaseModel):
    items: list[SaleItemIn] = Field(min_length=1)
    payment_method: PaymentMethod
    momo_reference: str | None = Field(default=None, max_length=80)
    customer_phone: str | None = Field(default=None, max_length=20)
    created_at: datetime | None = None  # lets a shop back-fill a sale it forgot to record

    @field_validator("created_at")
    @classmethod
    def sane_back_fill(cls, v: datetime | None) -> datetime | None:
        """Store naive UTC, and only allow back-filling within the last 31 days."""
        if v is None:
            return None
        if v.tzinfo is not None:
            v = v.astimezone(UTC)
        v = v.replace(tzinfo=None)
        now = datetime.now(UTC).replace(tzinfo=None)
        if v > now + timedelta(minutes=5):
            raise ValueError("A sale can't be dated in the future")
        if v < now - timedelta(days=31):
            raise ValueError("You can only back-fill sales from the last 31 days")
        return v

    @field_validator("momo_reference")
    @classmethod
    def strip_reference(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_id: int
    quantity: int
    unit_price_pesewas: int


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    payment_method: PaymentMethod
    momo_reference: str | None
    customer_phone: str | None
    total_pesewas: int
    created_at: datetime
    items: list[SaleItemOut]


class MatchOut(BaseModel):
    sale_id: int
    transaction_id: str
    amount_pesewas: int
    method: str  # "reference" or "amount_and_time"
    minutes_apart: float


class ExceptionOut(BaseModel):
    kind: str  # unrecorded_payment, missing_payment, amount_mismatch, duplicate_transaction
    message: str
    sale_id: int | None = None
    transaction_id: str | None = None
    expected_pesewas: int | None = None
    received_pesewas: int | None = None


class ReconciliationOut(BaseModel):
    period_start: datetime | None
    period_end: datetime | None
    statement_rows: int
    skipped_rows: list[str]
    momo_sales_count: int
    expected_pesewas: int
    received_pesewas: int
    matched_pesewas: int
    difference_pesewas: int
    matches: list[MatchOut]
    exceptions: list[ExceptionOut]


class DailySummary(BaseModel):
    date: str
    sales_count: int
    cash_pesewas: int
    momo_pesewas: int
    total_pesewas: int
    low_stock: list[ProductOut]
