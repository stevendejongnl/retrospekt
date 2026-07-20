"""Feedback repository — insert and list feedback submissions."""

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from ..models.feedback import Feedback


class FeedbackRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:  # type: ignore[type-arg]
        self.collection = db["feedback"]

    async def add_feedback(self, fb: Feedback) -> Feedback:
        await self.collection.insert_one(fb.model_dump())
        return fb

    async def list_feedback(self, limit: int = 100) -> list[Feedback]:
        docs = await self.collection.find().sort("created_at", -1).limit(limit).to_list(length=limit)
        return [Feedback(**d) for d in docs]

    async def set_fixed_in_version(self, feedback_id: str, version: str) -> Feedback | None:
        doc = await self.collection.find_one_and_update(
            {"id": feedback_id},
            {"$set": {"fixed_in_version": version}},
            return_document=ReturnDocument.AFTER,
        )
        return Feedback(**doc) if doc else None
