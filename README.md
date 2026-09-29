# Boundary

Repeatable access checks for PostgreSQL and Supabase apps.

**Can customer B read customer A's data? Can customer A still use it after the fix?** Boundary turns those expectations into executable checks and reports you can rerun.

Experimental open-source pilot. Not a full-app scanner, audit, security certification or replacement for independent review.

## Run locally

Requires Node.js 22 or later and npm. No account, AI API key or production database required for the synthetic demo.

```sh
git clone https://github.com/ebeirne/boundary-security.git
cd boundary-security
npm ci
npm run dev
```

Open http://127.0.0.1:4387. Create the guided demo, run the flawed policies (8 passed, 2 failed), review the repair, and rerun the unchanged requirements (10 passed). Stop with Ctrl+C.

## Two workflows

| Workflow | What it actually checks |
| --- | --- |
| SQL workbench | Reviewed schema, synthetic records and declared read/create/edit/delete permissions, executed in a fresh embedded PostgreSQL database |
| File privacy | One declared Supabase file and document row or supported GET retrieval function, using two test-user sessions and anonymous file requests |

The local console's **File privacy** tab guides setup. It requires an owned staging fixture and short-lived test sessions. It is not yet one-click onboarding. See [file privacy setup](docs/DOCUMENT-PRIVACY-QUICKSTART.md).

## CLI

```sh
node server/cli.mjs --demo --out before.json
node server/cli.mjs --demo --repaired --out after.json
node server/cli.mjs --project examples/project.json --out result.json
npm test
npm run release:check
```

The intentionally flawed demo exits 1. Exit 0 means declared checks passed; 1 means an observed failure; 2 means incomplete or invalid execution. Errors and missing controls never establish protection.

## Why this exists

A code review can propose a fix. Boundary is intended to preserve the expected access behavior and execute it again after changes. Reports separate observed leaks from incomplete checks, preserve legitimate-user controls, and fingerprint the inputs. Changing the requirements does not prove a repair.

We want community-contributed, reproducible permission regressions, especially for AI-built apps. We have not established superiority over existing SQL tests, Supabase tooling or security scanners. See the [roadmap](ROADMAP.md).

## Limits and data handling

Use trusted, reviewed SQL and invented data only. The SQL worker is **not a sandbox for hostile SQL**. Local workbench inputs are stored unencrypted in .boundary. The file-privacy runner contacts the configured Supabase origin, holds test credentials in memory, and omits them and document content from reports. Sequential controls are not an atomic snapshot.

No coverage claim for model answers, semantic retrieval, signed links, membership revocation, arbitrary API routes, dependencies, legal compliance or the entire app. No independent certification or customer validation is implied by passing tests.

[Verification](VERIFICATION.md) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [Recovery](docs/RECOVERY.md)

## License

MIT for Boundary's original source. Dependencies retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md). The separate marketing site's artwork and private development records are not distributed here.
