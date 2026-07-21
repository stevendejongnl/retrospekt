"""Feedback endpoint tests."""

from httpx import AsyncClient

# ---------------------------------------------------------------------------
# POST /api/v1/feedback
# ---------------------------------------------------------------------------


async def test_submit_feedback_returns_201(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"rating": 4})
    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 4
    assert "id" in data
    assert "created_at" in data


async def test_submit_feedback_stores_all_fields(client: AsyncClient):
    response = await client.post(
        "/api/v1/feedback",
        json={"rating": 5, "comment": "Great app!", "session_id": "s-1", "app_version": "1.2.3"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["comment"] == "Great app!"
    assert data["session_id"] == "s-1"
    assert data["app_version"] == "1.2.3"


async def test_submit_feedback_stores_participant_name(client: AsyncClient):
    response = await client.post(
        "/api/v1/feedback",
        json={"rating": 4, "participant_name": "Alice"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["participant_name"] == "Alice"


async def test_submit_feedback_participant_name_optional(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"rating": 3})
    assert response.status_code == 201
    assert response.json()["participant_name"] is None


async def test_submit_feedback_rating_too_low_returns_422(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"rating": 0})
    assert response.status_code == 422


async def test_submit_feedback_rating_too_high_returns_422(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"rating": 6})
    assert response.status_code == 422


async def test_submit_feedback_comment_optional(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"rating": 3})
    assert response.status_code == 201
    assert response.json()["comment"] == ""


# ---------------------------------------------------------------------------
# Apprise notification on submit
# ---------------------------------------------------------------------------


async def test_submit_feedback_notifies_apprise_when_configured(client: AsyncClient, monkeypatch):
    import asyncio
    from unittest.mock import AsyncMock, patch

    from src.config import settings

    monkeypatch.setattr(settings, "apprise_base_url", "http://apprise.local:8000")
    monkeypatch.setattr(settings, "apprise_key", "retrospekt")

    with patch(
        "src.routers.feedback.AppriseClient.notify", new=AsyncMock()
    ) as mock_notify:
        response = await client.post(
            "/api/v1/feedback",
            json={"rating": 1, "comment": "Broken", "participant_name": "Alice", "app_version": "1.2.3"},
        )
        assert response.status_code == 201
        await asyncio.sleep(0)

    mock_notify.assert_awaited_once()
    _, kwargs = mock_notify.call_args
    assert "★" in kwargs["title"] or "★" in mock_notify.call_args.args[0]
    body = kwargs.get("body") or mock_notify.call_args.args[1]
    assert "Broken" in body
    assert "Alice" in body
    assert "1.2.3" in body


async def test_submit_feedback_skips_apprise_when_not_configured(client: AsyncClient, monkeypatch):
    from unittest.mock import AsyncMock, patch

    from src.config import settings

    monkeypatch.setattr(settings, "apprise_base_url", "")
    monkeypatch.setattr(settings, "apprise_key", "")

    with patch(
        "src.routers.feedback.AppriseClient.notify", new=AsyncMock()
    ) as mock_notify:
        response = await client.post("/api/v1/feedback", json={"rating": 3})
        assert response.status_code == 201

    mock_notify.assert_not_awaited()


async def test_submit_feedback_succeeds_even_if_apprise_notify_raises(client: AsyncClient, monkeypatch):
    import asyncio
    from unittest.mock import AsyncMock, patch

    from src.config import settings

    monkeypatch.setattr(settings, "apprise_base_url", "http://apprise.local:8000")
    monkeypatch.setattr(settings, "apprise_key", "retrospekt")

    with patch(
        "src.routers.feedback.AppriseClient.notify",
        new=AsyncMock(side_effect=Exception("boom")),
    ):
        response = await client.post("/api/v1/feedback", json={"rating": 2})
        await asyncio.sleep(0)

    assert response.status_code == 201


# ---------------------------------------------------------------------------
# GET /api/v1/feedback
# ---------------------------------------------------------------------------


async def test_get_feedback_without_token_returns_401(client: AsyncClient):
    response = await client.get("/api/v1/feedback")
    assert response.status_code == 401


async def test_get_feedback_with_invalid_token_returns_401(client: AsyncClient):
    response = await client.get(
        "/api/v1/feedback", headers={"X-Admin-Token": "bad-token"}
    )
    assert response.status_code == 401


async def test_get_feedback_with_valid_token_returns_list(
    client: AsyncClient, fake_redis
):
    token = "test-admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    await client.post("/api/v1/feedback", json={"rating": 5, "comment": "Love it"})
    await client.post("/api/v1/feedback", json={"rating": 3})

    response = await client.get("/api/v1/feedback", headers={"X-Admin-Token": token})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Sorted newest first
    assert data[0]["rating"] in (3, 5)


async def test_get_feedback_empty_returns_empty_list(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    response = await client.get("/api/v1/feedback", headers={"X-Admin-Token": token})
    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# GET /api/v1/stats/admin — feedback field
# ---------------------------------------------------------------------------


async def test_admin_stats_includes_feedback_field(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    response = await client.get("/api/v1/stats/admin", headers={"X-Admin-Token": token})
    assert response.status_code == 200
    data = response.json()
    assert "feedback" in data
    assert data["feedback"]["total"] == 0
    assert data["feedback"]["avg_rating"] is None


async def test_admin_stats_feedback_counts_submissions(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    await client.post("/api/v1/feedback", json={"rating": 4})
    await client.post("/api/v1/feedback", json={"rating": 2})

    response = await client.get("/api/v1/stats/admin", headers={"X-Admin-Token": token})
    feedback = response.json()["feedback"]
    assert feedback["total"] == 2
    assert feedback["avg_rating"] == 3.0


async def test_admin_stats_recent_feedback_includes_participant_name(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    await client.post("/api/v1/feedback", json={"rating": 5, "participant_name": "Bob"})

    response = await client.get("/api/v1/stats/admin", headers={"X-Admin-Token": token})
    recent = response.json()["feedback"]["recent"]
    assert len(recent) == 1
    assert recent[0]["participant_name"] == "Bob"


# ---------------------------------------------------------------------------
# GET /api/v1/stats — feedback_total in public stats
# ---------------------------------------------------------------------------


async def test_public_stats_includes_feedback_total(client: AsyncClient):
    response = await client.get("/api/v1/stats")
    assert response.status_code == 200
    data = response.json()
    assert "feedback_total" in data
    assert data["feedback_total"] == 0


async def test_public_stats_feedback_total_increments(client: AsyncClient):
    await client.post("/api/v1/feedback", json={"rating": 5})
    response = await client.get("/api/v1/stats")
    assert response.json()["feedback_total"] == 1


# ---------------------------------------------------------------------------
# PATCH /api/v1/feedback/{id} — set fixed_in_version
# ---------------------------------------------------------------------------


async def test_patch_feedback_without_token_returns_401(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"rating": 1})
    fb_id = response.json()["id"]
    response = await client.patch(f"/api/v1/feedback/{fb_id}", json={"status": "ignored"})
    assert response.status_code == 401


async def test_patch_feedback_sets_status_fixed_with_version(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    submitted = await client.post("/api/v1/feedback", json={"rating": 1})
    fb_id = submitted.json()["id"]

    response = await client.patch(
        f"/api/v1/feedback/{fb_id}",
        json={"status": "fixed", "fixed_in_version": "1.32.0"},
        headers={"X-Admin-Token": token},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "fixed"
    assert response.json()["fixed_in_version"] == "1.32.0"

    listed = await client.get("/api/v1/feedback", headers={"X-Admin-Token": token})
    assert listed.json()[0]["status"] == "fixed"
    assert listed.json()[0]["fixed_in_version"] == "1.32.0"


async def test_patch_feedback_sets_status_ignored(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    submitted = await client.post("/api/v1/feedback", json={"rating": 1})
    fb_id = submitted.json()["id"]

    response = await client.patch(
        f"/api/v1/feedback/{fb_id}",
        json={"status": "ignored"},
        headers={"X-Admin-Token": token},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
    assert response.json()["fixed_in_version"] is None


async def test_new_feedback_defaults_to_status_new(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"rating": 3})
    assert response.json()["status"] == "new"


async def test_patch_feedback_unknown_id_returns_404(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    response = await client.patch(
        "/api/v1/feedback/does-not-exist",
        json={"status": "ignored"},
        headers={"X-Admin-Token": token},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/stats/admin — recent feedback returns all, not capped at 5
# ---------------------------------------------------------------------------


async def test_admin_stats_recent_feedback_returns_more_than_five(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    for i in range(7):
        await client.post("/api/v1/feedback", json={"rating": (i % 5) + 1})

    response = await client.get("/api/v1/stats/admin", headers={"X-Admin-Token": token})
    recent = response.json()["feedback"]["recent"]
    assert len(recent) == 7


async def test_admin_stats_recent_feedback_includes_fixed_in_version(client: AsyncClient, fake_redis):
    token = "admin-token"
    await fake_redis.set(f"admin_token:{token}", "1")

    submitted = await client.post("/api/v1/feedback", json={"rating": 1})
    fb_id = submitted.json()["id"]
    await client.patch(
        f"/api/v1/feedback/{fb_id}",
        json={"status": "fixed", "fixed_in_version": "1.32.0"},
        headers={"X-Admin-Token": token},
    )

    response = await client.get("/api/v1/stats/admin", headers={"X-Admin-Token": token})
    recent = response.json()["feedback"]["recent"]
    assert recent[0]["status"] == "fixed"
    assert recent[0]["fixed_in_version"] == "1.32.0"
