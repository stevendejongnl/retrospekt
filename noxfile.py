"""Nox automation — replaces the Makefile for all quality/test tasks.

Usage (from the project root):
    uv run --project backend nox -l              # list available sessions
    uv run --project backend nox -s test         # run backend tests
    uv run --project backend nox -s check        # run all checks
    uv run --project backend nox                 # default: check

Sessions that don't match your current change set can be skipped:
    uv run --project backend nox -s lint mypy typecheck
"""

import nox

# Never let nox create its own virtual environments — we manage them with uv/npm.
nox.options.default_venv_backend = "none"
nox.options.sessions = ["check"]

BACKEND = "backend"
FRONTEND = "frontend"


# ── Backend ───────────────────────────────────────────────────────────────────


@nox.session
def test(session: nox.Session) -> None:
    """Run backend unit + integration tests."""
    with session.chdir(BACKEND):
        session.run("uv", "run", "pytest", external=True)


@nox.session
def coverage(session: nox.Session) -> None:
    """Run backend tests with branch coverage report (opens htmlcov/index.html)."""
    with session.chdir(BACKEND):
        session.run(
            "uv", "run", "pytest",
            "--cov=src",
            "--cov-report=term-missing",
            "--cov-report=html",
            external=True,
        )


@nox.session
def lint(session: nox.Session) -> None:
    """Lint backend source with ruff."""
    with session.chdir(BACKEND):
        session.run("uv", "run", "ruff", "check", ".", external=True)


@nox.session
def lint_fix(session: nox.Session) -> None:
    """Auto-fix ruff lint errors."""
    with session.chdir(BACKEND):
        session.run("uv", "run", "ruff", "check", "--fix", ".", external=True)


@nox.session
def mypy(session: nox.Session) -> None:
    """Type-check backend with mypy."""
    with session.chdir(BACKEND):
        session.run("uv", "run", "mypy", "src", external=True)


# ── Frontend ──────────────────────────────────────────────────────────────────


@nox.session
def lint_frontend(session: nox.Session) -> None:
    """Lint frontend TypeScript with ESLint."""
    with session.chdir(FRONTEND):
        session.run("npm", "run", "lint", external=True)


@nox.session
def typecheck(session: nox.Session) -> None:
    """Type-check frontend with tsc."""
    with session.chdir(FRONTEND):
        session.run("npm", "run", "typecheck", external=True)


@nox.session
def test_frontend(session: nox.Session) -> None:
    """Run frontend Vitest unit tests."""
    with session.chdir(FRONTEND):
        session.run("npm", "test", external=True)


@nox.session
def test_ct(session: nox.Session) -> None:
    """Run frontend Playwright component tests (starts its own Vite server)."""
    with session.chdir(FRONTEND):
        session.run("npm", "run", "test:ct", external=True)


@nox.session
def test_wtr(session: nox.Session) -> None:
    """Run frontend Web Test Runner tests."""
    with session.chdir(FRONTEND):
        session.run("npm", "run", "test:wtr", external=True)


@nox.session
def coverage_frontend(session: nox.Session) -> None:
    """Run frontend Vitest with coverage report."""
    with session.chdir(FRONTEND):
        session.run("npm", "run", "test:coverage", external=True)


# ── E2E ───────────────────────────────────────────────────────────────────────


@nox.session
def e2e(session: nox.Session) -> None:
    """Run Playwright E2E tests (requires MongoDB — run `make start` first locally)."""
    session.run("npx", "playwright", "test", external=True)


@nox.session
def e2e_ui(session: nox.Session) -> None:
    """Open Playwright UI mode for interactive debugging."""
    session.run("npx", "playwright", "test", "--ui", external=True)


# ── Aggregate ─────────────────────────────────────────────────────────────────


@nox.session
def check(session: nox.Session) -> None:
    """Run all checks and tests except E2E (default session).

    E2E tests are excluded because they require a running MongoDB instance.
    Run `nox -s e2e` separately after `make start`.
    """
    # Backend
    with session.chdir(BACKEND):
        session.run("uv", "run", "ruff", "check", ".", external=True)
        session.run("uv", "run", "mypy", "src", external=True)
        session.run("uv", "run", "pytest", external=True)
    # Frontend
    with session.chdir(FRONTEND):
        session.run("npm", "run", "lint", external=True)
        session.run("npm", "run", "typecheck", external=True)
        session.run("npm", "test", external=True)
        session.run("npm", "run", "test:ct", external=True)
        session.run("npm", "run", "test:wtr", external=True)
