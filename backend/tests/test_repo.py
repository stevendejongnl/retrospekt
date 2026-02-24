"""SessionRepository specifications — methods not exercised by HTTP layer tests."""

from datetime import UTC, datetime, timedelta

import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient

from src.models.session import Session
from src.repositories.session_repo import SessionRepository


@pytest_asyncio.fixture
async def repo():
    client = AsyncMongoMockClient()
    yield SessionRepository(client["retrospekt"])


async def _create(repo: SessionRepository, *, name: str = "Test") -> Session:
    session = Session(id=f"s-{name}", name=name)
    return await repo.create(session)


async def test_ensure_indexes_runs_without_error(repo: SessionRepository):
    await repo.ensure_indexes()  # must not raise


async def test_delete_stale_removes_sessions_not_accessed_recently(repo: SessionRepository):
    old_session = await _create(repo, name="Old")
    new_session = await _create(repo, name="New")

    # Back-date old_session's last_accessed_at to 60 days ago
    cutoff = datetime.now(UTC) - timedelta(days=30)
    old_time = datetime.now(UTC) - timedelta(days=60)
    await repo.collection.update_one(
        {"_id": old_session.id},
        {"$set": {"last_accessed_at": old_time}},
    )

    deleted = await repo.delete_stale(older_than=cutoff)

    assert deleted == 1
    assert await repo.get_by_id(old_session.id) is None
    assert await repo.get_by_id(new_session.id) is not None


async def test_delete_stale_returns_zero_when_nothing_qualifies(repo: SessionRepository):
    await _create(repo, name="Fresh")
    deleted = await repo.delete_stale(older_than=datetime.now(UTC) - timedelta(days=90))
    assert deleted == 0
