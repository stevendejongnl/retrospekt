import asyncio
import json
import logging
from collections.abc import AsyncGenerator

logger = logging.getLogger(__name__)


class SSEManager:
    """Registry of asyncio queues per session for SSE broadcasting.

    One Queue per connected subscriber. On every mutation the backend
    pushes the full updated session JSON so clients can re-render from
    authoritative state rather than applying diffs.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue[str]]] = {}

    def subscribe(self, session_id: str, initial_data: dict | None = None) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        if initial_data is not None:
            queue.put_nowait(json.dumps(initial_data, default=str))
        self._subscribers.setdefault(session_id, []).append(queue)
        count = len(self._subscribers[session_id])
        logger.debug("SSE subscriber added for session %s (total: %d)", session_id, count)
        return queue

    def unsubscribe(self, session_id: str, queue: asyncio.Queue[str]) -> None:
        if session_id in self._subscribers:
            try:
                self._subscribers[session_id].remove(queue)
            except ValueError:
                pass

    async def broadcast(self, session_id: str, data: dict) -> None:
        subscribers = self._subscribers.get(session_id, [])
        if not subscribers:
            return
        payload = json.dumps(data, default=str)
        for queue in subscribers:
            await queue.put(payload)

    async def stream(
        self, session_id: str, queue: asyncio.Queue[str]
    ) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted lines, emitting a keepalive comment every 30s."""
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {data}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            self.unsubscribe(session_id, queue)
            raise


sse_manager = SSEManager()
