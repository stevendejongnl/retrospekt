"""Link previews: Open Graph page + banner image for shared board URLs.

The SPA's <head> is static and crawlers don't run JS, so nginx routes link-preview
user agents here instead of to index.html. Nothing here touches the session's
expiry clock — a bot unfurling a link must not keep a board alive.
"""

from html import escape
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, Response

from ..config import settings
from ..dependencies import get_repo
from ..models.session import Session
from ..repositories.session_repo import SessionRepository
from ..services.banner import HEIGHT, WIDTH, render_banner

router = APIRouter(prefix="/api/v1")

CACHE_CONTROL = "public, max-age=300"
SITE_NAME = "Retrospekt"
HOME_DESCRIPTION = "A self-hosted, real-time retrospective board."


def public_base_url(request: Request) -> str:
    """Absolute origin the visitor used. PUBLIC_URL wins so a spoofed Host header can't redirect previews."""
    if settings.public_url:
        return settings.public_url.rstrip("/")
    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{scheme}://{host}"


def session_description(session: Session) -> str:
    count = len(session.participants)
    people = f"{count} participant{'' if count == 1 else 's'}"
    return f"Join the retrospective — {session.phase.value} · {people}"


def banner_subtitle(session: Session) -> str:
    count = len(session.participants)
    return f"{session.phase.value.capitalize()} · {count} participant{'' if count == 1 else 's'}"


def preview_page(*, title: str, description: str, page_url: str, image_url: str) -> HTMLResponse:
    values = {key: escape(value, quote=True) for key, value in locals().items()}
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{values["title"]}</title>
<meta name="description" content="{values["description"]}">
<link rel="canonical" href="{values["page_url"]}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:title" content="{values["title"]}">
<meta property="og:description" content="{values["description"]}">
<meta property="og:url" content="{values["page_url"]}">
<meta property="og:image" content="{values["image_url"]}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="{WIDTH}">
<meta property="og:image:height" content="{HEIGHT}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{values["title"]}">
<meta name="twitter:description" content="{values["description"]}">
<meta name="twitter:image" content="{values["image_url"]}">
</head>
<body><a href="{values["page_url"]}">{values["title"]}</a></body>
</html>
"""
    return HTMLResponse(html, headers={"Cache-Control": CACHE_CONTROL})


def banner_response(title: str, subtitle: str | None) -> Response:
    return Response(
        render_banner(title, subtitle), media_type="image/png", headers={"Cache-Control": CACHE_CONTROL}
    )


async def find_session(session_id: str, repo: SessionRepository) -> Session:
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/preview")
async def home_preview(request: Request) -> HTMLResponse:
    base = public_base_url(request)
    return preview_page(
        title=SITE_NAME,
        description=HOME_DESCRIPTION,
        page_url=f"{base}/",
        image_url=f"{base}/api/v1/og.png",
    )


@router.get("/og.png")
async def home_banner() -> Response:
    return banner_response(SITE_NAME, "Retrospective board")


@router.get("/sessions/{session_id}/preview")
async def session_preview(
    session_id: str,
    request: Request,
    repo: SessionRepository = Depends(get_repo),
) -> HTMLResponse:
    session = await find_session(session_id, repo)
    base = public_base_url(request)
    slug = quote(session.id, safe="")
    return preview_page(
        title=f"{session.name} — {SITE_NAME}",
        description=session_description(session),
        page_url=f"{base}/session/{slug}",
        image_url=f"{base}/api/v1/sessions/{slug}/og.png",
    )


@router.get("/sessions/{session_id}/og.png")
async def session_banner(session_id: str, repo: SessionRepository = Depends(get_repo)) -> Response:
    session = await find_session(session_id, repo)
    return banner_response(session.name, banner_subtitle(session))
