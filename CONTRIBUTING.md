# Contributing

Start with a minimal synthetic failing example. Describe the expected allow and deny behavior, observed result, runtime and exact revision. Pair a denied action with a legitimate-user control. Never submit credentials, real customer data or unauthorized targets.

Run npm ci, npm test and npm run build. For full local workflow validation run npm run release:check. Disposable Supabase and native PostgreSQL validation is available through the manual validation workflow.

Useful contributions: false-pass regressions, clearer incomplete results, fixture setup improvements, and narrowly documented adapters. Explain scope and unsupported cases. Add a regression that fails before a behavioral fix and passes afterward.

Small pull requests are easiest to review. Open an issue before a large adapter or architectural change. Contributions are licensed under the repository's MIT license. Be respectful, specific and constructive. Report vulnerabilities privately as described in SECURITY.md.
