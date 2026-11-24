# Audit and simulation

The simulation CLI evaluates synthetic cases without execution, approvals or external calls. It records expected/actual decisions, reason, risk and rule IDs, excluding arguments and principal identifiers. Case and rule IDs must be non-sensitive trusted labels. Report comparison flags changed decisions, expectation changes, removals and failing cases. Fingerprints identify the serialized policy and schema configuration; they are not signatures.

The bounded in-memory audit buffer records decisions and reason codes with a SHA-256 hash chain. It rejects writes when full; host integrations must handle errors before side effects. This is tamper-evident against accidental edits, not an authenticated or durable audit store; an attacker able to rewrite the entire chain can recompute it, and tail truncation requires an external checkpoint to detect. Only trusted evaluator reason codes should be passed. No production audit compliance claim.

Run `node src/simulation-cli.mjs simulate examples/simulation/policy.json examples/simulation/schemas.json examples/simulation/cases.json`. Save reports via shell redirection; compare with `node src/simulation-cli.mjs compare baseline.json current.json`. Exit 0 pass, 2 regression/failure, 1 invalid input. Local trusted regular files only, 64 KiB limit.
