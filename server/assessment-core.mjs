import {coverageWarnings,validateProject} from './validation.mjs';
export function canonical(value){return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)}
export function createAssessment({hash,randomUUID,toolVersion,databasePackageVersion,defaultDatabase,runtime=()=>({})}){
const ident=s=>`"${s}"`;
const table=s=>s.split('.').map(ident).join('.');
const BOOT=`CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated;`;
const limitations=[
  'Local embedded PostgreSQL only. These results do not verify a deployed Supabase project.',
  'Synthetic identities are injected. Sign-in, JWT verification, HTTP routes and server functions are not exercised.',
  'Storage, network behavior, concurrent transactions, secrets, dependency risks and legal compliance are not assessed.',
  'Checks cover only the supplied contract and seed. A passing run is not a security certification.',
  'Uploaded SQL is trusted local input executed in an ephemeral process. Do not import untrusted SQL or production data.'
];
function queryFor(c) {
  const params=[]; const param=v=>{params.push(v);return `$${params.length}`;};
  const where=()=>Object.entries(c.match).map(([k,v])=>v===null?`${ident(k)} IS NULL`:`${ident(k)} = ${param(v)}`).join(' AND ');
  let sql;
  if(c.operation==='select')sql=`SELECT 1 AS boundary_observed FROM ${table(c.table)} WHERE ${where()} LIMIT 2`;
  if(c.operation==='delete')sql=`DELETE FROM ${table(c.table)} WHERE ${where()} RETURNING 1 AS boundary_observed`;
  if(c.operation==='update')sql=`UPDATE ${table(c.table)} SET ${Object.entries(c.values).map(([k,v])=>`${ident(k)} = ${param(v)}`).join(',')} WHERE ${where()} RETURNING 1 AS boundary_observed`;
  if(c.operation==='insert')sql=`INSERT INTO ${table(c.table)} (${Object.keys(c.values).map(ident).join(',')}) VALUES (${Object.values(c.values).map(param).join(',')}) RETURNING 1 AS boundary_observed`;
  return {sql,params};
}
function code(e){return /^[A-Z0-9]{5}$/.test(e?.code)?e.code:'ENGINE';}
async function assess(input,{createDatabase=defaultDatabase}={}) {
  const project=validateProject(input), startedAt=new Date().toISOString();
  const base={id:randomUUID(),projectId:input.id??'cli',projectName:project.name,revision:project.revision,owner:project.owner,isDemo:input.isDemo===true,startedAt,sourceHash:await hash({migration:project.migration,seed:project.seed}),sourceHashFormat:2,toolVersion,databasePackageVersion,contractHash:await hash(project.contract),scope:{checks:project.contract.checks.length,tables:[...new Set(project.contract.checks.map(c=>c.table))]},limitations,warnings:coverageWarnings(project.contract),engine:'PostgreSQL via PGlite',engineVersion:null,results:[]};
  let db,phase='initialization',failureKind;
  try {
    db=await createDatabase();
    phase='bootstrap';
    base.engineVersion=(await db.query('SELECT version() AS v')).rows[0].v;
    await db.exec(BOOT);
    const expectedAuth=await db.query("SELECT pg_get_functiondef('auth.uid()'::regprocedure) AS uid, pg_get_functiondef('auth.jwt()'::regprocedure) AS jwt");
    phase='migration';await db.exec(project.migration);
    phase='seed';await db.exec(project.seed);
    phase='role-validation';
    // Never run a contract as a role that migrations elevated or made an object owner.
    const roles=await db.query("SELECT rolname, rolsuper, rolbypassrls, rolinherit FROM pg_roles WHERE rolname IN ('anon','authenticated')");
    if(roles.rows.length!==2 || roles.rows.some(r=>r.rolsuper||r.rolbypassrls))throw Object.assign(new Error(),{code:'BR001'});
    const memberships=await db.query("SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON m.member=r.oid WHERE r.rolname IN ('anon','authenticated')");
    const owned=await db.query("SELECT 1 FROM pg_class c JOIN pg_roles r ON c.relowner=r.oid WHERE r.rolname IN ('anon','authenticated')");
    if(memberships.rows.length||owned.rows.length)throw Object.assign(new Error(),{code:'BR001'});
    // Require the expected helpers, rather than silently claiming a different auth simulation.
    const auth=await db.query("SELECT pg_get_functiondef('auth.uid()'::regprocedure) AS uid, pg_get_functiondef('auth.jwt()'::regprocedure) AS jwt");
    if(canonical(auth.rows)!==canonical(expectedAuth.rows))throw Object.assign(new Error(),{code:'BR002'});
    phase='assessment';for(const c of project.contract.checks) {
      const t=performance.now(); let observation='unknown',rows=null,sqlstate=null,reason='';
      // Preflight as owner confirms a target exists. A missing fixture is never proof of denial.
      if(c.operation!=='insert') {
        const p={...c,operation:'select'};
        try {const q=queryFor(p); const target=await db.query(q.sql,q.params);
          if(target.rows.length!==1){base.results.push({...c,status:'error',observation:'unknown',rows:null,sqlstate:null,reason:'Fixture must match exactly one row before checking access.',durationMs:Math.round(performance.now()-t)});continue;}
        }catch(e){base.results.push({...c,status:'error',observation:'unknown',rows:null,sqlstate:code(e),reason:'The requested table or fixture could not be queried.',durationMs:Math.round(performance.now()-t)});continue;}
      }
      try {
        await db.exec('BEGIN');
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",[c.userId??'',JSON.stringify({sub:c.userId,role:c.role})]);
        await db.exec(`SET LOCAL ROLE ${ident(c.role)}; SET LOCAL row_security = on;`);
        const q=queryFor(c); const result=await db.query(q.sql,q.params);
        rows=result.rows.length; observation=rows===1?'allow':rows===0?'deny':'unknown';
        reason=rows===1?'One matching row was accessible.':rows===0?'No matching row was accessible.':'More than one row was affected; narrow the fixture.';
      }catch(e){sqlstate=code(e); observation=sqlstate==='42501'?'deny':'unknown';reason=sqlstate==='42501'?'PostgreSQL denied permission or rejected the row policy.':`The check could not complete (SQLSTATE ${sqlstate}). This is not proof of denial.`;}
      finally{await db.exec('ROLLBACK');}
      const status=observation==='unknown'?'error':observation===c.expected?'passed':'failed';
      base.results.push({...c,status,observation,rows,sqlstate,reason,durationMs:Math.round(performance.now()-t)});
    }
  }catch(e){if(phase==='initialization')failureKind=e instanceof WebAssembly.RuntimeError?'wasm-runtime':e instanceof RangeError?'allocation-or-range':'initialization-error';base.setupError={code:code(e),phase,message:phase==='initialization'?'The embedded database could not initialize. No checks ran. Preserve this report and retry manually; recurring failures block release.':code(e)==='BR001'?'Migration elevated or reassigned a test role. Use non-owner anon/authenticated roles.':code(e)==='BR002'?'Migration changed the supported auth helpers. Export compatible policies.':`Assessment stopped during ${phase} (SQLSTATE ${code(e)}). No security conclusion can be drawn.`};}
  finally{if(db)await db.close();}
  if(base.setupError?.phase==='initialization')base.setupError.runtime={failureKind,...runtime()};
  base.finishedAt=new Date().toISOString();
  base.summary={passed:base.results.filter(r=>r.status==='passed').length,failed:base.results.filter(r=>r.status==='failed').length,errors:base.results.filter(r=>r.status==='error').length,notRun:project.contract.checks.length-base.results.length};
  base.verdict=base.setupError||base.summary.errors||base.summary.notRun||base.warnings.length?'incomplete':base.summary.failed?'needs-attention':'checks-passed';
  for(const c of project.contract.checks){if(!base.results.some(r=>r.id===c.id))base.results.push({...c,status:'unknown',observation:'unknown',rows:null,sqlstate:null,reason:'This requirement was not executed because assessment setup did not complete.',durationMs:0});}
  // Check values and match data stay local in project inputs, never in exported evidence.
  base.results=base.results.map(({match,values,userId,...r})=>r);
  base.integrity={algorithm:'sha256',digest:await hash(base),meaning:'Content checksum, not a digital signature or independent attestation.'};
  return base;
}

return {assess,limitations};
}
