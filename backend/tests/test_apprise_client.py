"""Tests for AppriseClient — written RED-first per TDD convention.

TDD commit order:
  test(apprise-client): AppriseClient posts title/body to the notify endpoint
  feat(apprise-client): implement AppriseClient with httpx POST, never raises
"""

from unittest.mock import AsyncMock, MagicMock, patch


class TestAppriseClientNotify:
    async def test_posts_title_and_body_to_notify_url(self):
        from src.services.apprise_client import AppriseClient

        client = AppriseClient(base_url="http://apprise.local:8000", key="retrospekt")

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)) as mock_post:
            await client.notify(title="New feedback", body="Something broke")

        mock_post.assert_awaited_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://apprise.local:8000/notify/retrospekt"
        assert kwargs["json"] == {"title": "New feedback", "body": "Something broke"}

    async def test_swallows_exceptions_and_never_raises(self):
        from src.services.apprise_client import AppriseClient

        client = AppriseClient(base_url="http://apprise.local:8000", key="retrospekt")

        with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=Exception("boom"))):
            await client.notify(title="t", body="b")  # must not raise
