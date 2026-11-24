# Guardrails

`validatePayload(value,schema)` implements a deliberately small closed schema dialect, not full JSON Schema. Objects require explicit properties and required keys; unknown properties are rejected. Arrays require items. Supported constraints include lengths, numeric bounds and primitive enums. Inputs must be plain JSON data, not arbitrary JavaScript objects/proxies. Limits: 64 KiB, 12 nesting levels and 4096 visited nodes.

`inspectText(text,config)` emits configurable signal IDs only. Email, credential-like, card-like and instruction-risk patterns can miss threats and flag benign text; do not treat them as proof of safety, identity, or authorization. `valid` means inspection could run, not that content is safe. Host applications must decide whether signals require blocking or escalation. No raw matched text is returned.

`evaluateGuardedTool(policy,principal,request,schemas,evaluate)` validates arguments then invokes a trusted policy evaluator. The host must pin the evaluator, schemas and policy, authenticate roles, enforce decisions and bind validation to the executed payload. No model can approve an action. This module does not execute tools.
