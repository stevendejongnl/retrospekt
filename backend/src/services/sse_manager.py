import asyncio
import json
import logging
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class SSEManager:
    """Redis pub/sub-based SSE broadcaster.

    Each pod publishes mutations to a Redis channel and subscribes to receive
    broadcasts from all pods, so all SSE clients see every mutation regardless
    of which replica handled the HTTP request.
    """

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None  # type: ignore[type-arg]

    def set_client(self, client: aioredis.Redis | None) -> None:  # type: ignore[type-arg]
        self._redis = client

    async def broadcast(self, session_id: str, data: dict) -> None:
        assert self._redis is not None
        await self._redis.publish(f"session:{session_id}", json.dumps(data, default=str))

    async def stream(
        self, session_id: str, initial_data: dict | None = None
    ) -> AsyncGenerator[str, None]:
        assert self._redis is not None
        redis_client = self._redis
        channel = f"session:{session_id}"
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def _reader() -> None:
            async with redis_client.pubsub() as pubsub:
                await pubsub.subscribe(channel)
                try:
                    async for message in pubsub.listen():  # pragma: no branch
                        if message["type"] == "message":
                            data = message["data"]
                            await queue.put(data.decode() if isinstance(data, bytes) else data)
                except asyncio.CancelledError:
                    await queue.put(None)  # sentinel

        task = asyncio.create_task(_reader())
        try:
            if initial_data is not None:
                yield f"data: {json.dumps(initial_data, default=str)}\n\n"
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=30.0)
                    if item is None:  # pragma: no cover
                        break
                    yield f"data: {item}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            task.cancel()
            raise
        finally:
            task.cancel()


sse_manager = SSEManager()
