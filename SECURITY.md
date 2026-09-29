# Security

This is experimental software. No supported production release or response-time guarantee is offered yet.

Report suspected vulnerabilities privately through GitHub's Report a vulnerability control, or email beirnewebsites@gmail.com with subject "Boundary security report". Include a minimal invented fixture, affected revision and expected versus observed behavior. Do not send secrets or customer data. Do not publish exploit details affecting a third-party service.

Only test systems you own or have explicit permission to assess. The repository's fixtures and disposable CI environments are intended targets. There is no bounty or authorization to test unrelated deployments.

Never expose the local server publicly. Reviewed SQL is required; its worker is not a security sandbox. Do not commit .boundary, environment files, access tokens or reports from customer projects.
