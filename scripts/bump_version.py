"""CI script — bump the version across every file semantic-release needs to touch.

Usage: python3 scripts/bump_version.py <version>
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent


def bump_npm_package(version: str, cwd: Path) -> None:
    subprocess.run(["npm", "version", version, "--no-git-tag-version"], cwd=cwd, check=True)


def bump_pyproject(version: str) -> None:
    path = ROOT / "backend" / "pyproject.toml"
    text = path.read_text()
    updated = re.sub(r'^version = ".*"', f'version = "{version}"', text, count=1, flags=re.MULTILINE)
    path.write_text(updated)


def sync_uv_lock() -> None:
    subprocess.run(["uv", "sync"], cwd=ROOT / "backend", check=True)


def bump_k8s_manifest(version: str) -> None:
    path = ROOT / "kubernetes.yaml"
    text = path.read_text()
    updated = re.sub(
        r"(ghcr\.io/stevendejongnl/retrospekt-(?:backend|frontend)):[^\s\"']+",
        rf"\1:{version}",
        text,
    )
    path.write_text(updated)


def main() -> None:
    version = sys.argv[1]
    bump_npm_package(version, cwd=ROOT)
    bump_npm_package(version, cwd=ROOT / "frontend")
    bump_pyproject(version)
    sync_uv_lock()
    bump_k8s_manifest(version)


if __name__ == "__main__":
    main()
