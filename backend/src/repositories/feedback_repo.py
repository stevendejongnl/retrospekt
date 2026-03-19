"""Feedback repository — insert and list feedback submissions."""

from motor.motor_asyncio import AsyncIOMotorDatabase

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
