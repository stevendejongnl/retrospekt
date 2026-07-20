"""CI script — scan commit trailers for `Fixes-Feedback: <id>` and mark those feedback docs fixed.

Usage: uv run python scripts/mark_feedback_fixed.py <prev_tag_or_empty> <new_version>
Reads MONGO_PRODUCTION_USERNAME, MONGO_PRODUCTION_PASSWORD, MONGO_PRODUCTION_URL from env.
"""

import os
import re
import subprocess
import sys

from pymongo import MongoClient

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


def main() -> None:
    prev_tag = sys.argv[1] if len(sys.argv) > 1 else ""
    new_version = sys.argv[2]

    feedback_ids = find_feedback_ids(prev_tag)
    if not feedback_ids:
        print("No Fixes-Feedback trailers found, nothing to do.")
        return

    user = os.environ["MONGO_PRODUCTION_USERNAME"]
    pw = os.environ["MONGO_PRODUCTION_PASSWORD"]
    host = os.environ["MONGO_PRODUCTION_URL"]
    client = MongoClient(f"mongodb+srv://{user}:{pw}@{host}")
    col = client["retrospekt"]["feedback"]

    for fid in feedback_ids:
        result = col.update_one(
            {"id": fid}, {"$set": {"status": "fixed", "fixed_in_version": new_version}}
        )
        status = "updated" if result.matched_count else "NOT FOUND"
        print(f"{fid}: {status}")


if __name__ == "__main__":
    main()
