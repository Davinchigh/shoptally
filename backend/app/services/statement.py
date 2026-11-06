"""Read a mobile money statement exported as CSV.

Exports differ between networks and over time, so columns are found by name using a list
of common aliases instead of fixed positions. Only incoming payments (credits) are kept,
because those are what a shop's sales should line up with.
"""

import csv
import io
import re
from dataclasses import dataclass
from datetime import datetime

ALIASES = {
    "transaction_id": [
        "transaction id",
        "txn id",
        "transaction ref",
        "financial transaction id",
        "external transaction id",
        "id",
    ],
    "timestamp": ["date", "date/time", "datetime", "transaction date", "timestamp", "time"],
    "amount": ["amount", "amount (ghs)", "amount ghs", "credit", "value"],
    "direction": ["type", "transaction type", "direction", "dr/cr"],
    "counterparty": ["from", "sender", "from name", "from account", "counterparty", "customer"],
    "reference": ["reference", "description", "narration", "message", "note"],
}

DATE_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%dT%H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d-%m-%Y %H:%M",
    "%d %b %Y %H:%M",
]

CREDIT_WORDS = {"credit", "cr", "in", "received", "payment received", "transfer received", "receive"}
DEBIT_WORDS = {"debit", "dr", "out", "sent", "withdrawal", "cash out", "payment sent", "transfer sent"}


@dataclass(frozen=True)
class StatementRow:
    transaction_id: str
    timestamp: datetime
    amount_pesewas: int
    counterparty: str
    reference: str


class StatementError(ValueError):
    pass


def parse_amount(raw: str) -> int:
    """'GHS 1,250.50' -> 125050 pesewas. Negative or bracketed amounts come back negative."""
    text = (raw or "").strip()
    negative = text.startswith("-") or (text.startswith("(") and text.endswith(")"))
    digits = re.sub(r"[^0-9.]", "", text)
    if not digits or digits.count(".") > 1:
        raise ValueError(f"not an amount: {raw!r}")
    whole, _, frac = digits.partition(".")
    pesewas = int(whole or "0") * 100 + int((frac + "00")[:2])
    return -pesewas if negative else pesewas


def parse_timestamp(raw: str) -> datetime:
    text = (raw or "").strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise ValueError(f"unrecognised date: {raw!r}")


def _find_columns(header: list[str]) -> dict[str, int]:
    normalised = [h.strip().lower() for h in header]
    found: dict[str, int] = {}
    for field, names in ALIASES.items():
        for name in names:
            if name in normalised:
                found[field] = normalised.index(name)
                break
    missing = [f for f in ("transaction_id", "timestamp", "amount") if f not in found]
    if missing:
        raise StatementError(f"statement is missing required columns: {', '.join(missing)}")
    return found


def parse_statement(content: str) -> tuple[list[StatementRow], list[str]]:
    """Return (credit rows, human readable notes about rows that were skipped)."""
    reader = csv.reader(io.StringIO(content.lstrip("﻿")))
    rows = [r for r in reader if any(cell.strip() for cell in r)]
    if not rows:
        raise StatementError("the file is empty")
    cols = _find_columns(rows[0])

    credits: list[StatementRow] = []
    skipped: list[str] = []
    for line_no, row in enumerate(rows[1:], start=2):

        def cell(field: str, row: list[str] = row) -> str:
            i = cols.get(field)
            return row[i].strip() if i is not None and i < len(row) else ""

        try:
            amount = parse_amount(cell("amount"))
            when = parse_timestamp(cell("timestamp"))
        except ValueError as exc:
            skipped.append(f"line {line_no}: {exc}")
            continue

        direction = cell("direction").lower()
        if direction in DEBIT_WORDS or amount < 0:
            continue  # money going out is not a sale
        if direction and direction not in CREDIT_WORDS:
            skipped.append(f"line {line_no}: unknown transaction type {cell('direction')!r}")
            continue

        txn = cell("transaction_id")
        if not txn:
            skipped.append(f"line {line_no}: no transaction id")
            continue
        credits.append(StatementRow(txn, when, amount, cell("counterparty"), cell("reference")))
    return credits, skipped
