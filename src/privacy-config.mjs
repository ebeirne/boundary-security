// Browser-side guidance only. The server remains authoritative for every run.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identifier=/^[a-z][a-z0-9_]{0,62}$/;
export function privacySetupErrors(config,{step='all'}={}){
 const c=config??{},errors=[];
 const add=(field,message)=>errors.push({field,message});
 if(step===0||step==='all'){
  let validOrigin=false;
  try{const u=new URL(c.origin);validOrigin=((u.protocol==='http:'&&u.hostname==='127.0.0.1')||(u.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&!u.port))&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash}catch{}
  if(!validOrigin)add('origin','Use your Supabase staging project address, without a page path, query or credentials. Local Supabase at http://127.0.0.1 is also supported.');
  if(typeof c.bucket!=='string'||!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(c.bucket))add('bucket','Use a bucket name beginning with a lowercase letter or number; only lowercase letters, numbers, underscores and hyphens are supported.');
  if(typeof c.object!=='string'||c.object.length>512||c.object.split('/').some(p=>!p||p==='.'||p==='..'||!/^[a-zA-Z0-9_. -]+$/.test(p)))add('object','Use the path of the invented file, such as customer-a/test.txt. Encoded paths, empty folders and parent-directory paths are not supported.');
  if(typeof c.marker!=='string'||c.marker.length<16||c.marker.length>200)add('marker','Use the same invented text of 16 to 200 characters in the file and document record.');
  if(typeof c.table!=='string'||!identifier.test(c.table))add('table','Use a lowercase document table name, with letters, numbers or underscores.');
  if(!['string','number'].includes(typeof c.recordId)||(typeof c.recordId==='number'&&!Number.isFinite(c.recordId))||!String(c.recordId).length||String(c.recordId).length>100)add('recordId','Enter the exact invented document record ID, up to 100 characters.');
  if(!['row','rpc'].includes(c.retrieval?.mode))add('retrieval','Choose document row or retrieval function.');
  if(c.retrieval?.mode==='rpc'&&(typeof c.retrieval.functionName!=='string'||!identifier.test(c.retrieval.functionName)))add('functionName','Enter the reviewed retrieval function name using lowercase letters, numbers or underscores.');
 }
 if(step===1||step==='all'){
  if(typeof c.ownerId!=='string'||!uuid.test(c.ownerId))add('ownerId','Enter the file owner’s test-user UUID, not an email address.');
  if(typeof c.otherId!=='string'||!uuid.test(c.otherId))add('otherId','Enter the other customer’s test-user UUID, not an email address.');
  else if(c.ownerId===c.otherId)add('otherId','Use a different test customer. Comparing an account with itself cannot check customer isolation.');
 }
 return errors;
}
export function parsePrivacySetup(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>16384)throw Error('Use a setup file under 16 KB.');
 let p;try{p=JSON.parse(text)}catch{throw Error('This is not a valid JSON setup file. Ask your builder to export boundary-privacy-setup.json again.');}
 if(!p||typeof p!=='object'||Array.isArray(p)||p.version!==1||p.synthetic!==true)throw Error('Use a version 1 Boundary setup prepared with invented data only.');
 const allowed=new Set(['version','authorized','synthetic','origin','ownerId','otherId','bucket','object','table','recordId','marker','retrieval']);
 if(Object.keys(p).some(k=>!allowed.has(k)))throw Error('The setup file contains unsupported fields. Export only the documented setup fields; keep keys, passwords and test sessions out of this file.');
 const c={version:1,authorized:false,synthetic:true};
 for(const key of ['origin','ownerId','otherId','bucket','object','table','marker']){
  if(typeof p[key]!=='string')throw Error('The setup file is missing a required text field. Ask your builder to check the documented format.');
  c[key]=p[key];
 }
 c.recordId=p.recordId;
 const r=p.retrieval??{mode:'row'};
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['mode','functionName','reviewedReadOnly'].includes(k)))throw Error('The retrieval setup contains unsupported fields. Use the documented row or read-only function format.');
 c.retrieval=r.mode==='rpc'?{mode:'rpc',functionName:r.functionName,reviewedReadOnly:false}:{mode:r.mode};
 const errors=privacySetupErrors(c);
 if(errors.length)throw Error(errors[0].message);
 return c;
}
