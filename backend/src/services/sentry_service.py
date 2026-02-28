"""SentryService — fetches health data from Sentry API concurrently."""

import asyncio
from datetime import UTC, datetime

import httpx

from ..repositories.stats_repo import SentryDataPoint, SentryHealth, SentryIssue


def _parse_timeseries(data: dict) -> list[SentryDataPoint]:
    """Parse Sentry events-stats response into a list of SentryDataPoint."""
    points = []
    for ts, buckets in data.get("data", []):
        date = datetime.fromtimestamp(ts, tz=UTC).strftime("%Y-%m-%d")
        value_raw = buckets[0]["count"] if buckets else None
        value = float(value_raw) if value_raw is not None else None
        points.append(SentryDataPoint(date=date, value=value))
    return points


class SentryService:
    BASE_URL = "https://sentry.io"

    def __init__(self, auth_token: str, org_slug: str, project_slug: str) -> None:
        self._headers = {"Authorization": f"Bearer {auth_token}"}
        self._org = org_slug
        self._project = project_slug

    async def get_health(self) -> SentryHealth:
        async with httpx.AsyncClient(
            base_url=self.BASE_URL, headers=self._headers, timeout=10.0
        ) as client:
            results = await asyncio.gather(
                self._get_issues(client),
                self._get_error_rate(client),
                self._get_p95(client),
                return_exceptions=True,
            )

        issues_raw, error_rate_raw, p95_raw = results
        errors: list[str] = []

        # Issues
        unresolved_count = 0
        top_issues: list[SentryIssue] = []
        if isinstance(issues_raw, BaseException):
            errors.append(str(issues_raw))
        else:
            unresolved_count, top_issues = issues_raw  # type: ignore[misc]

        # Error rate
        error_rate_7d: list[SentryDataPoint] = []
        if isinstance(error_rate_raw, BaseException):
            errors.append(str(error_rate_raw))
        else:
            error_rate_7d = error_rate_raw  # type: ignore[assignment]

        # p95 latency
        p95_latency_7d: list[SentryDataPoint] = []
        if isinstance(p95_raw, BaseException):
            errors.append(str(p95_raw))
        else:
            p95_latency_7d = p95_raw  # type: ignore[assignment]

        return SentryHealth(
            unresolved_count=unresolved_count,
            top_issues=top_issues,
            error_rate_7d=error_rate_7d,
            p95_latency_7d=p95_latency_7d,
            error="; ".join(errors) if errors else None,
        )

    async def _get_issues(self, client: httpx.AsyncClient) -> tuple[int, list[SentryIssue]]:
        resp = await client.get(
            f"/api/0/projects/{self._org}/{self._project}/issues/",
            params={"query": "is:unresolved", "sort": "date", "limit": 5},
        )
        resp.raise_for_status()
        total = int(resp.headers.get("X-Hits", len(resp.json())))
        issues = [
            SentryIssue(
                id=item["id"],
                title=item["title"],
                count=int(item["count"]),
                last_seen=item["lastSeen"],
            )
            for item in resp.json()
        ]
        return total, issues

    async def _get_error_rate(self, client: httpx.AsyncClient) -> list[SentryDataPoint]:
        resp = await client.get(
            f"/api/0/organizations/{self._org}/events-stats/",
            params={
                "field": "count()",
                "interval": "1d",
                "period": "7d",
                "query": "",
                "dataset": "errors",
                "project": self._project,
            },
        )
        resp.raise_for_status()
        return _parse_timeseries(resp.json())

    async def _get_p95(self, client: httpx.AsyncClient) -> list[SentryDataPoint]:
        resp = await client.get(
            f"/api/0/organizations/{self._org}/events-stats/",
            params={
                "field": "p95(transaction.duration)",
                "interval": "1d",
                "period": "7d",
                "query": "",
                "dataset": "transactions",
                "project": self._project,
            },
        )
        resp.raise_for_status()
        return _parse_timeseries(resp.json())
