#!/usr/bin/env bash
# Shared hook logic — sourced by hooks/pre-commit and hooks/pre-push.
# Do not run directly.

ROOT="$(git rev-parse --show-toplevel)"

# ANSI colours (used in results summary)
_RED='\033[0;31m'
_GRN='\033[0;32m'
_RST='\033[0m'

# run_parallel <blocked_msg> [label fn] [label fn] ...
#
# Runs every fn in parallel in its own subshell; stdout/stderr captured.
# Shows a braille spinner for each running job; replaces it with · when done.
# On completion prints ✓ / ✗ per job and dumps captured output only on failure.
run_parallel() {
  local blocked_msg="$1"; shift

  local -a names=() fns=() pids=() logs=() exits=()
  while [[ $# -ge 2 ]]; do
    names+=("$1"); fns+=("$2"); shift 2
  done

  local n=${#names[@]}
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

  # Launch all jobs
  for ((i=0; i<n; i++)); do
    logs+=("$(mktemp)")
    exits+=(0)
    "${fns[$i]}" >"${logs[$i]}" 2>&1 &
    pids+=($!)
  done

  # Spinner loop — overwrites the same line until all jobs finish
  local frame=0
  while true; do
    local any_running=false line=""
    for ((i=0; i<n; i++)); do
      if kill -0 "${pids[$i]}" 2>/dev/null; then
        any_running=true
        line+="  ${frames[$((frame % 10))]} ${names[$i]}"
      else
        line+="  · ${names[$i]}"
      fi
    done
    printf "\r%s" "$line"
    [[ "$any_running" == false ]] && break
    sleep 0.1
    ((frame++)) || true
  done
  printf "\r\033[K"   # clear spinner line

  # Collect results and print summary
  local any_failed=false
  for ((i=0; i<n; i++)); do
    wait "${pids[$i]}" || exits[$i]=$?
    if [[ ${exits[$i]} -eq 0 ]]; then
      printf "  ${_GRN}✓${_RST} %s\n" "${names[$i]}"
    else
      printf "  ${_RED}✗${_RST} %s\n" "${names[$i]}"
      printf "── output ──────────────────────────────────\n"
      cat "${logs[$i]}"
      printf "────────────────────────────────────────────\n"
      any_failed=true
    fi
    rm -f "${logs[$i]}"
  done

  if [[ "$any_failed" == true ]]; then
    printf "\n%s. Fix the issues above and retry.\n" "$blocked_msg"
    exit 1
  fi
}
