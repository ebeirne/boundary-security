# Document privacy pilot

This experimental local runner checks one private text file and one document row or supported retrieval function using two real test-user sessions, plus anonymous requests to that file's public and authenticated URLs. It reads exact configured resources. It does not scan a website, alter policies, upload files or create users. Use a staging project you own, with invented records. The hosted website's demo remains the earlier database-rule workbench.

## Prepare once

1. Create two synthetic users through your app's normal sign-in flow. Record their user UUIDs. The first owns the test document; the second should not have access.
2. Through your existing upload flow, add a small text file containing a unique invented marker, such as `BOUNDARY_TEST_` followed by a random UUID. The file must be under 64 KB. Put the same marker in the document row you expect the AI retrieval layer to access.
3. Copy `examples/document-privacy.json` to your own configuration. Set the project origin, actual user UUIDs, bucket, object path, document table and record ID. The current adapter requires a public table with `id` and text `content` columns. For a reviewed retrieval function, add retrieval: {"mode":"rpc","functionName":"your_function","reviewedReadOnly":true}. It must accept document_id through GET and return an array of rows with text content. Other schemas and endpoint shapes are unsupported.
4. Set `authorized` to true after reviewing the exact scope, and keep `synthetic` true only when the test data is invented. Configuration contains fixture identifiers and the marker, not credentials; keep it local.
5. Supply `BOUNDARY_SUPABASE_PUBLIC_KEY`, `BOUNDARY_OWNER_TOKEN` and `BOUNDARY_OTHER_TOKEN` as process environment variables. Use the public/publishable project key and short-lived access tokens from the two test sessions. Never use service-role or secret keys. Do not send these values to us or commit them. Clear the variables when finished.

Run with Node 22 or later from the Boundary directory:

```text
node scripts/check-document-privacy.mjs --config privacy.json --out first-report.json
```

The configuration origin must be an exact `https://PROJECT.supabase.co` origin or a loopback `http://127.0.0.1:PORT` origin. Custom domains are not supported. Requests are bounded reads and do not follow redirects. Reports cannot overwrite an existing file.

## Read the result

- Passed: both sessions resolved correctly, the owner received the marker, and this specific other-customer file/retrieval check was denied or returned no rows.
- Failed: the other customer received the known private marker. Review the relevant file or document access policy, keep legitimate owner access, and rerun unchanged requirements after the repair.
- Incomplete: a positive control, session, response format or service could not be verified. Do not interpret this as secure. Check sign-in, fixture existence, table columns and service availability.

The process exits with 0 for all checks passed, 1 for an observed leak, and 2 for incomplete/configuration failures. Reports omit credentials, contents, user IDs and project origin. A requirements fingerprint identifies the configured inputs; timestamps distinguish runs. This is not a signed report or evidence of deployment version. Preserve the same config and fixture when comparing runs.

## Boundaries

The default document-row check verifies the exact REST row read. Optional RPC mode verifies one declared GET retrieval function, including whether its privileges expose the known marker to the other customer. Neither verifies semantic search or a generated chatbot answer. A pass does not cover previously issued signed links, cached answers, revoked memberships, other documents or anonymous document retrieval. The two anonymous file checks cover only the exact configured object's public and authenticated URLs.

This first runner still requires technical setup. Do not market it as one-click, SQL-free onboarding or complete SaaS security. The next usability gate is completing setup with nondeveloper founders and measuring assistance. No independent review or customer validation has been completed for this extension.

## Guided local console

In the current local workspace, open http://127.0.0.1:4387/#privacy after building and starting Boundary. File privacy guides the same scoped checks through Test file, Test accounts, and Review and run. This screen is not deployed on the public preview. It clears credentials after each attempt and discards inputs on leaving. Save setup without credentials and download reports before leaving. Reruns need fresh sessions; comparisons require matching requirements and adapter fingerprints.
