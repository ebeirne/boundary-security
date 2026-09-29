# Verification boundaries

This public source snapshot derives from the tested private implementation. Private campaign data, development history, historical evidence and marketing artwork were excluded.

Run npm test and npm run release:check to reproduce local checks. The manual validation workflow creates disposable native PostgreSQL and Supabase services on a hosted runner, tests deliberate leaks and repairs, then removes them. It does not connect to a customer's deployment.

The changing-state HTTP suite reproduces deleted fixtures, revoked sessions, expired sessions, outages, malformed responses, oversized bodies and redirects. Adapter v3 rechecks controls before accepting denials. Sequential checks remain unable to establish an atomic snapshot.

Test success is not independent review, certification, customer demand or proof of whole-app protection.

Clean Windows source validation on 2026-09-29: 104 tests passed; build and imported-project detection, repair, export, restart and byte-for-byte backup recovery passed. Runtime Node v22.14.0. This count describes the clean public source, not the larger private working tree.
