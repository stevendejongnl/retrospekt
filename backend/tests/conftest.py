"""Shared test fixtures.

DI strategy:
- mongomock_motor provides a real in-memory MongoDB — no patching, no mocks.
- app.dependency_overrides[get_repo] swaps the production repo for one backed by that DB.
- Each test gets a fresh, isolated database via the `db` fixture.
"""

from dataclasses import dataclass

import fakeredis.aioredis
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from src.dependencies import get_repo
from src.main import create_app
from src.repositories.session_repo import SessionRepository
from src.services.sse_manager import sse_manager


@pytest_asyncio.fixture(autouse=True)
async def fake_redis():
    """Wire a fresh in-memory Redis into the sse_manager singleton for each test."""
    client = fakeredis.aioredis.FakeRedis()
    sse_manager.set_client(client)
    yield client
    await client.aclose()
    sse_manager.set_client(None)


@pytest_asyncio.fixture
async def db():
    """Fresh in-memory MongoDB for each test."""
    client = AsyncMongoMockClient()
    yield client["retrospekt"]


@pytest_asyncio.fixture
async def client(db):
    """FastAPI test client wired to the in-memory DB via dependency override."""
    app = create_app()
    app.dependency_overrides[get_repo] = lambda: SessionRepository(db)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Domain helper — used by every test that needs an existing session
# ---------------------------------------------------------------------------

@dataclass
class SessionFixture:
    id: str
    facilitator_token: str
    name: str


async def make_session(
    client: AsyncClient,
    *,
    name: str = "Test Retro",
    facilitator: str = "Alice",
) -> SessionFixture:
    """Create a session and return its id + facilitator_token.

    The facilitator_token is only returned on creation, so every test that
    needs to perform a privileged action (phase change) must call this helper
    rather than a plain GET.

    TODO: This is your domain design choice.
    Consider:
    - What defaults make tests readable? ("Sprint 42" vs generic "Test Retro"?)
    - Should extra participants be joinable here, or separately via `join_session`?
    - What would make a failing test error message as clear as possible?

    Implement the body below (5-10 lines):
    """
    # --- your implementation here ---
    response = await client.post(
        "/api/v1/sessions",
        json={"name": name, "participant_name": facilitator},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return SessionFixture(
        id=data["id"],
        facilitator_token=data["facilitator_token"],
        name=data["name"],
    )
