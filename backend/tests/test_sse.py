"""SSE specifications — unit tests for SSEManager and integration tests for /stream.

httpx's ASGITransport buffers the full response body before exposing it to the
client.  A SSE stream that never closes would block forever, so we cannot use
client.stream() + aiter_lines() for the broadcast integration tests.

Instead, the broadcast path is verified by subscribing to the real sse_manager
singleton (the same one the routes use) and confirming that HTTP mutations
enqueue the expected payload.  The unit tests above already verify the
pub-sub mechanics end-to-end.  The HTTP endpoint's routing is exercised by the
404 test, which terminates promptly.
"""

import asyncio
import json

from httpx import AsyncClient

from src.services.sse_manager import SSEManager, sse_manager
from tests.conftest import make_session

# ── Unit: SSEManager ─────────────────────────────────────────────────────────


async def test_subscribe_returns_a_queue():
    manager = SSEManager()
    queue = manager.subscribe("s1")
    assert isinstance(queue, asyncio.Queue)


async def test_broadcast_delivers_payload_to_subscriber():
    manager = SSEManager()
    queue = manager.subscribe("s1")
    await manager.broadcast("s1", {"phase": "discussing"})
    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert json.loads(msg)["phase"] == "discussing"


async def test_broadcast_reaches_every_subscriber():
    manager = SSEManager()
    q1 = manager.subscribe("s1")
    q2 = manager.subscribe("s1")
    await manager.broadcast("s1", {"n": 42})
    m1 = await asyncio.wait_for(q1.get(), timeout=1.0)
    m2 = await asyncio.wait_for(q2.get(), timeout=1.0)
    assert json.loads(m1)["n"] == 42
    assert json.loads(m2)["n"] == 42


async def test_broadcast_to_session_with_no_subscribers_is_a_no_op():
    manager = SSEManager()
    await manager.broadcast("ghost-session", {"data": "ignored"})  # must not raise


async def test_unsubscribe_prevents_future_deliveries():
    manager = SSEManager()
    queue = manager.subscribe("s1")
    manager.unsubscribe("s1", queue)
    await manager.broadcast("s1", {"data": "should not arrive"})
    assert queue.empty()


async def test_stream_formats_payload_as_sse_data_line():
    manager = SSEManager()
    queue = manager.subscribe("s1")
    await queue.put(json.dumps({"event": "test"}))
    gen = manager.stream("s1", queue)
    chunk = await asyncio.wait_for(gen.__anext__(), timeout=1.0)
    assert chunk.startswith("data: ")
    assert chunk.endswith("\n\n")
    assert json.loads(chunk.removeprefix("data:").strip())["event"] == "test"


# ── Integration: HTTP mutations → SSEManager broadcasts ──────────────────────
#
# httpx's ASGITransport buffers the full response body before returning it,
# so client.stream() cannot read from a long-lived SSE stream in-process.
# Instead we subscribe directly to the same sse_manager singleton the routes
# use, trigger a mutation over HTTP, and assert the payload arrived.


async def test_stream_returns_404_for_unknown_session(client: AsyncClient):
    async with client.stream("GET", "/api/v1/sessions/no-such-id/stream") as response:
        assert response.status_code == 404


async def test_card_mutation_broadcasts_updated_session(client: AsyncClient):
    session = await make_session(client)
    queue = sse_manager.subscribe(session.id)
    try:
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "SSE works!", "author_name": "Alice"},
        )
        msg = await asyncio.wait_for(queue.get(), timeout=1.0)
        data = json.loads(msg)
        assert data["cards"][0]["text"] == "SSE works!"
        assert "facilitator_token" not in data  # strip check
    finally:
        sse_manager.unsubscribe(session.id, queue)


async def test_phase_mutation_broadcasts_updated_phase(client: AsyncClient):
    session = await make_session(client)
    queue = sse_manager.subscribe(session.id)
    try:
        await client.post(
            f"/api/v1/sessions/{session.id}/phase",
            json={"phase": "discussing"},
            headers={"X-Facilitator-Token": session.facilitator_token},
        )
        msg = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert json.loads(msg)["phase"] == "discussing"
    finally:
        sse_manager.unsubscribe(session.id, queue)


async def test_join_mutation_broadcasts_new_participant(client: AsyncClient):
    session = await make_session(client, facilitator="Alice")
    queue = sse_manager.subscribe(session.id)
    try:
        await client.post(
            f"/api/v1/sessions/{session.id}/join",
            json={"participant_name": "Bob"},
        )
        msg = await asyncio.wait_for(queue.get(), timeout=1.0)
        names = [p["name"] for p in json.loads(msg)["participants"]]
        assert "Bob" in names
    finally:
        sse_manager.unsubscribe(session.id, queue)


async def test_multiple_subscribers_all_receive_broadcast(client: AsyncClient):
    session = await make_session(client)
    q1 = sse_manager.subscribe(session.id)
    q2 = sse_manager.subscribe(session.id)
    try:
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "To Improve", "text": "Multi-sub", "author_name": "Alice"},
        )
        m1 = await asyncio.wait_for(q1.get(), timeout=1.0)
        m2 = await asyncio.wait_for(q2.get(), timeout=1.0)
        assert json.loads(m1)["cards"][0]["text"] == "Multi-sub"
        assert json.loads(m2)["cards"][0]["text"] == "Multi-sub"
    finally:
        sse_manager.unsubscribe(session.id, q1)
        sse_manager.unsubscribe(session.id, q2)
