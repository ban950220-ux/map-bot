"""Run the repository's documented commands without a shell or operating keys."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REQUIRED = (
    "README.md", "ARCHITECTURE.md", "AGENTS.md", "AI_HANDOFF.md",
    "CONTRIBUTING.md", "DEPLOYMENT.md", ".env.example",
)


def contract() -> None:
    config = json.loads((ROOT / "development.json").read_text(encoding="utf-8"))
    for name in REQUIRED:
        if not (ROOT / name).is_file() or not (ROOT / name).read_text(encoding="utf-8").strip():
            raise RuntimeError("Missing handoff document: " + name)
    for name in (
        "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md",
        ".cursor/rules/project.mdc",
    ):
        if "AGENTS.md" not in (ROOT / name).read_text(encoding="utf-8"):
            raise RuntimeError("Tool adapter must refer to AGENTS.md: " + name)
    for task, commands in config["tasks"].items():
        if not isinstance(commands, list) or not commands:
            raise RuntimeError("Invalid command vector: " + task)
        for command in commands:
            if not isinstance(command, list) or not command:
                raise RuntimeError("Empty command: " + task)
            if any(not isinstance(arg, str) or not arg for arg in command):
                raise RuntimeError("Invalid command argument: " + task)
    source = json.loads((ROOT / "docs/source-provenance.json").read_text(encoding="utf-8"))
    if not source["github"]["source_sha"] or source["production"].get("source_sha") == "main":
        raise RuntimeError("Commit identities must be explicit")
    print("PASS: AI-neutral handoff and command contract")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("task", nargs="?", default="contract")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    config = json.loads((ROOT / "development.json").read_text(encoding="utf-8"))
    if args.list:
        print(json.dumps(config, ensure_ascii=False, indent=2))
        return 0
    if args.task == "contract":
        contract()
        return 0
    if args.task not in config["tasks"]:
        print("Unsupported task: " + args.task + "; use --list", file=sys.stderr)
        return 2
    for original in config["tasks"][args.task]:
        command = [sys.executable if arg == "{python}" else arg for arg in original]
        if args.dry_run:
            print(json.dumps(command))
            continue
        env = dict(os.environ)
        if args.task not in ("setup", "dev"):
            for key in list(env):
                if key.endswith(("_API_KEY", "_APP_KEY", "_APP_SECRET", "_BOT_TOKEN", "_PASSWORD")):
                    env.pop(key, None)
                if key in ("PORTFOLIO_SEED_GZIP_BASE64", "ANTHROPIC_API_KEY"):
                    env.pop(key, None)
        result = subprocess.run(command, cwd=ROOT, env=env, check=False)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
