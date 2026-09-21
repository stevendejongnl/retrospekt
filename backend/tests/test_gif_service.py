"""Tests for GifService — written RED-first per TDD convention.

TDD commit order:
  test(gif-service): GifService searches whichever provider(s) are configured
  feat(gif-service): implement GifService with concurrent httpx calls
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _giphy_response():
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = {
        "data": [
            {
                "id": "g1",
                "images": {
                    "fixed_height_small": {"url": "https://giphy.example/g1-small.gif"},
                    "original": {"url": "https://giphy.example/g1.gif"},
                },
            },
        ]
    }
    return response


def _tenor_response():
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = {
        "results": [
            {
                "id": "t1",
                "media_formats": {
                    "gif": {"url": "https://tenor.example/t1.gif"},
                    "tinygif": {"url": "https://tenor.example/t1-tiny.gif"},
                },
            },
        ]
    }
    return response


@pytest.fixture
def mock_client():
    client = AsyncMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


class TestGifServiceSearch:
    async def test_returns_empty_list_when_neither_provider_configured(self, mock_client):
        from src.services.gif_service import GifService

        mock_client.get = AsyncMock()
        with patch("src.services.gif_service.httpx.AsyncClient", return_value=mock_client):
            svc = GifService(giphy_api_key="", tenor_api_key="")
            results = await svc.search("cat")

        assert results == []
        mock_client.get.assert_not_called()

    async def test_returns_empty_list_for_a_blank_query(self, mock_client):
        from src.services.gif_service import GifService

        mock_client.get = AsyncMock()
        with patch("src.services.gif_service.httpx.AsyncClient", return_value=mock_client):
            svc = GifService(giphy_api_key="gkey", tenor_api_key="tkey")
            results = await svc.search("   ")

        assert results == []
        mock_client.get.assert_not_called()

    async def test_searches_giphy_only_when_only_giphy_configured(self, mock_client):
        from src.services.gif_service import GifService

        mock_client.get = AsyncMock(return_value=_giphy_response())
        with patch("src.services.gif_service.httpx.AsyncClient", return_value=mock_client):
            svc = GifService(giphy_api_key="gkey", tenor_api_key="")
            results = await svc.search("cat")

        assert len(results) == 1
        assert results[0].id == "g1"
        assert results[0].provider == "giphy"
        assert results[0].url == "https://giphy.example/g1.gif"
        assert results[0].preview_url == "https://giphy.example/g1-small.gif"

    async def test_searches_tenor_only_when_only_tenor_configured(self, mock_client):
        from src.services.gif_service import GifService

        mock_client.get = AsyncMock(return_value=_tenor_response())
        with patch("src.services.gif_service.httpx.AsyncClient", return_value=mock_client):
            svc = GifService(giphy_api_key="", tenor_api_key="tkey")
            results = await svc.search("cat")

        assert len(results) == 1
        assert results[0].id == "t1"
        assert results[0].provider == "tenor"
        assert results[0].url == "https://tenor.example/t1.gif"
        assert results[0].preview_url == "https://tenor.example/t1-tiny.gif"

    async def test_merges_results_from_both_providers_when_both_configured(self, mock_client):
        from src.services.gif_service import GifService

        mock_client.get = AsyncMock(side_effect=[_giphy_response(), _tenor_response()])
        with patch("src.services.gif_service.httpx.AsyncClient", return_value=mock_client):
            svc = GifService(giphy_api_key="gkey", tenor_api_key="tkey")
            results = await svc.search("cat")

        providers = {r.provider for r in results}
        assert providers == {"giphy", "tenor"}
        assert len(results) == 2

    async def test_one_provider_failing_does_not_lose_the_other_providers_results(self, mock_client):
        from src.services.gif_service import GifService

        mock_client.get = AsyncMock(side_effect=[Exception("boom"), _tenor_response()])
        with patch("src.services.gif_service.httpx.AsyncClient", return_value=mock_client):
            svc = GifService(giphy_api_key="gkey", tenor_api_key="tkey")
            results = await svc.search("cat")

        assert len(results) == 1
        assert results[0].provider == "tenor"
