"""Stats router — public aggregate data + password-protected admin section."""

from typing import Annotated
from uuid import uuid4

import redis.asyncio as aioredis
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..dependencies import get_expiry_days, get_redis, get_repo
from ..repositories.session_repo import SessionRepository
from ..repositories.stats_repo import AdminStats, PublicStats, SentryHealth, StatsRepository
from ..services.sentry_service import SentryService

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


class AdminAuthRequest(BaseModel):
    password: str


def _stats_repo(repo: Annotated[SessionRepository, Depends(get_repo)]) -> StatsRepository:
    return StatsRepository(repo.collection.database)  # type: ignore[arg-type]


@router.get("")
async def get_public_stats(
    stats: Annotated[StatsRepository, Depends(_stats_repo)],
) -> PublicStats:
    return await stats.get_public_stats()


@router.post("/auth")
async def admin_auth(
    body: AdminAuthRequest,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
) -> dict[str, str]:
    if not settings.admin_password_hash:
        raise HTTPException(status_code=503, detail="Admin auth is not configured")
    try:
        PasswordHasher().verify(settings.admin_password_hash, body.password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = str(uuid4())
    await redis.set(f"admin_token:{token}", "1", ex=86400)
    return {"token": token}


@router.get("/admin")
async def get_admin_stats(
    stats: Annotated[StatsRepository, Depends(_stats_repo)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    expiry_days: Annotated[int, Depends(get_expiry_days)],
    x_admin_token: Annotated[str, Header()] = "",
) -> AdminStats:
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    exists = await redis.exists(f"admin_token:{x_admin_token}")
    if not exists:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    result = await stats.get_admin_stats(expiry_days=expiry_days)
    if settings.sentry_api_configured:
        svc = SentryService(
            settings.sentry_auth_token,
            settings.sentry_org_slug,
            settings.sentry_project_slug,
        )
        try:
            result.sentry = await svc.get_health()
        except Exception as exc:
            result.sentry = SentryHealth(
                unresolved_count=0,
                top_issues=[],
                error_rate_7d=[],
                p95_latency_7d=[],
                error=str(exc),
            )
    if settings.sentry_frontend_api_configured:
        svc_fe = SentryService(
            settings.sentry_auth_token,
            settings.sentry_org_slug,
            settings.sentry_frontend_project_slug,
        )
        try:
            result.sentry_frontend = await svc_fe.get_health()
        except Exception as exc:
            result.sentry_frontend = SentryHealth(
                unresolved_count=0,
                top_issues=[],
                error_rate_7d=[],
                p95_latency_7d=[],
                error=str(exc),
            )
    return result
