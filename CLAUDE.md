# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Retrospekt is a self-hosted, real-time retrospective board. Sessions go through three phases: **collecting** (add cards privately), **discussing** (vote + publish cards), **closed**.

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
- `repositories/session_repo.py` — All MongoDB access; `repositories/stats_repo.py` — `StatsRepository` with `get_public_stats()` + `get_admin_stats()` using MongoDB `$facet` aggregation; `services/sse_manager.py` — Redis pub/sub for SSE broadcasts
- `routers/sessions.py` — Session CRUD + phase transitions (bidirectional) + column management (add/rename/delete) + SSE stream endpoint; `_check_facilitator_auth(session, token, participant_name)` helper — allows access when token matches OR (`open_facilitator=True` and participant name provided)
- `routers/cards.py` — Card CRUD + voting + per-card publish (author) + publish-all in column (participant's own cards) + inline text edit (`PATCH .../cards/{id}/text`, author-only, 409 in closed)
- `routers/stats.py` — `GET /api/v1/stats` (public), `POST /api/v1/stats/auth` (argon2 password → Redis token), `GET /api/v1/stats/admin` (`X-Admin-Token` required); `ADMIN_PASSWORD_HASH` in settings (empty = feature disabled); calls `SentryService` when all three Sentry env vars are set
- `services/sentry_service.py` — `SentryService` class; fetches issues, error-rate 7d, and p95 latency 7d from Sentry API concurrently via `httpx` + `asyncio.gather`; models (`SentryIssue`, `SentryDataPoint`, `SentryHealth`) defined in `stats_repo.py`

### Frontend (`frontend/src/`)
- **Lit** web components + **Vite** + TypeScript; custom client-side router (no library)
- `router.ts` — pattern-based routing, exposed as `window.router`; `api.ts` — fetch wrapper; `sse.ts` — SSE client
- `storage.ts` — localStorage helper: per-session keys (`retro_name_{id}`, `retro_facilitator_{id}`) + cross-session `retro_history` (array of up to 50 `SessionHistoryEntry`)
- `theme.ts` — theme init/toggle/persistence (`retro_theme` in localStorage) + brand theming (`retro_brand`; activate via `?theme=cs`); `initTheme()` + `initBrand()` called before router start to prevent FOUC
- `icons.ts` — Font Awesome Free 7.2.0 SVG icons as inline Lit `TemplateResult` values; `faIconStyles` shared CSS for sizing/alignment
- `types.ts` — TypeScript interfaces: `Session`, `Card`, `Participant`, `Vote`, `Reaction`, `TimerState`, `SessionPhase`, `SentryIssue`, `SentryDataPoint`, `SentryHealth`
- Pages: `home-page` (session creation + template picker + history sidebar + Jira config), `session-page` (main board + SSE lifecycle), `stats-page` (public + admin analytics with D3 donut/bar charts; admin section behind password), `not-found-page` (404 + redirect)
- Components: `session-history` (sidebar panel, used in both pages), `retro-board` (facilitator controls + columns) → `retro-column` → `retro-card`
- **Jira export**: pure client-side feature; `retro_jira` localStorage key (`{ baseUrl, projectKey }`); configured on home-page; published cards show ⋮ menu → "Export to Jira" opens `CreateIssueDetails!init.jspa` in a new tab; `buildJiraUrl()` exported from `retro-card.ts`; `extractJiraBaseUrl()` exported from `home-page.ts`; `sessionName` threaded retro-board → retro-column → retro-card
- **Inline card edit**: `canEdit` boolean prop on `retro-card` (set in `retro-column`: author + not closed); click `.card-text` → textarea swap; Enter saves, Escape cancels, blur saves (if still editing); dispatches `edit-card` event → `retro-board.onEditCard` → `api.updateCardText()`
- **Card grouping**: discussing phase only; any participant can drag a published card onto another to stack them; `group_id: string | null` on `Card`; `CardItem` discriminated union in `retro-column` (`{ kind: 'single' }` | `{ kind: 'group' }`); collapsed stack tile → click → expand inline; `ungroup-btn` on each expanded card; events: `group-cards` / `ungroup-card` bubble to `.columns` div in `retro-board` → `api.groupCard` / `api.ungroupCard`; module-level `_draggedCardId` + `_draggedCardColumn` fallback for Firefox; `getDraggedCardInfo()` exported from `retro-card.ts`; cross-column drag blocked (frontend: column check in `_onDragOver`/`_onDrop`; backend: 409 if `card.column != target.column`); collapsed stack tile has drag handlers (using `getDraggedCardInfo()`) so 3+ cards can be grouped; expanded group wrapped in `.stack-expanded` container (left border + tinted bg); backend: `POST/DELETE /{session_id}/cards/{card_id}/group` in `routers/groups.py`; singleton cleanup (when last 2 members split, both `group_id` cleared)
- **Open facilitator mode**: `open_facilitator: bool = False` on `Session`; when enabled, all participants get full facilitator powers (phase transitions, column management, settings, timer); facilitator enables/disables from the settings dialog (`.settings-open-facilitator-input`); `isFacilitator` getter in `retro-board` checks `storage.isFacilitator(id) || !!session.open_facilitator`; all 9 facilitator API methods accept optional `participantName?` param (sent as `X-Participant-Name` header alongside token); backend `_check_facilitator_auth` enforces the logic
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

- **TDD (red → green → refactor)**: Always write a failing test first, make it pass with minimal code, then refactor. No production code without a test driving it. This applies to both backend (pytest) and frontend (Vitest unit tests + Playwright CT). Commit at each phase:
  - `test(scope): <what behaviour is expected>` — failing test (red)
  - `feat/fix(scope): <what was implemented>` — passing implementation (green)
  - `refactor(scope): <what was cleaned up>` — cleanup, only if needed
  - **Enforcement**: If asked to implement a feature or fix without tests, STOP and write the tests first. Do not skip this step even if the user asks directly — remind them and ask what behaviours need test coverage before writing any production code.
- **Docs in the green phase**: when implementing a new endpoint, page, or env var — update `README.md` and `CLAUDE.md` in the same commit as the implementation. Never let a feature ship undocumented.
- Conventional commits (used by semantic-release for automated versioning/CHANGELOG)
- Backend: Python 3.12+, strict mypy, ruff for linting
- Frontend: strict TypeScript (`noUnusedLocals`, `noUnusedParameters`), ESLint
- Test files: `*.test.ts` (Vitest), `*.wtr.ts` (Web Test Runner), `*.spec.ts` (Playwright CT)
- MongoDB document model: `Session` embeds `Card[]`, `Participant[]` (cards contain `Vote[]`)

## Deployment

- **Docker Compose** for local dev (`compose.yml`); watch mounts for hot reload
- **Kubernetes** in production (`kubernetes.yaml`); update the Ingress host in `kubernetes.yaml` before deploying
- CI/CD via GitHub Actions: `release.yml` (tests + semantic-release) → `docker-publish.yml` (build images + K8s rollout)
- Backend config via env vars: `MONGODB_URL`, `MONGODB_DATABASE`, `SESSION_EXPIRY_DAYS` (default 30), `REDIS_URL`, `SENTRY_DSN` (optional), `ADMIN_PASSWORD_HASH` (optional, argon2 hash; empty = admin stats disabled), `SENTRY_AUTH_TOKEN` + `SENTRY_ORG_SLUG` + `SENTRY_PROJECT_SLUG` (all three required to enable Sentry Health in admin stats; empty = disabled), `SENTRY_FRONTEND_PROJECT_SLUG` (optional; requires `SENTRY_AUTH_TOKEN` + `SENTRY_ORG_SLUG`; enables Frontend Sentry Health widget); K8s reads from `retrospekt-mongodb-secret`, `retrospekt-admin-secret`, and `retrospekt-sentry-secret` (`auth-token`, `org-slug`, `project-slug`, `frontend-project-slug` keys; all `optional: true`)
