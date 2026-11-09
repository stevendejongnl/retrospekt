"""Link-preview (share banner) specification.

Chat apps and social networks never run JavaScript, so the SPA's own <head> is
useless to them. nginx hands their user agents to these endpoints instead:
a tiny HTML page carrying Open Graph tags, and the banner image those tags point at.
"""

import io
import re
from html import unescape

from httpx import AsyncClient
from PIL import Image

from src.config import settings
from src.services.banner import render_banner
from tests.conftest import make_session

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


async def test_preview_carries_the_board_name_in_open_graph_tags(client: AsyncClient):
    session = await make_session(client, name="Sprint 42 Retro")

    response = await client.get(f"/api/v1/sessions/{session.id}/preview")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert '<meta property="og:title" content="Sprint 42 Retro — Retrospective board | Retrospekt">' in response.text
    assert '<meta name="twitter:card" content="summary_large_image">' in response.text
    assert "<title>Sprint 42 Retro — Retrospective board | Retrospekt</title>" in response.text


async def test_preview_points_at_the_session_url_and_its_banner(client: AsyncClient):
    session = await make_session(client)

    html = (await client.get(f"/api/v1/sessions/{session.id}/preview")).text

    assert f'<meta property="og:url" content="http://test/session/{session.id}">' in html
    assert f'<meta property="og:image" content="http://test/api/v1/sessions/{session.id}/og.png">' in html
    assert '<meta property="og:image:width" content="1200">' in html
    assert '<meta property="og:image:height" content="630">' in html


async def test_preview_escapes_the_board_name(client: AsyncClient):
    session = await make_session(client, name='<script>alert("x")</script> & co')

    html = (await client.get(f"/api/v1/sessions/{session.id}/preview")).text

    assert "<script>" not in html
    assert "&lt;script&gt;" in html


async def test_preview_never_leaks_card_text_or_the_facilitator_token(client: AsyncClient):
    session = await make_session(client)

    html = (await client.get(f"/api/v1/sessions/{session.id}/preview")).text

    assert session.facilitator_token not in html


async def test_preview_of_unknown_session_is_404(client: AsyncClient):
    response = await client.get("/api/v1/sessions/nope/preview")

    assert response.status_code == 404


async def test_preview_builds_absolute_urls_from_forwarded_headers(client: AsyncClient):
    session = await make_session(client)

    html = (
        await client.get(
            f"/api/v1/sessions/{session.id}/preview",
            headers={"X-Forwarded-Proto": "https", "X-Forwarded-Host": "retro.example.com"},
        )
    ).text

    assert f'content="https://retro.example.com/session/{session.id}"' in html
    assert f'content="https://retro.example.com/api/v1/sessions/{session.id}/og.png"' in html


async def test_public_url_setting_wins_over_request_headers(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "public_url", "https://retro.example.org/")
    session = await make_session(client)

    html = (
        await client.get(
            f"/api/v1/sessions/{session.id}/preview",
            headers={"X-Forwarded-Host": "attacker.example"},
        )
    ).text

    assert f'content="https://retro.example.org/session/{session.id}"' in html
    assert "attacker.example" not in html


async def test_home_preview_describes_the_app(client: AsyncClient):
    response = await client.get("/api/v1/preview")

    assert response.status_code == 200
    assert '<meta property="og:title" content="Retrospekt — self-hosted real-time retrospective board">' in response.text
    assert '<meta property="og:url" content="http://test/">' in response.text
    assert '<meta property="og:image" content="http://test/api/v1/og.png">' in response.text


async def test_banner_is_a_1200_by_630_png(client: AsyncClient):
    session = await make_session(client, name="Sprint 42 Retro")

    response = await client.get(f"/api/v1/sessions/{session.id}/og.png")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(PNG_MAGIC)
    assert Image.open(io.BytesIO(response.content)).size == (1200, 630)


async def test_banner_differs_per_board_name(client: AsyncClient):
    first = await make_session(client, name="Sprint 42 Retro")
    second = await make_session(client, name="Quarterly Look Back")

    a = (await client.get(f"/api/v1/sessions/{first.id}/og.png")).content
    b = (await client.get(f"/api/v1/sessions/{second.id}/og.png")).content

    assert a != b


async def test_banner_survives_a_very_long_name(client: AsyncClient):
    session = await make_session(client, name="Superlongword" * 40 + " and many more words " * 30)

    response = await client.get(f"/api/v1/sessions/{session.id}/og.png")

    assert response.status_code == 200
    assert Image.open(io.BytesIO(response.content)).size == (1200, 630)


async def test_banner_survives_characters_the_font_lacks(client: AsyncClient):
    session = await make_session(client, name="Retro 🥓 日本語")

    response = await client.get(f"/api/v1/sessions/{session.id}/og.png")

    assert response.status_code == 200


async def test_banner_of_unknown_session_is_404(client: AsyncClient):
    response = await client.get("/api/v1/sessions/nope/og.png")

    assert response.status_code == 404


async def test_home_banner_is_a_png(client: AsyncClient):
    response = await client.get("/api/v1/og.png")

    assert response.status_code == 200
    assert Image.open(io.BytesIO(response.content)).size == (1200, 630)


async def test_meta_fragment_holds_only_tags_so_nginx_can_splice_it_into_index_html(client: AsyncClient):
    session = await make_session(client, name="Sprint 42 Retro")

    response = await client.get(f"/api/v1/sessions/{session.id}/meta")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert '<meta property="og:title" content="Sprint 42 Retro — Retrospective board | Retrospekt">' in response.text
    assert f"http://test/api/v1/sessions/{session.id}/og.png" in response.text
    assert "<title>Sprint 42 Retro — Retrospective board | Retrospekt</title>" in response.text
    for page_markup in ("<html", "<head", "<body"):
        assert page_markup not in response.text


async def test_meta_fragment_of_unknown_session_is_404(client: AsyncClient):
    response = await client.get("/api/v1/sessions/nope/meta")

    assert response.status_code == 404


async def test_home_meta_fragment_describes_the_app(client: AsyncClient):
    response = await client.get("/api/v1/meta")

    assert response.status_code == 200
    assert '<meta property="og:title" content="Retrospekt — self-hosted real-time retrospective board">' in response.text
    assert "<html" not in response.text


def description_of(html: str) -> str:
    return re.search(r'<meta name="description" content="([^"]*)">', html).group(1)  # type: ignore[union-attr]


async def test_description_is_long_enough_for_a_search_snippet(client: AsyncClient):
    session = await make_session(client, name="Sprint 42 Retro")

    html = (await client.get(f"/api/v1/sessions/{session.id}/preview")).text

    assert 120 <= len(unescape(description_of(html))) <= 160


async def test_description_names_the_board_and_adapts_to_the_phase(client: AsyncClient):
    session = await make_session(client, name="Sprint 42 Retro")

    html = (await client.get(f"/api/v1/sessions/{session.id}/preview")).text

    assert "Sprint 42 Retro" in description_of(html)
    assert "privately" in description_of(html)  # collecting phase


async def test_description_stays_within_160_characters_for_a_very_long_name(client: AsyncClient):
    session = await make_session(client, name="Extremely descriptive retrospective name " * 8)

    html = (await client.get(f"/api/v1/sessions/{session.id}/preview")).text

    assert len(unescape(description_of(html))) <= 160


async def test_title_for_a_very_long_name_is_shortened(client: AsyncClient):
    session = await make_session(client, name="Extremely descriptive retrospective name " * 8)

    html = (await client.get(f"/api/v1/sessions/{session.id}/meta")).text

    title = re.search(r"<title>([^<]*)</title>", html).group(1)  # type: ignore[union-attr]
    assert len(unescape(title)) <= 90
    assert unescape(title).endswith("| Retrospekt")


async def test_home_description_is_long_enough_for_a_search_snippet(client: AsyncClient):
    html = (await client.get("/api/v1/preview")).text

    assert 120 <= len(unescape(description_of(html))) <= 160


def test_banner_with_a_call_to_action_differs_from_one_without():
    plain = render_banner("Sprint 42 Retro", "Collecting · 3 participants")
    with_cta = render_banner("Sprint 42 Retro", "Collecting · 3 participants", cta="Join the retro")

    assert plain != with_cta
