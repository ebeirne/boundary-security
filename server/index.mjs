import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {demoProject,demoPatch,demoMigration} from './demo.mjs';
import {validateProject} from './validation.mjs';
import {runAssessment} from './runner.mjs';
import {hash,verifyIntegrity} from './engine.mjs';
import {markdownReport} from './report.mjs';
import {openStore} from './store.mjs';
import {acquireWorkspace} from './lock.mjs';
import {createBackup} from './backup.mjs';
import {runSupabasePrivacy} from './supabase-privacy.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inputVersion=project=>hash(validateProject(project));
export function createApp({port=4387,dataDir=path.join(ROOT,'.boundary'),assessor=runAssessment,privacyAssessor=runSupabasePrivacy}={}) {
  mkdirSync(dataDir,{recursive:true});
  const release=acquireWorkspace(dataDir);
  let store;
  try{store=openStore(dataDir,{projects:[{...demoProject(),updatedAt:new Date().toISOString()}],runs:[]});}catch(e){release();throw e;}
  let state=store.value;
  const token=randomBytes(32).toString('hex'); let busy=false;
  const commit=mutate=>{const next=structuredClone(state);mutate(next);store.commit(next);state=next;};
  const send=(res,status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(body):body);};
  const readBody=async req=>{let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>350000)throw Object.assign(new Error('Input exceeds 350 KB. Use a small schema and synthetic fixtures.'),{status:413});parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new Error('Request must contain valid JSON.');}};
  const server=http.createServer(async(req,res)=>{
    const allowedHost=`127.0.0.1:${server.address()?.port??port}`;
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if(req.headers.host!==allowedHost)return send(res,403,{error:'Open the app using its 127.0.0.1 address.'});
    if(req.headers.origin && req.headers.origin!==`http://${allowedHost}`)return send(res,403,{error:'Cross-origin requests are not allowed.'});
    if(req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Cross-site requests are not allowed.'});
    try {
      const url=new URL(req.url,`http://${allowedHost}`),p=url.pathname;
      if(p.startsWith('/api/') && !['GET','HEAD'].includes(req.method)) {
        if(req.headers['x-boundary-token']!==token)return send(res,403,{error:'Session expired. Refresh this page before continuing.'});
        if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'Use application/json.'});
      }
      if(req.method==='GET' && p==='/api/state')return send(res,200,{token,projects:state.projects.map(p=>({...p,inputVersion:inputVersion(p),sourceHash:hash({migration:p.migration,seed:p.seed}),contractHash:hash(p.contract)})),runs:state.runs,busy});
      if(req.method==='GET' && p==='/api/template')return send(res,200,{...demoProject(),isDemo:undefined,id:undefined});
      if(req.method==='POST' && p==='/api/document-privacy'){
        if(busy)return send(res,409,{error:'A check is already running. Wait for it to finish.'});
        const {config,credentials}=await readBody(req);
        if(busy)return send(res,409,{error:'A check is already running. Wait for it to finish.'});
        busy=true;const controller=new AbortController();const cancel=()=>controller.abort();res.on('close',cancel);
        const timeout=setTimeout(cancel,90000);
        try{
          const report=await privacyAssessor(config,{...credentials,signal:controller.signal});
          if(!res.destroyed)return send(res,200,report);
        }catch{if(!res.destroyed)return send(res,400,{error:'Could not run these privacy checks. Check the project address, test sessions and supported fixture fields. No protection is verified.'})}
        finally{clearTimeout(timeout);res.off('close',cancel);busy=false;}
        return;
      }
      if(req.method==='POST' && p==='/api/backup'){
        if(busy)return send(res,409,{error:'Wait for the active assessment before saving a backup.'});
        const folder=path.join(dataDir,'backups');mkdirSync(folder,{recursive:true});
        return send(res,201,createBackup(dataDir,path.join(folder,`boundary-${Date.now()}-${randomUUID()}.json`)));
      }
      if(req.method==='GET' && p==='/api/demo-patch')return send(res,200,demoPatch,'text/plain; charset=utf-8');
      if(req.method==='POST' && p==='/api/demo-project') {
        if(busy)return send(res,409,{error:'Wait for the active assessment before creating a demo.'});
        if(state.projects.length>=20)return send(res,409,{error:'Project limit reached.'});
        const project={...demoProject(),id:randomUUID(),name:`Northstar demo ${state.projects.filter(p=>p.isDemo).length+1}`,updatedAt:new Date().toISOString()};
        commit(next=>next.projects.push(project));return send(res,201,project);
      }
      if((req.method==='GET'||req.method==='POST') && /^\/api\/export\/[a-f0-9-]+$/.test(p)) {
        const run=state.runs.find(r=>r.id===p.split('/').at(-1));if(!run)return send(res,404,{error:'Run not found.'});
        if(!verifyIntegrity(run))return send(res,409,{error:'Evidence checksum mismatch. This record must not be exported as verified.'});
        const format=url.searchParams.get('format')??'json';if(!['md','json'].includes(format))return send(res,400,{error:'Choose Markdown or JSON.'});
        const markdown=format==='md';
        if(req.method==='POST'){
          const directory=path.join(dataDir,'exports'),filename=`boundary-${run.id}.${format}`,file=path.join(directory,filename);
          const content=markdown?markdownReport(run):JSON.stringify(run,null,2);
          mkdirSync(directory,{recursive:true});
          try{writeFileSync(file,content,{encoding:'utf8',flag:'wx',mode:0o600});}
          catch(e){if(e.code!=='EEXIST')throw new Error('The report could not be saved. Check available disk space and workspace permissions.');if(readFileSync(file,'utf8')!==content)return send(res,409,{error:'An existing export differs from the verified evidence. It was preserved; inspect it before exporting again.'});}
          if(readFileSync(file,'utf8')!==content)throw new Error('Saved report verification failed.');
          return send(res,201,{filename,path:path.resolve(file),bytes:Buffer.byteLength(content),digest:hash(content),format});
        }
        res.setHeader('Content-Disposition',`attachment; filename="boundary-${run.id}.${markdown?'md':'json'}"`);
        return send(res,200,markdown?markdownReport(run):run,markdown?'text/markdown; charset=utf-8':'application/json; charset=utf-8');
      }
      if(req.method==='POST' && p==='/api/projects') {
        if(state.projects.length>=20)return send(res,409,{error:'This local pilot supports up to 20 projects.'});
        const body=await readBody(req),project={...validateProject(body),id:randomUUID(),isDemo:false,updatedAt:new Date().toISOString()};
        if(busy)return send(res,409,{error:'Wait for the active assessment before changing inputs.'});
        if(state.projects.length>=20)return send(res,409,{error:'Project limit reached.'});
        commit(next=>next.projects.push(project));return send(res,201,project);
      }
      const projectRoute=/^\/api\/projects\/([a-zA-Z0-9-]+)(?:\/(run|repair|reset))?$/.exec(p);
      if(projectRoute) {
        const [,id,action]=projectRoute;let project=state.projects.find(x=>x.id===id);if(!project)return send(res,404,{error:'Project not found.'});
        if(req.method==='PUT' && !action) {
          const body=await readBody(req),valid=validateProject(body);
          if(busy)return send(res,409,{error:'Wait for the active assessment before changing inputs.'});
          project=state.projects.find(x=>x.id===id);
          if(req.headers['x-boundary-version']!==inputVersion(project))return send(res,409,{error:'These inputs changed, or the edit has no version. Reload the workspace before saving; your newer inputs were preserved.'});
          const updated={...project,...valid,isDemo:project.isDemo && valid.migration===project.migration && valid.seed===project.seed,updatedAt:new Date().toISOString()};commit(next=>{next.projects=next.projects.map(p=>p.id===id?updated:p);});return send(res,200,updated);
        }
        if(req.method==='POST' && action==='run') {
          if(busy)return send(res,409,{error:'Another assessment is running. Wait for it to finish.'});
          if(state.runs.length>=250)return send(res,409,{error:'Local history limit reached (250 runs). Back up the workspace before starting another.'});
          busy=true;
          try {const run=await assessor(structuredClone(project));commit(next=>next.runs.unshift(run));return send(res,201,run);}finally{busy=false;}
        }
        if(req.method==='POST' && action==='repair') {
          if(busy)return send(res,409,{error:'Wait for the active assessment before changing inputs.'});
          if(!project.isDemo || project.migration!==demoMigration)return send(res,409,{error:'The known repair applies only to the unchanged owned demo.'});
          const updated={...project,migration:project.migration+'\n'+demoPatch,revision:'demo-v2-repaired',updatedAt:new Date().toISOString()};commit(next=>{next.projects=next.projects.map(p=>p.id===id?updated:p);});return send(res,200,updated);
        }
        if(req.method==='POST' && action==='reset') {
          if(id!=='demo')return send(res,400,{error:'Only the owned demo can be reset.'});
          if(busy)return send(res,409,{error:'Wait for the active assessment before changing inputs.'});
          const updated={...demoProject(),updatedAt:new Date().toISOString()};commit(next=>{next.projects=next.projects.map(p=>p.id===id?updated:p);});return send(res,200,updated);
        }
      }
      if(p.startsWith('/api/'))return send(res,404,{error:'Action not found.'});
      if(req.method!=='GET' && req.method!=='HEAD')return send(res,405,{error:'Method not allowed.'});
      const publicFiles=path.join(ROOT,'dist');
      const relative=decodeURIComponent(p).replace(/^\/+/,''),candidate=path.resolve(publicFiles,relative||'index.html');
      if(!candidate.startsWith(publicFiles+path.sep))return send(res,403,{error:'Invalid path.'});
      const file=existsSync(candidate)?candidate:path.join(publicFiles,'index.html');
      if(!existsSync(file))return send(res,503,'Build the interface first: npm run build','text/plain');
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
    }catch(e){send(res,e.status??400,{error:e.message?.slice(0,220)??'The operation did not complete.'});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  process.once('exit',release);
  const unlock=()=>{release();process.removeListener('exit',release);};
  server.once('close',unlock);server.once('error',unlock);
  return {server,get state(){return state;},get token(){return token;}};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.BOUNDARY_PORT??4387);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('BOUNDARY_PORT must be between 1024 and 65535.');
  const app=createApp({port});app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Set BOUNDARY_PORT to an unused local port.`:'The local server could not start.');process.exitCode=1;});app.server.listen(port,'127.0.0.1',()=>console.log(`Boundary is ready at http://127.0.0.1:${port}`));
}
