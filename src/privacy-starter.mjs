export function buildPrivacySetupRequest({stack,environment,marker}){
 if(stack!=='supabase'||environment!=='test')throw Error('A confirmed Supabase test copy is required.');
 if(!/^BOUNDARY_TEST_[a-zA-Z0-9-]{16,80}$/.test(marker))throw Error('Use a generated synthetic marker.');
 return `Help me prepare a Boundary customer-privacy check for my app.

Goal: customer A can read their own invented private document and file; customer B and visitors cannot. Check the existing app's access rules, not a new unrelated sample app.

Before changing anything, identify the separate test project and show me your setup plan. Do not use production, real customer accounts or real documents. If no separate test project exists, stop and explain how to create one. Do not change access policies to make the test pass, disable security, or expose a bucket.

In the confirmed test project, prepare two ordinary test customers from different organizations, using the app's actual membership structure. Create one small invented text file and its document record owned by customer A. Put this exact text in both:
${marker}

Boundary currently supports Supabase Storage and either a document row with id/content columns or a reviewed read-only GET function accepting document_id and returning an array of rows with content. If the app does not fit, explain the mismatch and stop; do not invent a compatible result or redesign the app merely for the test. Review the relevant policies and explain the expected access before execution.

Give me a downloadable boundary-privacy-setup.json with actual test-project values and this shape:
{
  "version": 1, "authorized": false, "synthetic": true,
  "origin": "https://TEST-PROJECT.supabase.co",
  "ownerId": "CUSTOMER-A-UUID", "otherId": "CUSTOMER-B-UUID",
  "bucket": "ACTUAL-TEST-BUCKET", "object": "ACTUAL-TEST-FILE-PATH",
  "table": "ACTUAL-DOCUMENT-TABLE", "recordId": "ACTUAL-RECORD-ID",
  "marker": "${marker}", "retrieval": {"mode":"row"}
}
For a supported function, use retrieval: {"mode":"rpc","functionName":"ACTUAL_FUNCTION","reviewedReadOnly":false}; explain the read-only review separately. Do not mark my authorization or review confirmations for me.

Do not put passwords, access tokens, service keys or customer data in the setup file or this chat. Show me how to obtain fresh sessions for the two test accounts locally and enter them directly into Boundary on my computer. Never use a service-role or secret key for these checks.

Explain what was prepared, what is not covered, and how to remove only the invented fixtures later. After a repair, keep the same test configuration, identities and marker so I can rerun the same checks. This setup request is not itself a security test or proof that my app is safe.`;
}
