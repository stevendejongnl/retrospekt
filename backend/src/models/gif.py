"""GIF search result domain model."""

from typing import Literal

from pydantic import BaseModel


class GifResult(BaseModel):
    id: str
    preview_url: str
    url: str
    provider: Literal["giphy", "tenor"]
