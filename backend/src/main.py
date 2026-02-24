"""Retrospekt backend — FastAPI application factory."""

import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import redis.asyncio as aioredis
import sentry_sdk
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from .config import settings
from .database import database
from .repositories.session_repo import SessionRepository
from .routers import cards, health, sessions
from .services.sse_manager import sse_manager

logger = logging.getLogger(__name__)

CLEANUP_INTERVAL_SECONDS = 3600  # 1 hour


async def _cleanup_loop(repo: SessionRepository) -> None:
    logger.info("Session cleanup task started (expiry: %d days)", settings.session_expiry_days)
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        threshold = datetime.now(UTC) - timedelta(days=settings.session_expiry_days)
        try:
            count = await repo.delete_stale(older_than=threshold)
            if count:
                logger.info("Cleanup: deleted %d expired session(s)", count)
        except Exception:
            logger.exception("Cleanup: error during stale session deletion")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # type: ignore[type-arg]
    await database.connect()
    assert database.db is not None
    repo = SessionRepository(database.db)
    await repo.ensure_indexes()
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=False)
    sse_manager.set_client(redis_client)
    task = asyncio.create_task(_cleanup_loop(repo))
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await redis_client.aclose()
        await database.disconnect()


def create_app() -> FastAPI:
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.2,
            send_default_pii=False,
        )

    app = FastAPI(
        title="Retrospekt API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(sessions.router)
    app.include_router(cards.router)

    return app


app = create_app()


def main() -> None:
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
