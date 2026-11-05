# Deployment and recovery

Development source, operating source and state are different version boundaries. See `docs/source-provenance.json`.

- GitHub source baseline: `f3264382d0ef8cf5be2759b1f16bccc3aabff1eb`. Recovery ref: `checkpoint/ai-source-20261105`.
- Inspected Sites version: `24`; saved version ID `appgprj_6aa13e471abc819193188a4999e314f6~appgver_e323f67465dc8191a3fa27e63f2fde2a`; source SHA `5431a5778ad698d8cdb6d709a5c717419b3a8e1a`. `None` means unverified/not a Sites project, not a match.
- Existing CI performs checks/builds; no deploy, merge, operating migration, scheduled send or secret writes are added by this task. Third-party hosting hooks were not exhaustively observable.
- Before an approved release: confirm exact source SHA, green final-head checks, current schema compatibility, owner isolation, backup and target bindings. Save the release SHA and returned operating version/deployment IDs together.
- Recover code via a reviewed revert PR or the preserved checkpoint in a new branch. For Sites rollback, choose the exact previously deployed saved version; do not infer version IDs from commit SHAs. Obtain separate deployment approval.
- Data rollback is separate. Never restore over production merely to test a backup. Use a new empty isolated target and verify schema, row counts, row hashes, Decimal strings, owner identity and model assumptions first.
- Do not copy production environment values into tests. Configure names from `.env.example` with synthetic values; live credentials require explicit authorization.

Account Bot: cron/cutover/claim/outbox/UNKNOWN no-resend invariants remain intact. PORTFLOW: leave the current Daily Buy schedule running unchanged; independent target has no scheduler until an approved cutover avoids duplicate accrual. MAP: a GitHub merge does not publish Sites.
