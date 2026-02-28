"""Tests for SentryService — written RED-first per TDD convention.

TDD commit order:
  test(sentry-service): SentryService maps Sentry API responses to SentryHealth
  feat(sentry-service): implement SentryService with concurrent httpx calls
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestSentryServiceGetHealth:
    """SentryService.get_health() maps three Sentry API endpoints to SentryHealth."""

    def _make_project_response(self):
        """Mock httpx response for project details endpoint (returns numeric ID)."""
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.json.return_value = {"id": "4510940777676800", "slug": "myproject"}
        return response

    def _make_issues_response(self):
        """Mock httpx response for issues endpoint."""
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.headers = {"X-Hits": "42"}
        response.json.return_value = [
            {
                "id": "123",
                "title": "ZeroDivisionError: division by zero",
                "count": "15",
                "lastSeen": "2026-02-28T10:00:00Z",
            },
            {
                "id": "456",
                "title": "KeyError: 'user_id'",
                "count": "7",
                "lastSeen": "2026-02-27T09:00:00Z",
            },
        ]
        return response

    def _make_error_rate_response(self):
        """Mock httpx response for error rate stats endpoint."""
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.json.return_value = {
            "data": [
                [1740614400, [{"count": 10}]],
                [1740700800, [{"count": 25}]],
                [1740787200, [{"count": 0}]],
            ]
        }
        return response

    def _make_p95_response(self):
        """Mock httpx response for p95 latency stats endpoint."""
        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.json.return_value = {
            "data": [
                [1740614400, [{"count": 120.5}]],
                [1740700800, [{"count": 98.3}]],
                [1740787200, [{"count": 0}]],
            ]
        }
        return response

    @pytest.fixture
    def mock_client(self):
        """AsyncMock httpx.AsyncClient that returns configured responses."""
        client = AsyncMock()
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=False)
        return client

    async def test_unresolved_count_comes_from_x_hits_header(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            self._make_issues_response(),
            self._make_error_rate_response(),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        assert health.unresolved_count == 42

    async def test_top_issues_mapped_from_issues_endpoint(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            self._make_issues_response(),
            self._make_error_rate_response(),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        assert len(health.top_issues) == 2
        assert health.top_issues[0].id == "123"
        assert health.top_issues[0].title == "ZeroDivisionError: division by zero"
        assert health.top_issues[0].count == 15
        assert health.top_issues[0].last_seen == "2026-02-28T10:00:00Z"

    async def test_error_rate_7d_parsed_from_timeseries(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            self._make_issues_response(),
            self._make_error_rate_response(),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        assert len(health.error_rate_7d) == 3
        assert health.error_rate_7d[0].value == 10.0
        assert health.error_rate_7d[1].value == 25.0
        assert health.error_rate_7d[2].value == 0.0
        # Date must be YYYY-MM-DD string
        assert len(health.error_rate_7d[0].date) == 10
        assert health.error_rate_7d[0].date[4] == "-"

    async def test_p95_latency_7d_parsed_from_timeseries(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            self._make_issues_response(),
            self._make_error_rate_response(),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        assert len(health.p95_latency_7d) == 3
        assert health.p95_latency_7d[0].value == 120.5
        assert health.p95_latency_7d[1].value == 98.3

    async def test_no_error_when_all_calls_succeed(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            self._make_issues_response(),
            self._make_error_rate_response(),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        assert health.error is None

    async def test_error_field_set_when_issues_call_fails(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            Exception("Connection refused"),
            self._make_error_rate_response(),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        assert health.error is not None
        assert "Connection refused" in health.error

    async def test_partial_failure_returns_empty_lists_for_failed_parts(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            self._make_issues_response(),
            Exception("Timeout"),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        # Issues still populated
        assert health.unresolved_count == 42
        # Error rate is empty due to failure
        assert health.error_rate_7d == []
        # p95 still populated
        assert len(health.p95_latency_7d) == 3
        assert health.error is not None

    async def test_project_id_failure_returns_empty_timeseries(self, mock_client):
        from src.services.sentry_service import SentryService

        mock_client.get = AsyncMock(side_effect=[
            Exception("404 project not found"),
            self._make_issues_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        # timeseries calls skipped when project ID unavailable
        assert health.error_rate_7d == []
        assert health.p95_latency_7d == []
        assert health.error is not None

    async def test_issues_x_hits_header_missing_defaults_to_len_of_issues(self, mock_client):
        from src.services.sentry_service import SentryService

        response = MagicMock()
        response.raise_for_status = MagicMock()
        response.headers = {}  # no X-Hits
        response.json.return_value = [
            {"id": "1", "title": "Err", "count": "3", "lastSeen": "2026-02-28T00:00:00Z"}
        ]

        mock_client.get = AsyncMock(side_effect=[
            self._make_project_response(),
            response,
            self._make_error_rate_response(),
            self._make_p95_response(),
        ])

        with patch("src.services.sentry_service.httpx.AsyncClient", return_value=mock_client):
            svc = SentryService("token", "myorg", "myproject")
            health = await svc.get_health()

        assert health.unresolved_count == 1  # falls back to len(issues)
