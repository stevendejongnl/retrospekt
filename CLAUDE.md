# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Retrospekt is a self-hosted, real-time retrospective board (replacement for retrotool.io). Sessions go through three phases: **collecting** (add cards privately), **discussing** (vote + publish cards), **closed**.

## Commands

### Local development
```bash
make install        # uv sync (backend) + npm install (frontend + root)
make start          # Start all services via Docker Compose
make stop           # Stop services
make logs           # Tail all logs
```

Services: Frontend `http://localhost:3001`, Backend `http://localhost:8001`

### Backend (in `backend/`)
```bash
uv run pytest                   # Run all tests
uv run pytest tests/test_X.py  # Run a single test file
uv run pytest -k "test_name"   # Run a single test
uv run ruff check .             # Lint
uv run mypy src                 # Type check
```

### Frontend (in `frontend/`)
```bash
npm test                        # Vitest unit tests
npm run test:coverage           # With coverage
npm run test:ct                 # Playwright component tests
npm run test:wtr                # Web Test Runner tests
npm run typecheck               # tsc type check
npm run lint                    # ESLint
```

### E2E (from root, requires services running)
```bash
npx playwright test             # Full E2E suite
npx playwright test --ui        # Interactive debugging
```

### Run all checks
```bash
nox                             # lint + mypy + pytest (backend), lint + typecheck (frontend)
```

## Architecture

### Backend (`backend/src/`)
- **FastAPI** REST API with **Motor** (async MongoDB) and **sse-starlette** for Server-Sent Events
- `main.py` — app factory; `config.py` — pydantic-settings; `database.py` — Motor connection
- `models/session.py` — Domain models: `Session`, `Card`, `Participant`, `Vote`, `SessionPhase`
- `repositories/session_repo.py` — All MongoDB access; `services/sse_manager.py` — pub/sub for SSE broadcasts
- `routers/sessions.py` — Session CRUD + phase transitions (bidirectional) + column management (add/rename/delete) + SSE stream endpoint
- `routers/cards.py` — Card CRUD + voting + per-card publish (author) + publish-all in column (participant's own cards)

### Frontend (`frontend/src/`)
- **Lit** web components + **Vite** + TypeScript; custom client-side router (no library)
- `router.ts` — pattern-based routing, exposed as `window.router`; `api.ts` — fetch wrapper; `sse.ts` — SSE client
- `storage.ts` — localStorage helper: per-session keys (`retro_name_{id}`, `retro_facilitator_{id}`) + cross-session `retro_history` (array of up to 50 `SessionHistoryEntry`)
- `theme.ts` — theme init, toggle, and persistence (`retro_theme` in localStorage); `initTheme()` called before router start to prevent FOUC
- `icons.ts` — Font Awesome Free 7.2.0 SVG icons as inline Lit `TemplateResult` values; `faIconStyles` shared CSS for sizing/alignment
- Pages: `home-page` (session creation + template picker + history sidebar), `session-page` (main board + SSE lifecycle)
- Components: `session-history` (sidebar panel, used in both pages), `retro-board` (facilitator controls + columns) → `retro-column` → `retro-card`
- **State**: component-local `@state()` + SSE pushes full `Session` object on every change — backend is the single source of truth. No global store.

### Real-time flow
Every mutation (add card, vote, publish, phase change) calls the REST API → backend saves to MongoDB → SSE manager broadcasts full session to all subscribers → all clients re-render.

### Auth model
- **Facilitator**: UUID token in `X-Facilitator-Token` header, stored in localStorage
- **Participants**: Name in `X-Participant-Name` header
- No login system — session-scoped tokens only

### Phase-based visibility (frontend enforced)
- `collecting`: each participant only sees their own cards; facilitator can add/rename/delete columns
- `discussing`: published cards visible to all; drafts only to author; each author can publish their own cards; facilitator can publish-all per column (publishes the facilitator's own cards in that column)
- `closed`: read-only
- Phase transitions are bidirectional — facilitator can move forward or backward between any phases

## Key Conventions

- Conventional commits (used by semantic-release for automated versioning/CHANGELOG)
- Backend: Python 3.12+, strict mypy, ruff for linting
- Frontend: strict TypeScript (`noUnusedLocals`, `noUnusedParameters`), ESLint
- Test files: `*.test.ts` (Vitest), `*.wtr.ts` (Web Test Runner), `*.spec.ts` (Playwright CT)
- MongoDB document model: `Session` embeds `Card[]`, `Participant[]` (cards contain `Vote[]`)

## Deployment

- **Docker Compose** for local dev (`compose.yml`); watch mounts for hot reload
- **Kubernetes** in production (`kubernetes.yaml`); deployed to `retrospekt.madebysteven.nl`
- CI/CD via GitHub Actions: `release.yml` (tests + semantic-release) → `docker-publish.yml` (build images + K8s rollout)
- Backend config via env vars: `MONGODB_URL`, `MONGODB_DATABASE`, `SESSION_EXPIRY_DAYS` (default 30); K8s reads from `retrospekt-mongodb-secret`
