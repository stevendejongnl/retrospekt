import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    global _client, db
    _client = AsyncIOMotorClient(settings.mongodb_url)
    db = _client[settings.mongodb_database]
    logger.info("Connected to MongoDB: %s", settings.mongodb_database)


async def disconnect_db() -> None:
    global _client
    if _client:
        _client.close()
        logger.info("Disconnected from MongoDB")
