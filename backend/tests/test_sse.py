"""SSE specifications — unit tests for SSEManager and integration tests for /stream.

The new SSEManager uses Redis pub/sub instead of in-memory queues, so tests
subscribe via stream() (an async generator) rather than subscribe() (a queue).

Integration tests start a collect() task, sleep briefly to let the reader
subscribe to Redis, trigger an HTTP mutation, then wait for the collected chunk.
"""

import asyncio
import json

from httpx import AsyncClient

from src.services.sse_manager import SSEManager, sse_manager
from tests.conftest import make_session

# ── Unit: SSEManager ─────────────────────────────────────────────────────────


async def test_broadcast_delivers_payload_to_stream(fake_redis):
    manager = SSEManager()
    manager.set_client(fake_redis)

    received = []

    async def collect():
        async for chunk in manager.stream("s1"):
            received.append(chunk)
            break

    task = asyncio.create_task(collect())
    await asyncio.sleep(0.05)
    await manager.broadcast("s1", {"phase": "discussing"})
    await asyncio.wait_for(task, timeout=2.0)

    assert len(received) == 1
    assert json.loads(received[0].removeprefix("data: ").strip())["phase"] == "discussing"


async def test_broadcast_reaches_every_stream(fake_redis):
    manager = SSEManager()
    manager.set_client(fake_redis)

    received1: list[str] = []
    received2: list[str] = []

    async def collect(container: list[str]) -> None:
        async for chunk in manager.stream("s1"):
            container.append(chunk)
            break

    task1 = asyncio.create_task(collect(received1))
    task2 = asyncio.create_task(collect(received2))
    await asyncio.sleep(0.05)
    await manager.broadcast("s1", {"n": 42})
    await asyncio.gather(
        asyncio.wait_for(task1, timeout=2.0),
        asyncio.wait_for(task2, timeout=2.0),
    )

    assert json.loads(received1[0].removeprefix("data: ").strip())["n"] == 42
    assert json.loads(received2[0].removeprefix("data: ").strip())["n"] == 42


async def test_broadcast_to_session_with_no_subscribers_is_a_no_op():
    await sse_manager.broadcast("ghost-session", {"data": "ignored"})  # must not raise


async def test_stream_includes_initial_data_as_first_chunk(fake_redis):
    manager = SSEManager()
    manager.set_client(fake_redis)

    gen = manager.stream("s1", initial_data={"phase": "collecting"})
    chunk = await asyncio.wait_for(gen.__anext__(), timeout=1.0)
    await gen.aclose()

    assert chunk.startswith("data: ")
    assert json.loads(chunk.removeprefix("data: ").strip())["phase"] == "collecting"


async def test_stream_formats_payload_as_sse_data_line(fake_redis):
    manager = SSEManager()
    manager.set_client(fake_redis)

    received: list[str] = []

    async def collect() -> None:
        async for chunk in manager.stream("s1"):
            received.append(chunk)
            break

    task = asyncio.create_task(collect())
    await asyncio.sleep(0.05)
    await manager.broadcast("s1", {"event": "test"})
    await asyncio.wait_for(task, timeout=2.0)

    assert received[0].startswith("data: ")
    assert received[0].endswith("\n\n")
    assert json.loads(received[0].removeprefix("data: ").strip())["event"] == "test"


# ── Integration: HTTP mutations → SSEManager broadcasts ──────────────────────
#
# httpx's ASGITransport buffers the full response body before returning it,
# so client.stream() cannot read from a long-lived SSE stream in-process.
# Instead we subscribe directly via sse_manager.stream() (same singleton the
# routes use), trigger a mutation over HTTP, and assert the payload arrived.


async def test_stream_returns_404_for_unknown_session(client: AsyncClient):
    async with client.stream("GET", "/api/v1/sessions/no-such-id/stream") as response:
        assert response.status_code == 404


async def test_card_mutation_broadcasts_updated_session(client: AsyncClient):
    session = await make_session(client)
    received: list[str] = []

    async def collect() -> None:
        async for chunk in sse_manager.stream(session.id):
            received.append(chunk)
            break

    task = asyncio.create_task(collect())
    await asyncio.sleep(0.05)
    await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "Went Well", "text": "SSE works!", "author_name": "Alice"},
    )
    await asyncio.wait_for(task, timeout=2.0)

    data = json.loads(received[0].removeprefix("data: ").strip())
    assert data["cards"][0]["text"] == "SSE works!"
    assert "facilitator_token" not in data


async def test_phase_mutation_broadcasts_updated_phase(client: AsyncClient):
    session = await make_session(client)
    received: list[str] = []

    async def collect() -> None:
        async for chunk in sse_manager.stream(session.id):
            received.append(chunk)
            break

    task = asyncio.create_task(collect())
    await asyncio.sleep(0.05)
    await client.post(
        f"/api/v1/sessions/{session.id}/phase",
        json={"phase": "discussing"},
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    await asyncio.wait_for(task, timeout=2.0)

    assert json.loads(received[0].removeprefix("data: ").strip())["phase"] == "discussing"


async def test_join_mutation_broadcasts_new_participant(client: AsyncClient):
    session = await make_session(client, facilitator="Alice")
    received: list[str] = []

    async def collect() -> None:
        async for chunk in sse_manager.stream(session.id):
            received.append(chunk)
            break

    task = asyncio.create_task(collect())
    await asyncio.sleep(0.05)
    await client.post(
        f"/api/v1/sessions/{session.id}/join",
        json={"participant_name": "Bob"},
    )
    await asyncio.wait_for(task, timeout=2.0)

    names = [p["name"] for p in json.loads(received[0].removeprefix("data: ").strip())["participants"]]
    assert "Bob" in names


async def test_multiple_subscribers_all_receive_broadcast(client: AsyncClient):
    session = await make_session(client)
    received1: list[str] = []
    received2: list[str] = []

    async def collect(container: list[str]) -> None:
        async for chunk in sse_manager.stream(session.id):
            container.append(chunk)
            break

    task1 = asyncio.create_task(collect(received1))
    task2 = asyncio.create_task(collect(received2))
    await asyncio.sleep(0.05)
    await client.post(
        f"/api/v1/sessions/{session.id}/cards",
        json={"column": "To Improve", "text": "Multi-sub", "author_name": "Alice"},
    )
    await asyncio.gather(
        asyncio.wait_for(task1, timeout=2.0),
        asyncio.wait_for(task2, timeout=2.0),
    )

    assert json.loads(received1[0].removeprefix("data: ").strip())["cards"][0]["text"] == "Multi-sub"
    assert json.loads(received2[0].removeprefix("data: ").strip())["cards"][0]["text"] == "Multi-sub"
