import os

# Point the app at a throwaway database before it is imported. CI overrides this with MySQL.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret-with-enough-length-0123456789")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def auth_headers(client: TestClient, email: str = "ama@example.com") -> dict[str, str]:
    r = client.post("/api/auth/register", json={"shop_name": "Ama Provisions", "email": email, "password": "strong-pass-1"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def owner(client):
    return auth_headers(client)
