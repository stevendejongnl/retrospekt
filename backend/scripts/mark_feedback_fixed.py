"""CI script — scan commit trailers for `Fixes-Feedback: <id>` and mark those feedback docs fixed.

Usage: uv run python scripts/mark_feedback_fixed.py <prev_tag_or_empty> <new_version>
Reads RETROSPEKT_API_URL and RETROSPEKT_ADMIN_PASSWORD from env.

Goes through the live admin API (POST /api/v1/stats/auth -> PATCH
/api/v1/feedback/{id}) rather than connecting to MongoDB directly —
GitHub-hosted runners don't have a stable IP to allowlist on the Atlas
side (confirmed twice in a row by a TLSV1_ALERT_INTERNAL_ERROR connecting
straight from CI). The backend itself already has a working connection
to prod Mongo, so this reuses that instead of fighting Atlas network
access from an ephemeral runner IP.
"""

import os
import re
import subprocess
import sys

import httpx

TRAILER_RE = re.compile(r"^Fixes-Feedback:\s*(\S+)\s*$", re.MULTILINE)


def find_feedback_ids(prev_tag: str) -> list[str]:
    commit_range = f"{prev_tag}..HEAD" if prev_tag else "HEAD"
    log = subprocess.run(
        ["git", "log", commit_range, "--pretty=format:%B%x00"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    ids = []
    for commit_msg in log.split("\x00"):
        ids.extend(TRAILER_RE.findall(commit_msg))
    return ids


def mark_fixed(base_url: str, password: str, feedback_ids: list[str], new_version: str) -> None:
    with httpx.Client(base_url=base_url, timeout=15.0) as client:
        auth_response = client.post("/api/v1/stats/auth", json={"password": password})
        auth_response.raise_for_status()
        token = auth_response.json()["token"]

        for fid in feedback_ids:
            response = client.patch(
                f"/api/v1/feedback/{fid}",
                json={"status": "fixed", "fixed_in_version": new_version},
                headers={"X-Admin-Token": token},
            )
            status = "updated" if response.status_code == 200 else f"FAILED ({response.status_code})"
            print(f"{fid}: {status}")


def main() -> None:
    prev_tag = sys.argv[1] if len(sys.argv) > 1 else ""
    new_version = sys.argv[2]

    feedback_ids = find_feedback_ids(prev_tag)
    if not feedback_ids:
        print("No Fixes-Feedback trailers found, nothing to do.")
        return

    mark_fixed(
        base_url=os.environ["RETROSPEKT_API_URL"],
        password=os.environ["RETROSPEKT_ADMIN_PASSWORD"],
        feedback_ids=feedback_ids,
        new_version=new_version,
    )


if __name__ == "__main__":
    main()
