# Direction

Make data-access promises executable and repeatable for small web apps.

## Available today

- SQL permission contracts with legitimate-user controls and preserved evidence.
- Scoped Supabase file, row and GET retrieval-function checks.
- Regression fixtures for known leaks, outages and controls changing mid-check.

## Next, subject to validation

1. Reduce test-identity and fixture setup effort without requesting privileged production credentials.
2. Build a community fixture library: every example includes a leak, expected behavior, repair and unchanged-contract rerun.
3. Add membership and signed-link lifecycle checks with explicit semantics and positive controls.
4. Explore a coding-agent integration that proposes expectations for human review, then invokes deterministic checks. No agent certification claim.
5. Measure setup completion and repeat use on consenting builders' own staging projects before claiming a market advantage.

Existing SQL tests and native Supabase controls are a baseline. Boundary must earn its place through less setup, clearer evidence or easier maintenance. No benchmark superiority is established.

Graphify's public repository provides inspiration for a clear first-run workflow, concrete artifacts and community contributions: https://github.com/Graphify-Labs/graphify. No Graphify code is included and no affiliation is implied.

## Existing tools and the contribution opportunity

[Supabase database testing](https://supabase.com/docs/guides/database/testing) already supports pgTAP and client-side integration tests. [Promptfoo](https://www.promptfoo.dev/docs/red-team/rag/) covers broader RAG red teaming. Boundary is narrower: declared access expectations, paired controls and repair evidence. A coding assistant can write equivalent tests; our unproven opportunity is making them easier to configure, maintain and understand. Judge this through timed own-project trials, not stars.
