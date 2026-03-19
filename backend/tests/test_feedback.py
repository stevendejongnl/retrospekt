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
