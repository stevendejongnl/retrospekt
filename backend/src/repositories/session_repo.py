from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.session import Session


def _doc_to_session(doc: dict) -> Session:
    doc["id"] = str(doc.pop("_id"))
    return Session(**doc)


class SessionRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db["sessions"]

    async def create(self, session: Session) -> Session:
        doc = session.model_dump()
        doc["_id"] = session.id
        del doc["id"]
        await self.collection.insert_one(doc)
        return session

    async def get_by_id(self, session_id: str) -> Session | None:
        doc = await self.collection.find_one({"_id": session_id})
        if not doc:
            return None
        return _doc_to_session(doc)

    async def update(self, session: Session) -> Session:
        session.updated_at = datetime.now(UTC)
        doc = session.model_dump()
        doc["_id"] = session.id
        del doc["id"]
        await self.collection.replace_one({"_id": session.id}, doc)
        return session
