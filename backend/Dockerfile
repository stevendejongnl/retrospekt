FROM python:3.12-slim

WORKDIR /app

RUN pip install uv --no-cache-dir

COPY pyproject.toml .
RUN uv venv /app/.venv && \
    uv pip install --python /app/.venv/bin/python \
    fastapi "uvicorn[standard]" motor pydantic-settings sse-starlette

COPY src/ src/

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
