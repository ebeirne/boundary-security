// Operator declarations only: these hashes do not attest to the running deployment.
export function validatePrivacyContext(context) {
  if (context === undefined) return null;
  if (!context || typeof context !== 'object' || Array.isArray(context) ||
      context.version !== 1 || context.provenance !== 'operator-declared' ||
      typeof context.applicationRevision !== 'string' ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(context.applicationRevision) ||
      typeof context.fixtureHash !== 'string' || !/^[a-f0-9]{64}$/.test(context.fixtureHash) ||
      Object.keys(context).some(key => !['version', 'provenance', 'applicationRevision', 'fixtureHash'].includes(key))) {
    throw new Error('Use a full lowercase revision hash and SHA-256 fixture hash together.');
  }
  return {version: 1, provenance: 'operator-declared', applicationRevision: context.applicationRevision, fixtureHash: context.fixtureHash};
}

export function privacyContextFromOptions(options) {
  const applicationRevision = options['--app-revision'];
  const fixtureHash = options['--fixture-hash'];
  if (applicationRevision === undefined && fixtureHash === undefined) return null;
  return validatePrivacyContext({version: 1, provenance: 'operator-declared', applicationRevision, fixtureHash});
}
