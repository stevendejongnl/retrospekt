"""AppriseClient — sends notifications via a self-hosted Apprise API instance."""

import logging

import httpx

logger = logging.getLogger(__name__)


class AppriseClient:
    def __init__(self, base_url: str, key: str) -> None:
        self._url = f"{base_url}/notify/{key}"

    async def notify(self, title: str, body: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self._url, json={"title": title, "body": body})
                response.raise_for_status()
        except Exception:
            logger.exception("Failed to send Apprise notification")
