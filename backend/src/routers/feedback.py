"""Feedback router — submit feedback (open) + list feedback (admin-only)."""

from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_feedback_repo, get_redis
from ..models.feedback import Feedback
from ..repositories.feedback_repo import FeedbackRepository

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])


class SubmitFeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""
    session_id: str | None = None
    app_version: str = ""


@router.post("", status_code=201)
async def submit_feedback(
    body: SubmitFeedbackRequest,
    repo: Annotated[FeedbackRepository, Depends(get_feedback_repo)],
) -> Feedback:
    fb = Feedback(
        rating=body.rating,
        comment=body.comment,
        session_id=body.session_id,
        app_version=body.app_version,
    )
    return await repo.add_feedback(fb)


@router.get("")
async def list_feedback(
    repo: Annotated[FeedbackRepository, Depends(get_feedback_repo)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    x_admin_token: Annotated[str, Header()] = "",
) -> list[Feedback]:
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    exists = await redis.exists(f"admin_token:{x_admin_token}")
    if not exists:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    return await repo.list_feedback()
