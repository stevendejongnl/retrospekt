"""GifService — searches GIPHY and/or Tenor for GIFs, merging whichever provider(s) are configured."""

import asyncio
import logging

import httpx

from ..models.gif import GifResult

logger = logging.getLogger(__name__)

GIPHY_URL = "https://api.giphy.com/v1/gifs/search"
TENOR_URL = "https://tenor.googleapis.com/v2/search"


class GifService:
    def __init__(self, giphy_api_key: str = "", tenor_api_key: str = "") -> None:
        self._giphy_key = giphy_api_key
        self._tenor_key = tenor_api_key

    async def search(self, query: str, limit: int = 20) -> list[GifResult]:
        if not query.strip():
            return []

        async with httpx.AsyncClient(timeout=10.0) as client:
            tasks = []
            if self._giphy_key:
                tasks.append(self._search_giphy(client, query, limit))
            if self._tenor_key:
                tasks.append(self._search_tenor(client, query, limit))
            if not tasks:
                return []

            results_by_provider = await asyncio.gather(*tasks, return_exceptions=True)

        merged: list[GifResult] = []
        for result in results_by_provider:
            if isinstance(result, BaseException):
                logger.exception("GIF provider search failed", exc_info=result)
                continue
            merged.extend(result)
        return merged

    async def _search_giphy(
        self, client: httpx.AsyncClient, query: str, limit: int
    ) -> list[GifResult]:
        response = await client.get(
            GIPHY_URL, params={"api_key": self._giphy_key, "q": query, "limit": limit}
        )
        response.raise_for_status()
        data = response.json()
        return [
            GifResult(
                id=item["id"],
                preview_url=item["images"]["fixed_height_small"]["url"],
                url=item["images"]["original"]["url"],
                provider="giphy",
            )
            for item in data.get("data", [])
        ]

    async def _search_tenor(
        self, client: httpx.AsyncClient, query: str, limit: int
    ) -> list[GifResult]:
        response = await client.get(
            TENOR_URL, params={"key": self._tenor_key, "q": query, "limit": limit}
        )
        response.raise_for_status()
        data = response.json()
        results = []
        for item in data.get("results", []):
            formats = item.get("media_formats", {})
            gif = formats.get("gif")
            if not gif:
                continue
            preview = formats.get("tinygif") or gif
            results.append(
                GifResult(id=item["id"], preview_url=preview["url"], url=gif["url"], provider="tenor")
            )
        return results
