"""Text with half an emoji (a lone UTF-16 surrogate) is rejected with 422.

Without validation it reaches MongoDB, which cannot encode it as UTF-8, and the
request fails with a 500. Python's json module decodes the escape `\\ud83d` to a
lone surrogate, so the body is sent as raw JSON with that escape in it.
"""

import pytest
from httpx import AsyncClient, Response

from tests.conftest import make_session

HALF_EMOJI = "\\ud83d"


async def post_raw_json(
    client: AsyncClient, method: str, url: str, body: str, headers: dict[str, str] | None = None
) -> Response:
    return await client.request(
        method,
        url,
        content=body.encode(),
        headers={"Content-Type": "application/json", **(headers or {})},
    )


async def test_creating_a_session_with_half_an_emoji_in_its_name_is_rejected(client: AsyncClient):
    response = await post_raw_json(client, "POST", "/api/v1/sessions", f'{{"name": "Retro {HALF_EMOJI}"}}')
    assert response.status_code == 422


async def test_joining_with_half_an_emoji_in_the_name_is_rejected(client: AsyncClient):
    session = await make_session(client)
    response = await post_raw_json(
        client,
        "POST",
        f"/api/v1/sessions/{session.id}/join",
        f'{{"participant_name": "Bob {HALF_EMOJI}"}}',
    )
    assert response.status_code == 422


async def test_adding_a_card_with_half_an_emoji_is_rejected(client: AsyncClient):
    session = await make_session(client)
    response = await post_raw_json(
        client,
        "POST",
        f"/api/v1/sessions/{session.id}/cards",
        f'{{"column": "Went Well", "text": "Bingo {HALF_EMOJI}", "author_name": "Alice"}}',
    )
    assert response.status_code == 422


async def test_editing_a_card_to_half_an_emoji_is_rejected(client: AsyncClient):
    session = await make_session(client)
    card = (
        await client.post(
            f"/api/v1/sessions/{session.id}/cards",
            json={"column": "Went Well", "text": "Fine", "author_name": "Alice"},
        )
    ).json()
    response = await post_raw_json(
        client,
        "PATCH",
        f"/api/v1/sessions/{session.id}/cards/{card['id']}/text",
        f'{{"text": "Bingo {HALF_EMOJI}"}}',
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        f'{{"text": "Note {HALF_EMOJI}", "author_name": "Alice"}}',
        f'{{"title": "Title {HALF_EMOJI}", "text": "Note", "author_name": "Alice"}}',
    ],
)
async def test_adding_a_note_with_half_an_emoji_is_rejected(client: AsyncClient, body: str):
    session = await make_session(client)
    response = await post_raw_json(
        client,
        "POST",
        f"/api/v1/sessions/{session.id}/notes",
        body,
        headers={"X-Participant-Name": "Alice"},
    )
    assert response.status_code == 422


async def test_adding_a_column_with_half_an_emoji_is_rejected(client: AsyncClient):
    session = await make_session(client)
    response = await post_raw_json(
        client,
        "POST",
        f"/api/v1/sessions/{session.id}/columns",
        f'{{"name": "Ideas {HALF_EMOJI}"}}',
        headers={"X-Facilitator-Token": session.facilitator_token},
    )
    assert response.status_code == 422


async def test_feedback_with_half_an_emoji_in_the_comment_is_rejected(client: AsyncClient):
    response = await post_raw_json(
        client, "POST", "/api/v1/feedback", f'{{"rating": 5, "comment": "Nice {HALF_EMOJI}"}}'
    )
    assert response.status_code == 422


async def test_a_complete_emoji_is_still_accepted(client: AsyncClient):
    session = await make_session(client)
    response = await post_raw_json(
        client,
        "POST",
        f"/api/v1/sessions/{session.id}/cards",
        '{"column": "Went Well", "text": "Bingo \\ud83e\\udd79", "author_name": "Alice"}',
    )
    assert response.status_code == 201
    assert response.json()["text"] == "Bingo 🥹"
