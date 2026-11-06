"""Match recorded MoMo sales against the money that actually arrived.

The matcher is a pure function (no database), so it is easy to test and reason about.

Pass 1, reference: a sale that recorded the MoMo transaction ID is matched to that row.
         If the amounts differ, it is an amount_mismatch, not a match.
Pass 2, amount and time: remaining sales are paired with remaining payments of exactly the
         same amount within a time window. Pairs are chosen closest-in-time first, and each
         payment and each sale is used at most once.
Leftovers become exceptions the shop owner should look at:
  unrecorded_payment  money arrived but no sale explains it
  missing_payment     a sale was recorded as MoMo but no payment matches it
  duplicate_transaction  the same transaction ID appears twice in the statement
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .statement import StatementRow


@dataclass(frozen=True)
class MomoSale:
    id: int
    amount_pesewas: int
    created_at: datetime
    reference: str | None = None


@dataclass
class Match:
    sale_id: int
    transaction_id: str
    amount_pesewas: int
    method: str
    minutes_apart: float


@dataclass
class Flag:
    kind: str
    message: str
    sale_id: int | None = None
    transaction_id: str | None = None
    expected_pesewas: int | None = None
    received_pesewas: int | None = None


@dataclass
class Result:
    matches: list[Match] = field(default_factory=list)
    exceptions: list[Flag] = field(default_factory=list)

    @property
    def matched_pesewas(self) -> int:
        return sum(m.amount_pesewas for m in self.matches)


def ghs(pesewas: int) -> str:
    return f"GHS {pesewas / 100:,.2f}"


def _minutes(a: datetime, b: datetime) -> float:
    return round(abs((a - b).total_seconds()) / 60, 1)


def reconcile(sales: list[MomoSale], rows: list[StatementRow], window_minutes: int = 30) -> Result:
    result = Result()
    window = timedelta(minutes=window_minutes)

    # Duplicates: keep the first occurrence, flag the rest.
    seen: set[str] = set()
    payments: list[StatementRow] = []
    for row in rows:
        if row.transaction_id in seen:
            result.exceptions.append(
                Flag(
                    "duplicate_transaction",
                    f"Transaction {row.transaction_id} appears more than once in the statement.",
                    transaction_id=row.transaction_id,
                    received_pesewas=row.amount_pesewas,
                )
            )
            continue
        seen.add(row.transaction_id)
        payments.append(row)

    by_id = {p.transaction_id: p for p in payments}
    used_payments: set[str] = set()
    open_sales: list[MomoSale] = []

    # Pass 1: by reference.
    for sale in sales:
        ref = (sale.reference or "").strip()
        payment = by_id.get(ref) if ref else None
        if payment is None or payment.transaction_id in used_payments:
            open_sales.append(sale)
            continue
        used_payments.add(payment.transaction_id)
        if payment.amount_pesewas == sale.amount_pesewas:
            result.matches.append(
                Match(
                    sale.id,
                    payment.transaction_id,
                    sale.amount_pesewas,
                    "reference",
                    _minutes(sale.created_at, payment.timestamp),
                )
            )
        else:
            result.exceptions.append(
                Flag(
                    "amount_mismatch",
                    f"Sale #{sale.id} was {ghs(sale.amount_pesewas)} but transaction {payment.transaction_id} "
                    f"paid {ghs(payment.amount_pesewas)}.",
                    sale_id=sale.id,
                    transaction_id=payment.transaction_id,
                    expected_pesewas=sale.amount_pesewas,
                    received_pesewas=payment.amount_pesewas,
                )
            )

    # Pass 2: same amount, closest in time, one to one.
    candidates = []
    for sale in open_sales:
        for p in payments:
            if p.transaction_id in used_payments or p.amount_pesewas != sale.amount_pesewas:
                continue
            gap = abs(p.timestamp - sale.created_at)
            if gap <= window:
                candidates.append((gap, sale.id, p.transaction_id, sale, p))
    candidates.sort(key=lambda c: (c[0], c[1], c[2]))
    matched_sales: set[int] = set()
    for _, _, _, sale, p in candidates:
        if sale.id in matched_sales or p.transaction_id in used_payments:
            continue
        matched_sales.add(sale.id)
        used_payments.add(p.transaction_id)
        result.matches.append(
            Match(sale.id, p.transaction_id, sale.amount_pesewas, "amount_and_time", _minutes(sale.created_at, p.timestamp))
        )

    # Leftovers.
    for sale in open_sales:
        if sale.id not in matched_sales:
            result.exceptions.append(
                Flag(
                    "missing_payment",
                    f"Sale #{sale.id} ({ghs(sale.amount_pesewas)}) was recorded as MoMo but no matching payment arrived.",
                    sale_id=sale.id,
                    expected_pesewas=sale.amount_pesewas,
                )
            )
    for p in payments:
        if p.transaction_id not in used_payments:
            who = f" from {p.counterparty}" if p.counterparty else ""
            result.exceptions.append(
                Flag(
                    "unrecorded_payment",
                    f"{ghs(p.amount_pesewas)}{who} arrived ({p.transaction_id}) but no sale was recorded for it.",
                    transaction_id=p.transaction_id,
                    received_pesewas=p.amount_pesewas,
                )
            )

    result.matches.sort(key=lambda m: m.sale_id)
    return result
