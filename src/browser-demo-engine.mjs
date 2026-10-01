import {demoProject,demoPatch} from '../server/demo.mjs';
export {demoPatch};
// Fixed owned fixture only. No user SQL, URLs, credentials or records accepted.
export async function runBrowserDemo(createDatabase,repaired=false){
 const db=await createDatabase(),project=demoProject(),results=[];
 try{
 await db.exec(`CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth, public TO anon, authenticated; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
 await db.exec(project.migration);await db.exec(project.seed);if(repaired)await db.exec(demoPatch);
 for(const check of project.contract.checks){let observation='unknown',reason='',rows=null;const params=[];const bind=v=>{params.push(v);return '$'+params.length};const where=()=>Object.entries(check.match).map(([k,v])=>`"${k}" = ${bind(v)}`).join(' AND ');let sql;
 if(check.operation==='select')sql=`SELECT 1 FROM public.documents WHERE ${where()}`;
 if(check.operation==='update')sql=`UPDATE public.documents SET title=${bind(check.values.title)} WHERE ${where()} RETURNING 1`;
 if(check.operation==='delete')sql=`DELETE FROM public.documents WHERE ${where()} RETURNING 1`;
 if(check.operation==='insert')sql=`INSERT INTO public.documents (id,org_id,title) VALUES (${bind(check.values.id)},${bind(check.values.org_id)},${bind(check.values.title)}) RETURNING 1`;
 try{await db.exec('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[check.userId??'']);await db.exec(`SET LOCAL ROLE ${check.role}; SET LOCAL row_security=on`);const r=await db.query(sql,params);rows=r.rows.length;observation=rows===1?'allow':rows===0?'deny':'unknown';reason=rows===1?'One synthetic row was accessible.':'No synthetic row was accessible.';}catch(e){observation=e.code==='42501'?'deny':'unknown';reason=observation==='deny'?'PostgreSQL rejected the operation.':'The check could not complete.';}finally{await db.exec('ROLLBACK')}
 results.push({id:check.id,label:check.label,expected:check.expected,observed:observation,status:observation==='unknown'?'unverified':check.expected===observation?'passed':'failed',rows,reason});
 }
 return {scope:'Fixed synthetic browser demonstration only; not a live app assessment or security certification.',engine:'PostgreSQL via PGlite',repaired,createdAt:new Date().toISOString(),results};
 }finally{await db.close()}
}
