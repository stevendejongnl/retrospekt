"""Renders the 1200x630 banner that chat apps show when a board URL is shared."""

import io
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 1200
HEIGHT = 630

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

BACKGROUND = "#fdfcf9"
ACCENT = "#d97426"
ACCENT_TINT = "#fdf3e8"
ON_ACCENT = "#ffffff"
TEXT_PRIMARY = "#1c1a17"
TEXT_SECONDARY = "#5a534b"

LEFT_MARGIN = 96
TEXT_WIDTH = WIDTH - LEFT_MARGIN * 2
TITLE_SIZE = 92
TITLE_MAX_LINES = 3
TITLE_LINE_HEIGHT = 112
FALLBACK_TITLE = "Retro board"


@lru_cache(maxsize=8)
def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), size)


def drop_unsupported_characters(text: str, font: ImageFont.FreeTypeFont) -> str:
    """Remove characters the font has no glyph for (emoji, CJK) instead of drawing a tofu box."""
    missing = bytes(font.getmask("￿"))
    kept = "".join(ch for ch in text if ch.isspace() or bytes(font.getmask(ch)) != missing)
    return " ".join(kept.split())


def wrap_title(text: str, font: ImageFont.FreeTypeFont, max_width: int, max_lines: int) -> list[str]:
    """Greedy word wrap; a word wider than a line is split, overflow ends in an ellipsis."""
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if font.getlength(candidate) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
            current = ""
        while font.getlength(word) > max_width:
            cut = len(word)
            while cut > 1 and font.getlength(word[:cut]) > max_width:
                cut -= 1
            lines.append(word[:cut])
            word = word[cut:]
        current = word
    if current:
        lines.append(current)

    if len(lines) <= max_lines:
        return lines
    last = lines[max_lines - 1]
    while last and font.getlength(f"{last}…") > max_width:
        last = last[:-1]
    return [*lines[: max_lines - 1], f"{last.rstrip()}…"]


def render_banner(title: str, subtitle: str | None = None, cta: str | None = None) -> bytes:
    title_font = load_font("DejaVuSans-Bold.ttf", TITLE_SIZE)
    brand_font = load_font("DejaVuSans-Bold.ttf", 40)
    subtitle_font = load_font("DejaVuSans.ttf", 38)

    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 28, HEIGHT), fill=ACCENT)

    draw.text((LEFT_MARGIN, 72), "Retrospekt", font=brand_font, fill=ACCENT)

    cleaned = drop_unsupported_characters(title, title_font) or FALLBACK_TITLE
    lines = wrap_title(cleaned, title_font, TEXT_WIDTH, TITLE_MAX_LINES)
    block_height = TITLE_LINE_HEIGHT * len(lines)
    top = 150 + (TITLE_LINE_HEIGHT * TITLE_MAX_LINES - block_height) // 2
    for index, line in enumerate(lines):
        draw.text((LEFT_MARGIN, top + index * TITLE_LINE_HEIGHT), line, font=title_font, fill=TEXT_PRIMARY)

    if subtitle:
        pill_text = drop_unsupported_characters(subtitle, subtitle_font)
        if pill_text:
            pill_width = int(subtitle_font.getlength(pill_text)) + 56
            draw.rounded_rectangle(
                (LEFT_MARGIN, 506, LEFT_MARGIN + pill_width, 574), radius=34, fill=ACCENT_TINT
            )
            draw.text((LEFT_MARGIN + 28, 515), pill_text, font=subtitle_font, fill=TEXT_SECONDARY)

    if cta:
        button_text = drop_unsupported_characters(cta, brand_font)
        if button_text:
            button_width = int(brand_font.getlength(button_text)) + 64
            right = WIDTH - LEFT_MARGIN
            draw.rounded_rectangle((right - button_width, 506, right, 574), radius=34, fill=ACCENT)
            draw.text((right - button_width + 32, 518), button_text, font=brand_font, fill=ON_ACCENT)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
