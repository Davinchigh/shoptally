"""Slow down password guessing.

Counts failed logins per email in memory. After MAX_FAILURES inside WINDOW,
that email is locked until the oldest failure ages out. In-memory is enough
for a single API process; with several workers, move this to Redis.
"""

import time
from collections import defaultdict, deque
from threading import Lock

MAX_FAILURES = 5
WINDOW_SECONDS = 15 * 60

_failures: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def _prune(q: deque[float], now: float) -> None:
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()


def seconds_locked(email: str) -> int:
    """0 if the email may try to log in, otherwise seconds until it can."""
    now = time.monotonic()
    with _lock:
        q = _failures.get(email)
        if not q:
            return 0
        _prune(q, now)
        if len(q) < MAX_FAILURES:
            return 0
        return int(WINDOW_SECONDS - (now - q[0])) + 1


def record_failure(email: str) -> None:
    with _lock:
        _failures[email].append(time.monotonic())


def clear(email: str) -> None:
    with _lock:
        _failures.pop(email, None)


def reset_all() -> None:
    with _lock:
        _failures.clear()
