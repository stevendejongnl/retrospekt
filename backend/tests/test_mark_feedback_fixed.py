"""Tests for the mark_feedback_fixed CI script — written RED-first per TDD convention.

TDD commit order:
  test(ci): expect mark_feedback_fixed to mark feedback via the admin API, not Mongo
  feat(ci): mark_feedback_fixed calls the live admin API instead of connecting to Mongo directly

GitHub-hosted runners don't have a stable IP to allowlist on the Atlas
side (confirmed twice in a row by a TLSV1_ALERT_INTERNAL_ERROR connecting
directly from CI). The backend itself already has a working connection to
prod Mongo, so this now goes through its own admin-authenticated HTTP API
instead — the same POST /api/v1/stats/auth -> PATCH /api/v1/feedback/{id}
flow used manually to fix forward the last two stuck releases.
"""

from unittest.mock import MagicMock, patch

import pytest


class TestFindFeedbackIds:
    def test_extracts_a_single_trailer(self):
        from scripts.mark_feedback_fixed import find_feedback_ids

        log_output = "fix(x): thing\n\nFixes-Feedback: abc123\x00"
        with patch("scripts.mark_feedback_fixed.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout=log_output)
            ids = find_feedback_ids("v1.0.0")

        assert ids == ["abc123"]
        mock_run.assert_called_once()
        assert mock_run.call_args.args[0][:2] == ["git", "log"]
        assert "v1.0.0..HEAD" in mock_run.call_args.args[0]

    def test_extracts_multiple_trailers_across_commits(self):
        from scripts.mark_feedback_fixed import find_feedback_ids

        log_output = (
            "feat(a): one\n\nFixes-Feedback: id1\x00"
            "feat(b): two\n\nFixes-Feedback: id2\nFixes-Feedback: id3\x00"
        )
        with patch("scripts.mark_feedback_fixed.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout=log_output)
            ids = find_feedback_ids("v1.0.0")

        assert ids == ["id1", "id2", "id3"]

    def test_returns_empty_list_when_no_trailers(self):
        from scripts.mark_feedback_fixed import find_feedback_ids

        with patch("scripts.mark_feedback_fixed.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="chore: bump version\x00")
            ids = find_feedback_ids("v1.0.0")

        assert ids == []

    def test_uses_head_alone_when_no_previous_tag(self):
        from scripts.mark_feedback_fixed import find_feedback_ids

        with patch("scripts.mark_feedback_fixed.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="\x00")
            find_feedback_ids("")

        assert mock_run.call_args.args[0][2] == "HEAD"


class TestMarkFixed:
    @pytest.fixture
    def mock_client(self):
        client = MagicMock()
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        return client

    def test_authenticates_then_patches_each_feedback_id(self, mock_client):
        from scripts.mark_feedback_fixed import mark_fixed

        auth_response = MagicMock()
        auth_response.raise_for_status = MagicMock()
        auth_response.json.return_value = {"token": "tok-123"}
        patch_response = MagicMock(status_code=200)

        mock_client.post = MagicMock(return_value=auth_response)
        mock_client.patch = MagicMock(return_value=patch_response)

        with patch("scripts.mark_feedback_fixed.httpx.Client", return_value=mock_client):
            mark_fixed("https://retrospekt.example", "hunter2", ["id1", "id2"], "1.5.0")

        mock_client.post.assert_called_once_with(
            "/api/v1/stats/auth", json={"password": "hunter2"}
        )
        assert mock_client.patch.call_count == 2
        first_call = mock_client.patch.call_args_list[0]
        assert first_call.args[0] == "/api/v1/feedback/id1"
        assert first_call.kwargs["json"] == {"status": "fixed", "fixed_in_version": "1.5.0"}
        assert first_call.kwargs["headers"] == {"X-Admin-Token": "tok-123"}

    def test_a_failed_patch_does_not_raise_or_stop_the_remaining_ids(self, mock_client, capsys):
        from scripts.mark_feedback_fixed import mark_fixed

        auth_response = MagicMock()
        auth_response.raise_for_status = MagicMock()
        auth_response.json.return_value = {"token": "tok-123"}
        mock_client.post = MagicMock(return_value=auth_response)
        mock_client.patch = MagicMock(
            side_effect=[MagicMock(status_code=404), MagicMock(status_code=200)]
        )

        with patch("scripts.mark_feedback_fixed.httpx.Client", return_value=mock_client):
            mark_fixed("https://retrospekt.example", "hunter2", ["missing", "ok"], "1.5.0")

        assert mock_client.patch.call_count == 2
        out = capsys.readouterr().out
        assert "missing" in out and "FAILED" in out
        assert "ok: updated" in out
