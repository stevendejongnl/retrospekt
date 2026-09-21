"""Tests for the GIF search router — written RED-first per TDD convention.

TDD commit order:
  test(gifs): expect a status endpoint and a search endpoint over GifService
  feat(gifs): add GET /api/v1/gifs/status and /api/v1/gifs/search
"""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from src.config import settings
from src.models.gif import GifResult


async def test_status_reports_disabled_when_no_provider_configured(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "giphy_api_key", "")
    monkeypatch.setattr(settings, "tenor_api_key", "")
    response = await client.get("/api/v1/gifs/status")
    assert response.status_code == 200
    assert response.json() == {"enabled": False}


async def test_status_reports_enabled_when_giphy_configured(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "giphy_api_key", "gkey")
    monkeypatch.setattr(settings, "tenor_api_key", "")
    response = await client.get("/api/v1/gifs/status")
    assert response.json() == {"enabled": True}


async def test_search_returns_results_from_gif_service(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "giphy_api_key", "gkey")
    mock_results = [
        GifResult(id="g1", preview_url="https://x/small.gif", url="https://x/full.gif", provider="giphy"),
    ]
    with patch("src.routers.gifs.GifService.search", new=AsyncMock(return_value=mock_results)):
        response = await client.get("/api/v1/gifs/search", params={"q": "cat"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "g1"
    assert data[0]["url"] == "https://x/full.gif"


async def test_search_returns_empty_list_when_not_configured(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "giphy_api_key", "")
    monkeypatch.setattr(settings, "tenor_api_key", "")
    response = await client.get("/api/v1/gifs/search", params={"q": "cat"})
    assert response.status_code == 200
    assert response.json() == []


async def test_search_requires_a_query_param(client: AsyncClient):
    response = await client.get("/api/v1/gifs/search")
    assert response.status_code == 422
