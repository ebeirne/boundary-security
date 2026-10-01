# Run the document privacy check in your release workflow

The example in `examples/privacy-ci.yml` runs the same eight document/file checks as the local console. It is an inactive template for an application repository, not a deployed integration. It does not create an environment, prepare test users, refresh their sessions, or deploy the application.

## Prepare once

1. Use an owned staging project with invented accounts, document and file. Follow `DOCUMENT-PRIVACY-QUICKSTART.md`. Confirm the two customers represent different intended access groups.
2. Place a reviewed, versioned Boundary source snapshot in `tools/boundary` inside the application repository. Keep its notices and record its archive checksum in your release notes. This check uses Node built-ins; it does not need a frontend build or dependency installation.
3. Save the reviewed nonsecret setup as `.boundary/privacy.json`. Set `authorized: true` only after reviewing that exact target and scope. A private repository is appropriate: the setup contains project/fixture identifiers even though it contains no credentials.
4. Configure the `boundary-staging` GitHub environment and its three named secrets from the example. Use only the public project key and fresh ordinary test-user access tokens. Never a service-role key. Restrict the environment to reviewed branches; a changed workflow can read its secrets.
5. Copy the example to `.github/workflows/privacy.yml`. Dispatch it from a reviewed branch after staging is ready. No configuration or credential value belongs in workflow inputs or log output.

## Interpret the gate

| Process exit | Meaning | Release action |
| --- | --- | --- |
| 0 | All eight scoped checks passed | Continue your other release checks; whole-app security is not established. |
| 1 | At least one observed disclosure | Hold the release, inspect the finding, repair and rerun unchanged expectations. |
| 2 | Setup, session, transport or another required check is incomplete | Hold the release; restore the missing prerequisite and rerun. |

The workflow keeps the CLI's exit code. It does not use `continue-on-error` or turn unavailable checks green. Its final step retains only the sanitized report, when one exists. A configuration failure can produce no report; inspect the generic failure message and local setup. The template retains artifacts for seven days; download evidence you actually need before expiration.

## Repeat safely

Access tokens expire. Refresh the two ordinary test sessions through your application's supported test sign-in before each run. This manual-secret template is useful for an initial release check; unattended per-release automation still needs a reviewed session-provisioning step. Do not solve expiration by using privileged credentials or extending user sessions indefinitely.

After fixing a policy, keep identities, marker, resources and expectations unchanged. Compare saved reports using `scripts/compare-document-privacy.mjs`. An earlier incomplete run cannot prove a repair. Changed fixtures cannot establish a same-fixture repair.

The CLI also accepts paired `--app-revision` and `--fixture-hash` values (see `--help`). Supply a revision only when your release process knows what is deployed: the checkout revision alone is not deployment proof. These fields remain operator declarations. The example deliberately does not invent this link.

## Verification scope

The existing local CLI tests exercise success, failure and incomplete exit behavior. This template has not been executed in a customer's GitHub repository and is not evidence of a working customer integration. It starts manually so a new user can establish the fixture and session lifecycle before wiring it to their own successful staging deployment event.
