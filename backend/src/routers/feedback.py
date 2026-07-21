"""Feedback router — submit feedback (open) + list feedback (admin-only)."""

import asyncio
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from ..config import settings
from ..dependencies import get_feedback_repo, get_redis
from ..models.feedback import Feedback, FeedbackStatus
from ..repositories.feedback_repo import FeedbackRepository
from ..services.apprise_client import AppriseClient

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])


class SubmitFeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""
    session_id: str | None = None
    participant_name: str | None = None
    app_version: str = ""


class PatchFeedbackRequest(BaseModel):
    status: FeedbackStatus
    fixed_in_version: str | None = None


async def _require_admin(redis: aioredis.Redis, x_admin_token: str) -> None:
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    exists = await redis.exists(f"admin_token:{x_admin_token}")
    if not exists:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")


@router.post("", status_code=201)
async def submit_feedback(
    body: SubmitFeedbackRequest,
    repo: Annotated[FeedbackRepository, Depends(get_feedback_repo)],
) -> Feedback:
    fb = Feedback(
        rating=body.rating,
        comment=body.comment,
        session_id=body.session_id,
        participant_name=body.participant_name,
        app_version=body.app_version,
    )
    saved = await repo.add_feedback(fb)

    if settings.apprise_configured:
        client = AppriseClient(settings.apprise_base_url, settings.apprise_key)
        stars = "★" * saved.rating + "☆" * (5 - saved.rating)
        title = f"Retrospekt feedback {stars}"
        parts = [saved.comment] if saved.comment else []
        meta = " · ".join(p for p in (saved.participant_name, saved.app_version) if p)
        if meta:
            parts.append(f"— {meta}")
        body_text = " ".join(parts) or title
        asyncio.create_task(client.notify(title=title, body=body_text))

    return saved


@router.get("")
async def list_feedback(
    repo: Annotated[FeedbackRepository, Depends(get_feedback_repo)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    x_admin_token: Annotated[str, Header()] = "",
) -> list[Feedback]:
    await _require_admin(redis, x_admin_token)
    return await repo.list_feedback()


@router.patch("/{feedback_id}")
async def patch_feedback(
    feedback_id: str,
    body: PatchFeedbackRequest,
    repo: Annotated[FeedbackRepository, Depends(get_feedback_repo)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    x_admin_token: Annotated[str, Header()] = "",
) -> Feedback:
    await _require_admin(redis, x_admin_token)
    updated = await repo.set_status(feedback_id, body.status, body.fixed_in_version)
    if updated is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return updated
