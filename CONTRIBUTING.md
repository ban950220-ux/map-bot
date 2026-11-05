# Contributing

`AGENTS.md` is normative. Read the handoff and source provenance before opening a task.

1. Fetch and inspect the current default/development refs and open PRs. Start from the verified source, not blindly from `main`.
2. Create `ai/<tool>/<task>`; each AI gets its own branch. Commit a small coherent change, preserving unrelated work.
3. Run `python scripts/dev.py contract`, relevant tasks from `--list`, and `git diff --check`. Record commands, exit codes, environment and omitted checks.
4. Open a PR against the handoff's PR base. Include exact base/head SHAs, changed files, regression evidence and operating impact.
5. Review conflicts against the latest remote head. Resolve on the work branch without force-pushing over another AI. Re-run affected checks after conflict resolution.
6. User approval precedes merge into default; deployment is a separate approval and source/version record. No auto-merge or deployment trigger is added here.

If an error is merged, create a new revert branch and PR. Do not reset a shared branch or assume a code revert restores data. Branch protections need server support/admin configuration; PR conventions alone cannot prevent a privileged direct write.

Install the repository-local direct-push guard with `python scripts/dev.py install-hooks`. It blocks Git pushes to main/master and does not affect PR merges. This client hook can be skipped by another client/API; it is not a replacement for unavailable private-repository server protection.
