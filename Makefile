.PHONY: install start stop logs ps restart test lint typecheck help

## Install all dependencies locally
install:
	cd backend && uv sync
	cd frontend && npm install

## Start all services with Docker Compose (detached)
start:
	docker compose up --build -d

## Stop all services
stop:
	docker compose down

## View live logs from all services
logs:
	docker compose logs -f

## Show running service status
ps:
	docker compose ps

## Restart all services
restart:
	docker compose restart

## Run backend tests
test:
	cd backend && uv run pytest

## Lint backend (ruff)
lint:
	cd backend && uv run ruff check .

## Type-check frontend (tsc)
typecheck:
	cd frontend && npm run typecheck

## Show this help
help:
	@echo ""
	@echo "  Retrospekt — self-hosted retro board 🥓"
	@echo ""
	@echo "  make start        Start MongoDB + backend + frontend"
	@echo "  make stop         Stop all services"
	@echo "  make logs         Stream logs"
	@echo "  make ps           Show service status"
	@echo "  make restart      Restart all services"
	@echo "  make install      Install deps (uv + npm)"
	@echo "  make test         Run backend pytest"
	@echo "  make lint         Run ruff linter"
	@echo "  make typecheck    Run tsc type check"
	@echo ""
