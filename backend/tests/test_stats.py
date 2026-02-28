"""Tests for stats endpoints — written RED-first per TDD convention.

TDD commit order:
  test(stats): public stats returns zero counts for empty DB
  feat(stats): add StatsRepository.get_public_stats() + stats router
  test(stats): admin auth returns 503 when hash not configured
  feat(stats): add POST /api/v1/stats/auth with argon2 verification
  test(stats): admin stats requires valid X-Admin-Token
  feat(stats): add GET /api/v1/stats/admin with Redis token check
  test(stats): admin aggregations (reactions, funnel)
  feat(stats): implement StatsRepository.get_admin_stats()
  test(stats): add SessionLifetimeStats backend tests
  feat(stats): implement session lifetime aggregations
"""

from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher

from src.config import settings
from tests.conftest import make_session

# ---------------------------------------------------------------------------
# Public stats — GET /api/v1/stats
# ---------------------------------------------------------------------------


class TestPublicStatsEmpty:
    async def test_public_stats_empty_db(self, client):
        response = await client.get("/api/v1/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_sessions"] == 0
        assert data["active_sessions"] == 0
        assert data["sessions_by_phase"] == []
        assert data["sessions_per_day"] == []
        assert data["total_cards"] == 0
        assert data["avg_cards_per_session"] == 0.0
        assert data["total_votes"] == 0
        assert data["total_reactions"] == 0


class TestPublicStatsCounts:
    async def test_total_sessions_counts_all(self, client):
        await make_session(client, name="Retro 1")
        await make_session(client, name="Retro 2")
        response = await client.get("/api/v1/stats")
        assert response.status_code == 200
        assert response.json()["total_sessions"] == 2

    async def test_active_sessions_excludes_closed(self, client):
        await make_session(client, name="Active")
        await make_session(client, name="Closed")
        # Close the second session
        closed = await make_session(client, name="To close")
        await client.post(
            f"/api/v1/sessions/{closed.id}/phase",
            json={"phase": "discussing"},
            headers={"X-Facilitator-Token": closed.facilitator_token},
        )
        await client.post(
            f"/api/v1/sessions/{closed.id}/phase",
            json={"phase": "closed"},
            headers={"X-Facilitator-Token": closed.facilitator_token},
        )
        response = await client.get("/api/v1/stats")
        data = response.json()
        assert data["active_sessions"] == 2  # s + "Closed" are still collecting


class TestPublicStatsByPhase:
    async def test_sessions_by_phase_groups_correctly(self, client):
        await make_session(client, name="R1")
        await make_session(client, name="R2")
        s3 = await make_session(client, name="R3")
        # Advance s3 to discussing
        await client.post(
            f"/api/v1/sessions/{s3.id}/phase",
            json={"phase": "discussing"},
            headers={"X-Facilitator-Token": s3.facilitator_token},
        )
        response = await client.get("/api/v1/stats")
        data = response.json()
        by_phase = {item["phase"]: item["count"] for item in data["sessions_by_phase"]}
        assert by_phase.get("collecting", 0) == 2
        assert by_phase.get("discussing", 0) == 1


class TestPublicStatsPerDay:
    async def test_sessions_per_day_format(self, client):
        await make_session(client, name="Today")
        response = await client.get("/api/v1/stats")
        per_day = response.json()["sessions_per_day"]
        assert len(per_day) >= 1
        # Each entry must have a date string "YYYY-MM-DD" and a count
        for entry in per_day:
            assert len(entry["date"]) == 10
            assert entry["date"][4] == "-" and entry["date"][7] == "-"
            assert entry["count"] >= 1


class TestPublicStatsCardsVotesReactions:
    async def test_total_cards_counts_nested_cards(self, client):
        s = await make_session(client, name="Retro")
        await client.post(
            f"/api/v1/sessions/{s.id}/cards",
            json={"column": "Went Well", "text": "Card 1", "author_name": "Alice"},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards",
            json={"column": "Went Well", "text": "Card 2", "author_name": "Alice"},
        )
        response = await client.get("/api/v1/stats")
        assert response.json()["total_cards"] == 2

    async def test_avg_cards_per_session(self, client):
        s1 = await make_session(client, name="R1")
        await client.post(
            f"/api/v1/sessions/{s1.id}/cards",
            json={"column": "Went Well", "text": "C", "author_name": "Alice"},
        )
        await make_session(client, name="R2")  # no cards
        response = await client.get("/api/v1/stats")
        data = response.json()
        assert data["total_sessions"] == 2
        assert data["total_cards"] == 1
        assert data["avg_cards_per_session"] == 0.5

    async def test_total_votes(self, client):
        s = await make_session(client, name="Retro")
        resp = await client.post(
            f"/api/v1/sessions/{s.id}/cards",
            json={"column": "Went Well", "text": "Card", "author_name": "Alice"},
        )
        card_id = resp.json()["id"]
        # publish card so voting is allowed
        await client.post(
            f"/api/v1/sessions/{s.id}/phase",
            json={"phase": "discussing"},
            headers={"X-Facilitator-Token": s.facilitator_token},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards/{card_id}/publish",
            headers={"X-Participant-Name": "Alice"},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards/{card_id}/votes",
            headers={"X-Participant-Name": "Bob"},
        )
        response = await client.get("/api/v1/stats")
        assert response.json()["total_votes"] == 1

    async def test_total_reactions(self, client):
        s = await make_session(client, name="Retro")
        resp = await client.post(
            f"/api/v1/sessions/{s.id}/cards",
            json={"column": "Went Well", "text": "Card", "author_name": "Alice"},
        )
        card_id = resp.json()["id"]
        # publish card so reactions are allowed
        await client.post(
            f"/api/v1/sessions/{s.id}/phase",
            json={"phase": "discussing"},
            headers={"X-Facilitator-Token": s.facilitator_token},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards/{card_id}/publish",
            headers={"X-Participant-Name": "Alice"},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards/{card_id}/reactions",
            json={"emoji": "❤️"},
            headers={"X-Participant-Name": "Bob"},
        )
        response = await client.get("/api/v1/stats")
        assert response.json()["total_reactions"] == 1


# ---------------------------------------------------------------------------
# Admin auth — POST /api/v1/stats/auth
# ---------------------------------------------------------------------------


class TestAdminAuth:
    async def test_503_when_not_configured(self, client):
        response = await client.post("/api/v1/stats/auth", json={"password": "any"})
        assert response.status_code == 503

    async def test_token_on_correct_password(self, client, monkeypatch):
        ph = PasswordHasher()
        monkeypatch.setattr(settings, "admin_password_hash", ph.hash("supersecret"))
        response = await client.post("/api/v1/stats/auth", json={"password": "supersecret"})
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert len(data["token"]) > 10  # UUID4

    async def test_401_wrong_password(self, client, monkeypatch):
        ph = PasswordHasher()
        monkeypatch.setattr(settings, "admin_password_hash", ph.hash("correct"))
        response = await client.post("/api/v1/stats/auth", json={"password": "wrong"})
        assert response.status_code == 401

    async def test_token_ttl_stored_in_redis(self, client, fake_redis, monkeypatch):
        ph = PasswordHasher()
        monkeypatch.setattr(settings, "admin_password_hash", ph.hash("pw"))
        response = await client.post("/api/v1/stats/auth", json={"password": "pw"})
        token = response.json()["token"]
        ttl = await fake_redis.ttl(f"admin_token:{token}")
        assert 86390 <= ttl <= 86400


# ---------------------------------------------------------------------------
# Admin stats — GET /api/v1/stats/admin
# ---------------------------------------------------------------------------


class TestAdminStats:
    async def test_401_no_token(self, client):
        response = await client.get("/api/v1/stats/admin")
        assert response.status_code == 401

    async def test_401_invalid_token(self, client):
        response = await client.get(
            "/api/v1/stats/admin", headers={"X-Admin-Token": "nonexistent"}
        )
        assert response.status_code == 401

    async def test_200_valid_token(self, client, fake_redis):
        token = "valid-test-token"
        await fake_redis.set(f"admin_token:{token}", "1", ex=86400)
        response = await client.get(
            "/api/v1/stats/admin", headers={"X-Admin-Token": token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "reaction_breakdown" in data
        assert "cards_per_column" in data
        assert "activity_heatmap" in data
        assert "engagement_funnel" in data

    async def test_reaction_breakdown(self, client, fake_redis):
        token = "token-rxn"
        await fake_redis.set(f"admin_token:{token}", "1", ex=86400)

        s = await make_session(client, name="Retro")
        resp = await client.post(
            f"/api/v1/sessions/{s.id}/cards",
            json={"column": "Went Well", "text": "Card", "author_name": "Alice"},
        )
        card_id = resp.json()["id"]
        await client.post(
            f"/api/v1/sessions/{s.id}/phase",
            json={"phase": "discussing"},
            headers={"X-Facilitator-Token": s.facilitator_token},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards/{card_id}/publish",
            headers={"X-Participant-Name": "Alice"},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards/{card_id}/reactions",
            json={"emoji": "❤️"},
            headers={"X-Participant-Name": "Bob"},
        )
        await client.post(
            f"/api/v1/sessions/{s.id}/cards/{card_id}/reactions",
            json={"emoji": "❤️"},
            headers={"X-Participant-Name": "Alice"},
        )

        response = await client.get(
            "/api/v1/stats/admin", headers={"X-Admin-Token": token}
        )
        data = response.json()
        breakdown = {item["emoji"]: item["count"] for item in data["reaction_breakdown"]}
        assert breakdown.get("❤️", 0) == 2

    async def test_engagement_funnel(self, client, fake_redis):
        token = "token-funnel"
        await fake_redis.set(f"admin_token:{token}", "1", ex=86400)

        # Session with no cards
        await make_session(client, name="Empty")
        # Session with cards but no votes
        s2 = await make_session(client, name="Has cards")
        await client.post(
            f"/api/v1/sessions/{s2.id}/cards",
            json={"column": "Went Well", "text": "C", "author_name": "Alice"},
        )
        # Session with cards + votes (closed)
        s3 = await make_session(client, name="Full")
        resp = await client.post(
            f"/api/v1/sessions/{s3.id}/cards",
            json={"column": "Went Well", "text": "C", "author_name": "Alice"},
        )
        card_id = resp.json()["id"]
        await client.post(
            f"/api/v1/sessions/{s3.id}/phase",
            json={"phase": "discussing"},
            headers={"X-Facilitator-Token": s3.facilitator_token},
        )
        await client.post(
            f"/api/v1/sessions/{s3.id}/cards/{card_id}/publish",
            headers={"X-Participant-Name": "Alice"},
        )
        await client.post(
            f"/api/v1/sessions/{s3.id}/cards/{card_id}/votes",
            headers={"X-Participant-Name": "Bob"},
        )
        await client.post(
            f"/api/v1/sessions/{s3.id}/phase",
            json={"phase": "closed"},
            headers={"X-Facilitator-Token": s3.facilitator_token},
        )

        response = await client.get(
            "/api/v1/stats/admin", headers={"X-Admin-Token": token}
        )
        funnel = response.json()["engagement_funnel"]
        assert funnel["created"] == 3
        assert funnel["has_cards"] == 2
        assert funnel["has_votes"] == 1
        assert funnel["closed"] == 1


# ---------------------------------------------------------------------------
# Session lifetime stats — GET /api/v1/stats/admin (session_lifetime field)
# ---------------------------------------------------------------------------

TOKEN = "lifetime-test-token"


class TestAdminStatsLifetime:
    """Tests for the session_lifetime field added to AdminStats."""

    async def _get_lifetime(self, client, fake_redis) -> dict:
        await fake_redis.set(f"admin_token:{TOKEN}", "1", ex=86400)
        response = await client.get(
            "/api/v1/stats/admin", headers={"X-Admin-Token": TOKEN}
        )
        assert response.status_code == 200
        return response.json()["session_lifetime"]

    # --- key presence ---

    async def test_lifetime_key_present_in_admin_stats(self, client, fake_redis):
        data = await self._get_lifetime(client, fake_redis)
        assert "expiry_countdown" in data
        assert "lifetime_distribution" in data
        assert "avg_duration" in data
        assert "avg_time_to_close_hours" in data

    # --- expiry countdown ---

    async def test_expiry_within_30d_counts_active_sessions(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        # Created recently — will not expire within 30 days if expiry_days=30 and age < 0
        # Actually expiry = created_at + 30 days, so "within 30 days" = created_at > now - 30d
        # Two new sessions created just now
        await session_factory(created_at=now - timedelta(days=1))
        await session_factory(created_at=now - timedelta(days=5))
        data = await self._get_lifetime(client, fake_redis)
        assert data["expiry_countdown"]["expiring_within_30_days"] == 2

    async def test_expiry_within_7d_counts_sessions_expiring_soon(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        # With expiry_days=30, a session created 26 days ago expires in 4 days → within 7d
        await session_factory(created_at=now - timedelta(days=26))
        data = await self._get_lifetime(client, fake_redis)
        assert data["expiry_countdown"]["expiring_within_7_days"] == 1

    async def test_expiry_within_7d_excludes_sessions_outside_window(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        # Created 20 days ago → expires in 10 days → NOT within 7d
        await session_factory(created_at=now - timedelta(days=20))
        data = await self._get_lifetime(client, fake_redis)
        assert data["expiry_countdown"]["expiring_within_7_days"] == 0

    async def test_expiry_countdown_excludes_closed_sessions(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        # Closed session expiring soon — should NOT be counted
        await session_factory(phase="closed", created_at=now - timedelta(days=26))
        data = await self._get_lifetime(client, fake_redis)
        assert data["expiry_countdown"]["expiring_within_30_days"] == 0
        assert data["expiry_countdown"]["expiring_within_7_days"] == 0

    # --- lifetime distribution ---

    async def test_lifetime_distribution_has_four_buckets(self, client, fake_redis):
        # Even with empty DB, always 4 ordered buckets
        data = await self._get_lifetime(client, fake_redis)
        buckets = data["lifetime_distribution"]
        assert len(buckets) == 4
        labels = [b["label"] for b in buckets]
        assert labels == ["<1 day", "1–7 days", "7–30 days", "30+ days"]

    async def test_lifetime_distribution_new_session_is_less_than_1_day(
        self, client, fake_redis, session_factory
    ):
        await session_factory()  # created just now
        data = await self._get_lifetime(client, fake_redis)
        dist = {b["label"]: b["count"] for b in data["lifetime_distribution"]}
        assert dist["<1 day"] == 1
        assert dist["1–7 days"] == 0

    async def test_lifetime_distribution_old_session_is_30_plus_days(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        await session_factory(created_at=now - timedelta(days=35))
        data = await self._get_lifetime(client, fake_redis)
        dist = {b["label"]: b["count"] for b in data["lifetime_distribution"]}
        assert dist["30+ days"] == 1
        assert dist["<1 day"] == 0

    # --- avg duration ---

    async def test_avg_duration_none_when_no_sessions(self, client, fake_redis):
        data = await self._get_lifetime(client, fake_redis)
        assert data["avg_duration"]["open_avg_hours"] is None
        assert data["avg_duration"]["closed_avg_hours"] is None

    async def test_avg_duration_open_sessions(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        await session_factory(
            phase="collecting",
            created_at=now - timedelta(hours=48),
            last_accessed_at=now,
        )
        data = await self._get_lifetime(client, fake_redis)
        avg = data["avg_duration"]["open_avg_hours"]
        assert avg is not None
        assert 47 <= avg <= 49  # allow ±1h for test timing

    async def test_avg_duration_closed_sessions(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        await session_factory(
            phase="closed",
            created_at=now - timedelta(hours=24),
            last_accessed_at=now,
        )
        data = await self._get_lifetime(client, fake_redis)
        avg = data["avg_duration"]["closed_avg_hours"]
        assert avg is not None
        assert 23 <= avg <= 25

    # --- avg time to close ---

    async def test_avg_time_to_close_none_when_no_closed_sessions(
        self, client, fake_redis
    ):
        data = await self._get_lifetime(client, fake_redis)
        assert data["avg_time_to_close_hours"] is None

    async def test_avg_time_to_close_from_created_to_updated(
        self, client, fake_redis, session_factory
    ):
        now = datetime.now(UTC)
        await session_factory(
            phase="closed",
            created_at=now - timedelta(hours=6),
            updated_at=now,
        )
        data = await self._get_lifetime(client, fake_redis)
        avg = data["avg_time_to_close_hours"]
        assert avg is not None
        assert 5 <= avg <= 7
