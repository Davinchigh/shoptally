from datetime import datetime
from pathlib import Path

import pytest

from app.services.statement import StatementError, parse_amount, parse_statement, parse_timestamp

SAMPLE = Path(__file__).resolve().parents[2] / "sample-data" / "momo_statement_sample.csv"


@pytest.mark.parametrize(
    "raw, pesewas",
    [
        ("45.00", 4500),
        ("GHS 1,250.50", 125050),
        ("12", 1200),
        ("0.5", 50),
        ("-200.00", -20000),
        ("(30.00)", -3000),
    ],
)
def test_parse_amount(raw, pesewas):
    assert parse_amount(raw) == pesewas


@pytest.mark.parametrize("raw", ["", "abc", "1.2.3"])
def test_parse_amount_rejects_garbage(raw):
    with pytest.raises(ValueError):
        parse_amount(raw)


@pytest.mark.parametrize("raw", ["2026-11-05 08:13:02", "05/11/2026 08:13", "05 Nov 2026 08:13", "2026-11-05T08:13:00"])
def test_parse_timestamp_formats(raw):
    assert parse_timestamp(raw).replace(second=0) == datetime(2026, 11, 5, 8, 13)


def test_sample_statement_keeps_only_credits():
    rows, skipped = parse_statement(SAMPLE.read_text())
    assert skipped == []
    ids = [r.transaction_id for r in rows]
    assert "MP251105.1430.E5" not in ids  # cash out is money leaving
    assert len(rows) == 6  # five credits plus one duplicate line
    assert rows[0].amount_pesewas == 4500


def test_columns_found_by_alias_and_order_does_not_matter():
    csv = "amount,narration,TXN ID,Date/Time\nGHS 10.00,hi,X1,2026-11-05 10:00\n"
    rows, _ = parse_statement(csv)
    assert rows[0].transaction_id == "X1" and rows[0].amount_pesewas == 1000 and rows[0].reference == "hi"


def test_bad_rows_are_reported_not_fatal():
    csv = "Transaction ID,Date,Amount\nA,2026-11-05 10:00,5.00\nB,yesterday,5.00\nC,2026-11-05 10:00,\n"
    rows, skipped = parse_statement(csv)
    assert [r.transaction_id for r in rows] == ["A"]
    assert len(skipped) == 2 and "line 3" in skipped[0]


def test_missing_required_column_is_an_error():
    with pytest.raises(StatementError, match="amount"):
        parse_statement("Transaction ID,Date\nA,2026-11-05 10:00\n")
