# Boundary 0.12.0-beta.1

A local workbench for checking PostgreSQL row-access expectations against reviewed SQL and synthetic data. This is a private beta candidate for technically capable testers, not a security certification or hosted multi-user service.

## Install and try

1. Install Node.js 22 or later with npm. Download the source ZIP, SHA256SUMS and release-manifest.json from the same release. Check the ZIP's SHA-256 against both files before extracting.
2. Extract the ZIP into a new folder. Do not overwrite an existing Boundary workspace during an upgrade.
3. On Windows, open Start-Boundary.cmd. On Linux, open a terminal in the extracted boundary folder and run npm ci followed by npm run dev.
4. Open http://127.0.0.1:4387. Use Try the guided demo, run its checks, review the two failures, apply its reviewed repair, and run again. Expected result: 8 passes / 2 failures before, 10 passes / 0 failures after.
5. Compare the runs, save evidence and make a workspace backup. Keep backups outside the app folder. See RECOVERY.md before upgrading.

The first start requires internet access to install locked npm dependencies. Docker and a Supabase account are not required to use Boundary. Stop the app with Ctrl+C. Local inputs are plaintext; use synthetic records and trusted SQL only.

## Scope and reporting

The app evaluates the supplied contract inside embedded PostgreSQL. The separate integration harness has matched 24 real Supabase Auth/REST observations on a disposable hosted runner. That does not mean Boundary scans your live application, verifies real customer logins, or finds every vulnerability.

Report a problem privately through the repository issue tracker. Include the release version, operating system, expected result and minimal synthetic reproduction. Never include credentials, real customer data, local workspace backups or raw Supabase setup logs.

Independent security review and customer pilot validation remain outstanding. The historical embedded-engine startup crash has a bounded recovery path but no established root cause. Any recovered or incomplete startup blocks the release checks. macOS installation has not been verified.

## Release verification

The release-candidate workflow packages the committed source once, verifies the same archive checksum on clean Windows and Linux runners, installs its locked dependencies, and runs the full release journey plus three original/repaired startup pairs. See the release's attached verification reports for the actual result. A workflow definition alone is not a passing test.

The manifest records the source commit and SHA-256. This provides traceability and accidental-corruption detection, not publisher code signing or an independent attestation. Use the private repository as the release source.
