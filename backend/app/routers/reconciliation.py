from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import PaymentMethod, Sale, Shop
from ..schemas import ExceptionOut, MatchOut, ReconciliationOut
from ..security import current_shop
from ..services.reconcile import MomoSale, reconcile
from ..services.statement import StatementError, parse_statement

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])
MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5_000  # a busy shop does a few hundred MoMo payments a day


@router.post("", response_model=ReconciliationOut)
async def reconcile_statement(
    file: UploadFile = File(..., description="MoMo statement exported as CSV"),
    shop: Shop = Depends(current_shop),
    db: Session = Depends(get_db),
):
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Statement is larger than 2 MB")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    try:
        rows, skipped = parse_statement(text)
    except StatementError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None
    if len(rows) > MAX_ROWS:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"Statement has {len(rows)} payments; upload at most {MAX_ROWS} at a time",
        )

    window = get_settings().match_window_minutes
    # A statement covers whole days, so compare against every MoMo sale on those days.
    first = min((r.timestamp for r in rows), default=None)
    last = max((r.timestamp for r in rows), default=None)
    start = first.replace(hour=0, minute=0, second=0, microsecond=0) if first else None
    end = last.replace(hour=23, minute=59, second=59, microsecond=0) if last else None

    sales: list[Sale] = []
    if start and end:
        pad = timedelta(minutes=window)
        sales = db.scalars(
            select(Sale).where(
                Sale.shop_id == shop.id,
                Sale.payment_method == PaymentMethod.momo,
                Sale.created_at >= start - pad,
                Sale.created_at <= end + pad,
            )
        ).all()

    result = reconcile(
        [MomoSale(s.id, s.total_pesewas, s.created_at, s.momo_reference) for s in sales],
        rows,
        window_minutes=window,
    )
    seen, received = set(), 0
    for r in rows:
        if r.transaction_id not in seen:
            seen.add(r.transaction_id)
            received += r.amount_pesewas
    expected = sum(s.total_pesewas for s in sales)
    return ReconciliationOut(
        period_start=start,
        period_end=end,
        statement_rows=len(rows),
        skipped_rows=skipped,
        momo_sales_count=len(sales),
        expected_pesewas=expected,
        received_pesewas=received,
        matched_pesewas=result.matched_pesewas,
        difference_pesewas=received - expected,
        matches=[MatchOut(**m.__dict__) for m in result.matches],
        exceptions=[ExceptionOut(**e.__dict__) for e in result.exceptions],
    )
