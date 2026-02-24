# Quality checks, tests, and linting are managed by nox (noxfile.py).
# Run `uv run --project backend nox -l` to list available sessions.
# This Makefile only handles Docker/infrastructure tasks.

.PHONY: install hooks start stop logs ps restart help

## Install all project dependencies and git hooks
install: hooks
	cd backend && uv sync
	cd frontend && npm install
	npm install
	npx playwright install chromium --with-deps

## Install git hooks (delegators that call hooks/ scripts tracked in the repo)
hooks:
	printf '#!/usr/bin/env bash\nexec "$$(git rev-parse --show-toplevel)/hooks/pre-commit"\n' > .git/hooks/pre-commit
	printf '#!/usr/bin/env bash\nexec "$$(git rev-parse --show-toplevel)/hooks/pre-push"\n'   > .git/hooks/pre-push
	chmod +x .git/hooks/pre-commit .git/hooks/pre-push
	@echo "✅ Git hooks installed"

## Start MongoDB + backend + frontend via Docker Compose
start:
	docker compose up --build -d

## Stop all services
stop:
	docker compose down

## Stream live logs from all services
logs:
	docker compose logs -f

## Show running service status
ps:
	docker compose ps

## Restart all services
restart:
	docker compose restart

## Show this help
help:
	@echo ""
	@echo "  Retrospekt — self-hosted retro board 🥓"
	@echo ""
	@echo "  Infrastructure (this Makefile):"
	@echo "    make start     Start MongoDB + backend + frontend"
	@echo "    make stop      Stop all services"
	@echo "    make logs      Stream logs"
	@echo "    make install   Install all deps"
	@echo ""
	@echo "  Quality checks (nox — run from project root):"
	@echo "    nox -s test          Backend unit + integration tests"
	@echo "    nox -s coverage      Tests with HTML coverage report"
	@echo "    nox -s lint          Ruff linter (backend)"
	@echo "    nox -s mypy          Mypy type checker (backend)"
	@echo "    nox -s lint_frontend ESLint (frontend)"
	@echo "    nox -s typecheck     tsc type checker (frontend)"
	@echo "    nox -s e2e           Playwright E2E tests"
	@echo "    nox                  Run all checks (default)"
	@echo ""
