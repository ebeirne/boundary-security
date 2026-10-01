# Non-developer setup

Primary audience: people who built a customer-facing app with AI and need help checking customer privacy.

Pitch: Built your app with AI? Check that one customer cannot see another's private data. Find an access problem, test the fix, and keep the results.

The local File privacy entry now asks two questions before displaying technical fields. Unknown backend or missing test environment leads to a builder clarification request. Confirmed Supabase test projects get a copyable/downloadable builder request carrying the generated synthetic marker and the supported configuration shape. The request preserves existing policies, requires invented fixtures and keeps credentials out of the handoff. The user then imports the builder-prepared setup and supplies fresh test sessions locally.

Current limit: this is assisted preparation, not automatic provisioning or a one-click connection. The AI builder's output still needs review and the app must fit the supported data shape. No new security coverage is implied.

Validation: two handoff-generation tests passed; four repair-comparison tests passed alongside them; production build passed. Browser checks confirmed unknown/supported states, copy success and transition into existing setup. These checks do not prove that a novice can complete setup unaided. Next acceptance evidence should be one new non-developer preparing and rerunning a synthetic check with their own builder.

The changes are local and mirrored into the clean open-source checkout. They have not been pushed or deployed in this turn.
