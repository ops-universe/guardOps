# Engineering acceptance

Browser acceptance uses the pinned shared ops-ui test harness at 0fe0ecddb374d64badcafe897fef85f6a0eacf78 and its existing package-manager-generated lockfile, in an isolated temporary directory. The guardOps CI job builds the actual project-base production bundle and runs Chromium against a local preview. Checks: allow/deny/review, stale evidence, malformed policy, extra arguments, synthetic approval transitions, keyboard focus, WCAG-tagged axe scan scoped to the workbench, mobile overflow and external network requests during simulation. These checks do not establish complete WCAG conformance or cross-browser compatibility. CI evidence is pending.

Local storage uses authenticated snapshots and exclusive locks; tests exercise reviewer revocation, immutable configuration, lock failure and replay. No rollback-proof or distributed guarantee. Crash-stale lock recovery requires trusted administrative investigation. Public release is deferred.
