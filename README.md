# guardOps

Trust is a policy, not a prompt.

Local-first deterministic authorization for AI agents. Developer Preview; no external AI calls or telemetry.

## Quick start

Node.js 22+: `npm ci`, `npm test`, `npm run demo`.

`node src/cli.mjs examples/policy.json examples/request.json` evaluates a synthetic request. Exit codes: 0 allow, 2 deny, 3 require-review, 1 invalid file or invocation. CLI input is simulation only; it cannot authenticate users or authorize live execution.

The host must supply authenticated roles separately from model requests, control policy configuration and enforce decisions before any side effect. See [threat model](docs/security/threat-model.md).
