"""GIF search router — proxies GIPHY/Tenor so the API key never reaches the frontend."""

from fastapi import APIRouter

from ..config import settings
from ..models.gif import GifResult
from ..services.gif_service import GifService

router = APIRouter(prefix="/api/v1/gifs", tags=["gifs"])


@router.get("/status")
async def get_status() -> dict:
    return {"enabled": settings.gifs_configured}


@router.get("/search")
async def search(q: str) -> list[GifResult]:
    if not settings.gifs_configured:
        return []
    service = GifService(giphy_api_key=settings.giphy_api_key, tenor_api_key=settings.tenor_api_key)
    return await service.search(q)
