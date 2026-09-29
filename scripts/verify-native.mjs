// Differential verification only: an owned, network-isolated Docker fixture.
// The production application never connects to a server database.
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';
import {assess} from '../server/engine.mjs';
import {fixture,advancedCases} from './policy-fixtures.mjs';
import {demoProject,demoPatch} from '../server/demo.mjs';
const container=process.argv[2];
if(!container)throw Error('Provide the explicitly created boundary.parity fixture container.');
const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true});
const inspect=JSON.parse(docker(['inspect',container]))[0];
if(inspect.Config.Labels?.['boundary.parity']!=='synthetic-only'||inspect.HostConfig.NetworkMode!=='none'||Object.keys(inspect.HostConfig.PortBindings??{}).length)throw Error('Refusing a container without the isolated synthetic-fixture label.');
const image=inspect.Image;
const literal=v=>v===null?'NULL':typeof v==='boolean'?(v?'true':'false'):typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
async function nativeDatabase(){
 const database='boundary_'+randomUUID().replaceAll('-','');
 docker(['exec',container,'createdb','-U','postgres',database]);
 // Roles are cluster-wide; keep the same non-owner privileges across fresh databases.
 docker(['exec',container,'psql','-U','postgres','-d',database,'-q','-c',"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;"]);
 const proc=spawn('docker',['exec','-i',container,'psql','-X','-q','-A','-t','-U','postgres','-d',database],{windowsHide:true});
 const lines=createInterface({input:proc.stdout});let pending=null;proc.stderr.on('data',()=>{});
 lines.on('line',line=>{if(!pending)return;if(line.startsWith(pending.marker+' ')){const current=pending;pending=null;clearTimeout(current.timer);const code=line.slice(current.marker.length+1).trim();if(code!=='00000')current.reject(Object.assign(new Error('Native PostgreSQL query failed'),{code}));else current.resolve(current.output.join('\n'));}else pending.output.push(line);});
 proc.on('exit',()=>{if(pending){clearTimeout(pending.timer);pending.reject(Error('Native PostgreSQL session exited'));pending=null;}});
 const send=sql=>new Promise((resolve,reject)=>{if(pending)return reject(Error('Parallel queries are unsupported'));const marker='BOUNDARY_'+randomUUID().replaceAll('-','');const timer=setTimeout(()=>{pending=null;proc.kill();reject(Error('Native PostgreSQL request timed out'));},15000);pending={resolve,reject,marker,timer,output:[]};proc.stdin.write(sql.replace(/;\s*$/,'')+';\n\\echo '+marker+' :SQLSTATE\n');});
 return {
  async exec(sql){const adjusted=sql.replace('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;','');return send(adjusted);},
  async query(sql,params=[]){const expanded=sql.replace(/\$(\d+)/g,(_,n)=>literal(params[Number(n)-1]));const wrapped=/^\s*(INSERT|UPDATE|DELETE)\b/i.test(expanded)?`WITH boundary_rows AS (${expanded}) SELECT coalesce(json_agg(boundary_rows),'[]'::json) FROM boundary_rows`:`SELECT coalesce(json_agg(boundary_rows),'[]'::json) FROM (${expanded}) boundary_rows`;return {rows:JSON.parse(await send(wrapped))};},
  async close(){proc.stdin.end('\\q\n');await new Promise(resolve=>proc.once('exit',resolve));lines.close();docker(['exec',container,'dropdb','-U','postgres',database]);}
 };
}
const {realisticProject,realisticScenarios}=await import('./realistic-fixtures.mjs');
const results=[],cases=realisticScenarios.map(s=>({name:'agency-'+s.id,project:s.mutate(realisticProject())}));
for(const variant of ['before','repaired','rls-disabled','missing-fixture']){
 const project=demoProject();
 if(variant==='repaired')project.migration+='\n'+demoPatch;
 if(variant==='rls-disabled')project.migration+='\nALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;';
 if(variant==='missing-fixture')project.contract.checks[1].match.id='dddddddd-dddd-4ddd-8ddd-dddddddddd99';
 cases.push({name:variant,project});
}
cases.push({name:'direct-owner',project:fixture(),failures:[]},...advancedCases());
for(const {name:variant,project,failures} of cases){
 const embedded=await assess(project),native=await assess(project,{createDatabase:nativeDatabase});
 const observations=r=>({summary:r.summary,verdict:r.verdict,setupError:r.setupError,results:r.results.map(({id,status,observation,sqlstate})=>({id,status,observation,sqlstate}))});
 const expectedMatch=failures===undefined||[embedded,native].every(r=>!r.setupError&&r.summary.errors===0&&JSON.stringify(r.results.filter(x=>x.status==='failed').map(x=>x.id).sort())===JSON.stringify([...failures].sort()));
 const same=expectedMatch&&JSON.stringify(observations(embedded))===JSON.stringify(observations(native));
 results.push({variant,same,embeddedVersion:embedded.engineVersion,nativeVersion:native.engineVersion,embedded:observations(embedded),native:observations(native)});
 console.log(JSON.stringify({variant,same,embedded:embedded.summary,native:native.summary,error:native.setupError}));
}
writeFileSync(new URL('../evidence/native-parity-10.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),image,scope:'Owned synthetic fixtures including agency lifecycle snapshots; same assessment query harness, not independent review or real auth parity.',results},null,2));
process.exitCode=results.some(r=>!r.same)?1:0;

