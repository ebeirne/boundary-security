// Explicitly owned disposable local fixture only. Never accepts a remote endpoint.
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {runAssessment} from '../server/runner.mjs';
import {verifyDocumentPrivacy} from './verify-document-privacy.mjs';
const workdir=process.argv[2];
if(!workdir)throw Error('Supply the disposable supabase-validation directory.');
const container='supabase_db_supabase-validation';
const docker=args=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:30000});
const inspected=JSON.parse(docker(['inspect',container]))[0];
if(inspected.Config.Labels?.['com.supabase.cli.project']!=='supabase-validation')throw Error('Unexpected fixture container.');
const cli=process.platform==='win32'?'npx.cmd':'npx';
const status=JSON.parse(execFileSync(cli,['--yes','supabase@2.118.0','status','-o','json'],{cwd:path.resolve(workdir),encoding:'utf8',windowsHide:true,shell:process.platform==='win32',stdio:['ignore','pipe','pipe']}));
const base=new URL(status.API_URL);
if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||base.port!=='54321')throw Error('Only the dedicated local API is supported.');
const key=status.ANON_KEY;
if(!key)throw Error('Local anonymous key unavailable.');
const sql=text=>execFileSync('docker',['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:text,encoding:'utf8',windowsHide:true,timeout:30000,stdio:['pipe','pipe','pipe']});
async function request(route,{method='GET',token,body}={}){
 const res=await fetch(new URL(route,base),{method,headers:{apikey:key,...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=null;}
 return {status:res.status,data};
}
async function user(label){
 const credentials={email:`boundary-${label}-${randomUUID()}@example.test`,password:randomUUID()+'aA!7'};
 const signup=await request('/auth/v1/signup',{method:'POST',body:credentials});
 if(!signup.data?.user?.id)throw Error(`Synthetic signup failed (${signup.status}).`);
 const login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:credentials});
 if(!login.data?.access_token)throw Error(`Synthetic login failed (${login.status}).`);
 return {id:signup.data.user.id,token:login.data.access_token};
}
const alice=await user('alice'),bob=await user('bob');
const documentPrivacy=await verifyDocumentPrivacy({base,key,sql,alice,bob});
const table='boundary_stage_notes';
const migration=`CREATE TABLE public.${table}(id integer PRIMARY KEY, owner_id uuid NOT NULL, body text NOT NULL);
GRANT ALL ON public.${table} TO anon,authenticated;
ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
CREATE POLICY r ON public.${table} FOR SELECT TO authenticated USING(true);
CREATE POLICY u ON public.${table} FOR UPDATE TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY i ON public.${table} FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY d ON public.${table} FOR DELETE TO authenticated USING(owner_id=auth.uid());`;
const repair=`ALTER POLICY r ON public.${table} USING(owner_id=auth.uid()); ALTER POLICY u ON public.${table} USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());`;
const seed=`INSERT INTO public.${table} VALUES(1,'${alice.id}','one'),(2,'${bob.id}','two');`;
// Refuse reuse rather than overwrite any existing table.
sql(migration+seed+" NOTIFY pgrst, 'reload schema';");
const checks=[];
for(const operation of ['select','insert','update','delete'])for(const actor of ['own','other','anon']){
 const c={id:`${operation}-${actor}`,label:`${operation}-${actor}`,actor,role:actor==='anon'?'anon':'authenticated',...(actor==='anon'?{}:{userId:alice.id}),table:`public.${table}`,operation,expected:actor==='own'?'allow':'deny'};
 if(operation==='insert')c.values={id:3,owner_id:actor==='other'?bob.id:alice.id,body:'new'};
 else {c.match={id:actor==='other'?2:1};if(operation==='update')c.values={body:'edited'};}
 checks.push(c);
}
// Bounded readiness polling: only a schema-cache 404 is retried.
for(let attempt=0;attempt<20;attempt++){
 const ready=await request(`/rest/v1/${table}?select=id`,{token:alice.token});
 if(ready.status===200)break;
 if(ready.status!==404||attempt===19)throw Error(`REST schema unavailable (${ready.status}).`);
 await new Promise(resolve=>setTimeout(resolve,500));
}
const phases=[];
for(const phase of ['before','repaired']){
 if(phase==='repaired')sql(repair);
 const project={name:'Owned Supabase HTTP validation',revision:phase,owner:'Local synthetic fixture',authorized:true,synthetic:true,migration:migration+(phase==='repaired'?repair:''),seed,contract:{version:1,checks}};
 const embedded=await runAssessment(project);
 if(embedded.setupError||embedded.startupRecovery)throw Error('Embedded assessment incomplete or recovered.');
 const results=[];
 for(const c of checks){
  sql(`TRUNCATE public.${table};`+seed);
  const route=`/rest/v1/${table}`+(c.operation==='insert'?'':`?id=eq.${c.match.id}`);
  const response=await request(route,{method:{select:'GET',insert:'POST',update:'PATCH',delete:'DELETE'}[c.operation],token:c.role==='authenticated'?alice.token:undefined,body:c.values});
  const allowed=response.status>=200&&response.status<300&&Array.isArray(response.data)&&response.data.length===1;
  const denied=(response.status>=200&&response.status<300&&Array.isArray(response.data)&&response.data.length===0)||([401,403].includes(response.status)&&response.data?.code==='42501');
  const observed=allowed?'allow':denied?'deny':'unknown';
  const result=embedded.results.find(r=>r.id===c.id);
  results.push({id:c.id,expected:c.expected,observed,httpStatus:response.status,status:observed==='unknown'?'error':observed===c.expected?'passed':'failed',embeddedStatus:result.status});
 }
 phases.push({phase,sourceHash:embedded.sourceHash,contractHash:embedded.contractHash,results});
}
// Lifecycle and concurrency tests use only this disposable fixture.
const lifecycle=[];
const record=(name,ok,detail)=>lifecycle.push({name,ok,detail});
sql(`TRUNCATE public.${table};`+seed);
const concurrent=await Promise.all(Array.from({length:40},(_,i)=>request(`/rest/v1/${table}?select=id`,{token:i%2?bob.token:alice.token})));
record('concurrent-customer-isolation',concurrent.every((r,i)=>r.status===200&&r.data?.length===1&&r.data[0].id===(i%2?2:1)),{requests:40});
const bulk=await request(`/rest/v1/${table}?id=in.(1,2)`,{method:'PATCH',token:alice.token,body:{body:'bulk synthetic edit'}});
record('bulk-update-cannot-cross-owner',bulk.status===200&&bulk.data?.length===1&&bulk.data[0].id===1,{httpStatus:bulk.status});
const bobAfter=await request(`/rest/v1/${table}?id=eq.2`,{token:bob.token});
record('other-customer-record-unchanged',bobAfter.status===200&&bobAfter.data?.[0]?.body==='two',{});
// Revocation is checked using the same previously issued, valid token.
sql(`CREATE TABLE public.boundary_active_members(user_id uuid PRIMARY KEY, active boolean NOT NULL);
GRANT SELECT ON public.boundary_active_members TO authenticated;
ALTER TABLE public.boundary_active_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY self ON public.boundary_active_members FOR SELECT TO authenticated USING(user_id=auth.uid());
INSERT INTO public.boundary_active_members VALUES('${alice.id}',true),('${bob.id}',true);
CREATE POLICY active_member ON public.${table} AS RESTRICTIVE FOR ALL TO authenticated
USING(EXISTS(SELECT 1 FROM public.boundary_active_members WHERE user_id=auth.uid() AND active))
WITH CHECK(EXISTS(SELECT 1 FROM public.boundary_active_members WHERE user_id=auth.uid() AND active));`);
const active=await request(`/rest/v1/${table}?id=eq.1`,{token:alice.token});
record('membership-positive-control',active.status===200&&active.data?.length===1,{});
sql(`UPDATE public.boundary_active_members SET active=false WHERE user_id='${alice.id}';`);
const revoked=await request(`/rest/v1/${table}?id=eq.1`,{token:alice.token});
const revokedWrite=await request(`/rest/v1/${table}?id=eq.1`,{method:'PATCH',token:alice.token,body:{body:'revoked edit'}});
record('revocation-with-existing-session',revoked.status===200&&revoked.data?.length===0&&revokedWrite.status===200&&revokedWrite.data?.length===0,{readStatus:revoked.status,writeStatus:revokedWrite.status});
sql(`UPDATE public.boundary_active_members SET active=true WHERE user_id='${alice.id}';`);
const restored=await request(`/rest/v1/${table}?id=eq.1`,{token:alice.token});
record('membership-restoration',restored.status===200&&restored.data?.length===1,{});
// A real gateway outage must produce a transport error, never an access denial.
const gateway='supabase_kong_supabase-validation';
const gatewayInfo=JSON.parse(docker(['inspect',gateway]))[0];
if(gatewayInfo.Config.Labels?.['com.supabase.cli.project']!=='supabase-validation')throw Error('Unexpected gateway fixture.');
let transportFailure=false;
try{docker(['stop',gateway]);try{await request(`/rest/v1/${table}`,{token:alice.token});}catch{transportFailure=true;}}
finally{docker(['start',gateway]);}
record('gateway-outage-is-transport-failure',transportFailure,{});
let recovered=false;
for(let i=0;i<30;i++){try{const r=await request(`/rest/v1/${table}?id=eq.1`,{token:alice.token});if(r.status===200&&r.data?.length===1){recovered=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
record('gateway-recovery-preserves-session-and-data',recovered,{});
const invalid=await request(`/rest/v1/${table}`,{token:'invalid-token'});
const expectedFailures=['select-other','update-other'];
const failures=phase=>phase.results.filter(r=>r.status==='failed').map(r=>r.id);
const ok=phases.every(p=>p.results.every(r=>r.status!=='error'&&r.status===r.embeddedStatus))&&JSON.stringify(failures(phases[0]))===JSON.stringify(expectedFailures)&&failures(phases[1]).length===0&&phases[0].contractHash===phases[1].contractHash&&invalid.status===401&&lifecycle.every(r=>r.ok);
const report={at:new Date().toISOString(),scope:'Owned local Supabase Auth, Storage and REST synthetic fixture. Self-authored; not independent review or hosted staging.',databaseImage:inspected.Image,documentPrivacy,lifecycle,phases,invalidTokenRejected:invalid.status===401,ok};
writeFileSync(process.env.BOUNDARY_VALIDATION_REPORT??new URL('../evidence/supabase-local-validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({ok,checks:24,lifecycle,invalidTokenRejected:report.invalidTokenRejected,phases:phases.map(p=>({phase:p.phase,failed:failures(p)}))}));
if(!ok)process.exitCode=1;
