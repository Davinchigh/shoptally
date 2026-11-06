from datetime import datetime, timedelta

from app.services.reconcile import MomoSale, reconcile
from app.services.statement import StatementRow

T0 = datetime(2026, 11, 5, 10, 0)


def pay(txn, minutes, pesewas, who=""):
    return StatementRow(txn, T0 + timedelta(minutes=minutes), pesewas, who, "")


def sale(id_, minutes, pesewas, ref=None):
    return MomoSale(id_, pesewas, T0 + timedelta(minutes=minutes), ref)


def kinds(result):
    return sorted(f.kind for f in result.exceptions)


def test_reference_match_wins_even_when_far_apart_in_time():
    r = reconcile([sale(1, 0, 5000, ref="T1")], [pay("T1", 300, 5000)])
    assert [(m.sale_id, m.transaction_id, m.method) for m in r.matches] == [(1, "T1", "reference")]
    assert r.exceptions == []


def test_reference_with_wrong_amount_is_flagged_not_matched():
    r = reconcile([sale(1, 0, 7600, ref="T1")], [pay("T1", 1, 7000)])
    assert r.matches == []
    assert kinds(r) == ["amount_mismatch"]
    assert r.exceptions[0].expected_pesewas == 7600 and r.exceptions[0].received_pesewas == 7000


def test_amount_and_time_match_inside_window():
    r = reconcile([sale(1, 0, 12000)], [pay("T9", 7, 12000)], window_minutes=30)
    assert r.matches[0].method == "amount_and_time" and r.matches[0].minutes_apart == 7.0


def test_outside_window_is_not_matched():
    r = reconcile([sale(1, 0, 12000)], [pay("T9", 45, 12000)], window_minutes=30)
    assert r.matches == []
    assert kinds(r) == ["missing_payment", "unrecorded_payment"]


def test_closest_pairs_win_and_each_payment_is_used_once():
    # Two GHS 10 sales, two GHS 10 payments. Greedy-by-order would cross them; closest-first must not.
    sales = [sale(1, 0, 1000), sale(2, 20, 1000)]
    pays = [pay("A", 21, 1000), pay("B", 2, 1000)]
    r = reconcile(sales, pays)
    assert {(m.sale_id, m.transaction_id) for m in r.matches} == {(1, "B"), (2, "A")}
    assert r.exceptions == []


def test_one_payment_cannot_cover_two_sales():
    r = reconcile([sale(1, 0, 1000), sale(2, 1, 1000)], [pay("A", 0, 1000)])
    assert len(r.matches) == 1
    assert kinds(r) == ["missing_payment"]


def test_duplicate_transaction_flagged_and_counted_once():
    r = reconcile([sale(1, 0, 2500)], [pay("D", 0, 2500), pay("D", 0, 2500)])
    assert len(r.matches) == 1
    assert kinds(r) == ["duplicate_transaction"]


def test_matched_total():
    r = reconcile([sale(1, 0, 1000), sale(2, 5, 2000)], [pay("A", 1, 1000), pay("B", 6, 2000)])
    assert r.matched_pesewas == 3000


def test_empty_inputs():
    r = reconcile([], [])
    assert r.matches == [] and r.exceptions == []
