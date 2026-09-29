const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plain = x => x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
function text(x, label, max=140) { assert(typeof x === 'string' && x.trim().length > 0 && x.length <= max, `${label} must be 1–${max} characters.`); return x.trim(); }
function record(x, label, required) {
  assert(plain(x), `${label} must be an object.`);
  const entries = Object.entries(x);
  assert(entries.length >= (required ? 1 : 0) && entries.length <= 12, `${label} needs ${required ? '1–12' : 'up to 12'} columns.`);
  for (const [k,v] of entries) {
    assert(IDENT.test(k), `${label} contains an invalid column name.`);
    assert(v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 2000), `${label} values must be short scalar values.`);
  }
  return Object.fromEntries(entries);
}
export function validateContract(value) {
  assert(plain(value) && value.version === 1, 'Contract version must be 1.');
  assert(Array.isArray(value.checks) && value.checks.length > 0 && value.checks.length <= 40, 'Include 1–40 access checks.');
  const ids = new Set();
  const checks = value.checks.map((c,i) => {
    assert(plain(c), `Check ${i+1} is invalid.`);
    const id=text(c.id, 'Check ID',40); assert(/^[a-zA-Z0-9_-]+$/.test(id) && !ids.has(id), 'Check IDs must be unique letters, numbers, dashes or underscores.'); ids.add(id);
    assert(['anon','authenticated'].includes(c.role), `Check ${id}: role must be anon or authenticated.`);
    assert(c.role === 'anon' ? c.userId == null : UUID.test(c.userId), `Check ${id}: authenticated users need a UUID; anonymous users must not have one.`);
    assert(typeof c.table === 'string' && /^public\.[a-z_][a-z0-9_]{0,62}$/.test(c.table), `Check ${id}: use a public.table_name.`);
    assert(['select','insert','update','delete'].includes(c.operation), `Check ${id}: unsupported operation.`);
    assert(['allow','deny'].includes(c.expected), `Check ${id}: expected must be allow or deny.`);
    return {id,label:text(c.label,'Check label'),actor:text(c.actor || (c.role==='anon'?'Visitor':'Test user'),'Actor',60),role:c.role,userId:c.userId ?? null,table:c.table,operation:c.operation,expected:c.expected,match:record(c.match ?? {},`Check ${id} match`,c.operation!=='insert'),values:record(c.values ?? {},`Check ${id} values`,['insert','update'].includes(c.operation))};
  });
  return {version:1,checks};
}
export function validateProject(input) {
  assert(plain(input), 'Project must be an object.');
  const project={name:text(input.name,'Project name',80),revision:text(input.revision,'Revision',100),owner:text(input.owner,'Scope owner',100),migration:text(input.migration,'Migration',150000),seed:text(input.seed,'Synthetic seed',75000),contract:validateContract(input.contract)};
  assert(input.authorized === true && input.synthetic === true,'Confirm authorization and synthetic test data.');
  return {...project,authorized:true,synthetic:true};
}
export function coverageWarnings(contract) {
  const warnings=[];
  for (const c of contract.checks.filter(c=>c.expected==='deny')) {
    if (!contract.checks.some(p=>p.table===c.table && p.operation===c.operation && p.expected==='allow')) warnings.push(`No allow control for ${c.table} ${c.operation}. A deny-only result cannot establish that normal use works.`);
  }
  if (!contract.checks.some(c=>c.expected==='deny')) warnings.push('No deny checks: this contract cannot establish isolation.');
  if (!contract.checks.some(c=>c.role==='anon')) warnings.push('Anonymous access has not been checked.');
  return [...new Set(warnings)];
}
