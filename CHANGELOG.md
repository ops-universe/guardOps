# Changelog

## Unreleased

- Record merged PR #8 engineering acceptance: 60 core tests, four Chromium scenarios including scoped axe checks, and dependency audits passed in run 45522171890. Main verification tracked separately.

- Align Vite preview base with production build; verify served JavaScript MIME and retain browser startup diagnostics without relaxing acceptance assertions.

- Recheck reviewer authorization at consumption; isolate persistent configuration and test lock failure paths.
- PR #7 merged after corrected CI: 56 tests passed, core audit clean.

- Correct missing return in durable approval consumption; retain all security tests.

- Add authenticated local snapshots, persistent approval consumption and durable audit; bind gateway to approval revision.
- Trusted enterprise execution gateway (PR #6).
- Functional browser workbench (PR #5).
- Audit evidence and regression simulation CLI (PR #4).
- Scope-bound approvals (PR #3).
- Bounded guardrails (PR #2).
- Foundation, policy engine and CLI (PR #1).
