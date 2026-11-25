# Dashboard

The workbench imports the actual shared policy and argument validation modules. Policy and role inputs are synthetic and untrusted; no real tool execution or identity authentication occurs. The permission matrix is policy-only and bounded to 30 roles and 30 tools. The approval queue is a local UI state demonstration, not a production reviewer interface or the server ledger. Changing inputs invalidates displayed evidence. No network calls or persistence are added by the workbench. Browser-compatible UTF-8 measurement uses TextEncoder.
