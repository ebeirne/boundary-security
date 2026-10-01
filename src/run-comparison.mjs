export function compareRuns(before, after) {
  if (!before || !after) return null;
  const comparable = before.contractHash === after.contractHash && before.toolVersion === after.toolVersion && before.engineVersion === after.engineVersion && before.databasePackageVersion === after.databasePackageVersion;
  const old = new Map(before.results.map(r => [r.id, r]));
  const current = new Set(after.results.map(r => r.id));
  return {comparable, sourceChanged: before.sourceHash !== after.sourceHash,
    removed: before.results.filter(r => !current.has(r.id)).map(r => r.label),
    changes: after.results.filter(r => old.get(r.id)?.status !== r.status).map(r => ({id:r.id,label:r.label,from:old.get(r.id)?.status ?? 'not present',to:r.status})),
    message: comparable ? 'Same requirements and engine. Compare observed outcomes below. This is not independent repair verification.' : 'Requirements or engine changed. These runs cannot establish a like-for-like repair. Removed or altered checks must be reviewed.'};
}
