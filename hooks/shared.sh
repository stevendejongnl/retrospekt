#!/usr/bin/env bash
# Shared hook logic — sourced by hooks/pre-commit and hooks/pre-push.
# Do not run directly.

ROOT="$(git rev-parse --show-toplevel)"

# ── Backend ───────────────────────────────────────────────────────────────────
run_backend() {
  cd "$ROOT/backend"
  uv run ruff check . && \
  uv run mypy src && \
  uv run pytest -q --tb=short --cov --cov-report=term-missing
}

# ── Parallel runner ───────────────────────────────────────────────────────────
# Runs run_backend() and run_frontend() (defined by the sourcing hook) in
# parallel. Exits 1 if either fails; $1 is the action word for the message.
run_parallel() {
  local blocked_msg="$1"

  run_backend &
  local BACKEND_PID=$!

  run_frontend &
  local FRONTEND_PID=$!

  local BACKEND_EXIT=0
  local FRONTEND_EXIT=0

  wait "$BACKEND_PID"  || BACKEND_EXIT=$?
  wait "$FRONTEND_PID" || FRONTEND_EXIT=$?

  [[ $BACKEND_EXIT  -ne 0 ]] && echo "❌ Backend checks failed (lint / mypy / pytest)"
  [[ $FRONTEND_EXIT -ne 0 ]] && echo "❌ Frontend checks failed"

  if [[ $BACKEND_EXIT -ne 0 ]] || [[ $FRONTEND_EXIT -ne 0 ]]; then
    echo "$blocked_msg. Fix the issues above and retry."
    exit 1
  fi
}
