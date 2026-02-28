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
"""

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
