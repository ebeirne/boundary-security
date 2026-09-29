import {createHash} from 'node:crypto';
import {checkDocumentPrivacy} from './privacy-check.mjs';
export function validatePrivacyConfig(config){
 const c=structuredClone(config);
 if(c?.version!==1 || c.authorized!==true || c.synthetic!==true)throw Error('Confirm ownership/authorization and synthetic fixtures in the version 1 configuration.');
 const u=new URL(c.origin);
 const local=u.protocol==='http:'&&u.hostname==='127.0.0.1';
 const hosted=u.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&!u.port;
 if((!local&&!hosted)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use an exact local or hosted Supabase origin without a path or credentials.');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(c.ownerId)||!uuid.test(c.otherId)||c.ownerId===c.otherId)throw Error('Use two distinct test-user UUIDs.');
 if(!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(c.bucket))throw Error('Unsupported bucket name.');
 if(typeof c.object!=='string'||c.object.length>512||c.object.split('/').some(p=>!p||p==='.'||p==='..'||! /^[a-zA-Z0-9_. -]+$/.test(p)))throw Error('Use a simple synthetic object path, without traversal or encoded URL characters.');
 if(!/^[a-z][a-z0-9_]{0,62}$/.test(c.table)||!['string','number'].includes(typeof c.recordId)||String(c.recordId).length>100||!String(c.recordId).length)throw Error('Provide the document table and exact synthetic record ID.');
 if(typeof c.marker!=='string'||c.marker.length<16||c.marker.length>200)throw Error('Use a unique synthetic marker of 16 to 200 characters.');
 const retrieval=c.retrieval??{mode:'row'};
 if(!['row','rpc'].includes(retrieval.mode))throw Error('Choose document row or reviewed retrieval function.');
 if(retrieval.mode==='rpc'&&(!/^[a-z][a-z0-9_]{0,62}$/.test(retrieval.functionName)||retrieval.reviewedReadOnly!==true))throw Error('Provide a reviewed read-only retrieval function name.');
 return {version:1,authorized:true,synthetic:true,origin:u.origin,ownerId:c.ownerId,otherId:c.otherId,bucket:c.bucket,object:c.object,table:c.table,recordId:c.recordId,marker:c.marker,retrieval:retrieval.mode==='rpc'?{mode:'rpc',functionName:retrieval.functionName,reviewedReadOnly:true}:{mode:'row'}};
}
export function supabasePrivacyAdapter(config,{publishableKey,ownerToken,otherToken,fetchImpl=fetch,signal}){
 const c=validatePrivacyConfig(config);
 for(const value of [publishableKey,ownerToken,otherToken]){
  if(typeof value!=='string'||!value||value.length>8192||/[\r\n]/.test(value))throw Error('Provide a publishable key and two test-user access tokens through environment variables.');
  let role;try{role=JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString()).role}catch{}
  if(value.startsWith('sb_secret_')||role==='service_role')throw Error('Privileged service keys must never be used for customer privacy checks.');
 }
 if(ownerToken===otherToken)throw Error('The test users must have different access tokens.');
 return async({actor,surface})=>{
  const anonymous=actor===null&&['public-file','anonymous-file'].includes(surface);
  if(!anonymous&&(![c.ownerId,c.otherId].includes(actor)||!['identity','file','retrieval'].includes(surface)))throw Error('Unknown configured check.');
  const file=['file','public-file','anonymous-file'].includes(surface);
  const retrievalRoute=c.retrieval.mode==='rpc'?`/rest/v1/rpc/${c.retrieval.functionName}?${new URLSearchParams({document_id:String(c.recordId)})}`:`/rest/v1/${c.table}?${new URLSearchParams({select:'content',id:`eq.${c.recordId}`})}`;
  const route=surface==='identity'?'/auth/v1/user':file?`/storage/v1/object/${surface==='public-file'?'public':'authenticated'}/${c.bucket}/${c.object.split('/').map(encodeURIComponent).join('/')}`:retrievalRoute;
  const res=await fetchImpl(new URL(route,c.origin),{headers:{apikey:publishableKey,...(anonymous?{}:{Authorization:`Bearer ${actor===c.ownerId?ownerToken:otherToken}`})},redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),cache:'no-store'});
  const reader=res.body?.getReader();const chunks=[];let total=0;
  if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>65536)throw Error('Synthetic response exceeds 64 KB');chunks.push(value)}}finally{await reader.cancel()}
  const text=Buffer.concat(chunks).toString('utf8');let json;try{json=JSON.parse(text)}catch{}
  const status=file&&res.status===400&&String(json?.statusCode)==='404'?404:res.status;
  return {status,body:file?text:json};
 };
}
export async function runSupabasePrivacy(config,credentials){
 const c=validatePrivacyConfig(config);
 const request=supabasePrivacyAdapter(c,credentials);
 const report=await checkDocumentPrivacy({request,owner:c.ownerId,outsider:c.otherId,marker:c.marker});
 for(const surface of ['public-file','anonymous-file']){
  let status='incomplete',reason='Owner file access was not established.';
  if(report.results.some(r=>r.id==='file-owner'&&r.status==='passed')){
   try{const r=await request({actor:null,surface});
    if(r.status===200&&r.body.includes(c.marker)){status='failed';reason='An anonymous visitor received the private synthetic marker.'}
    else if([403,404].includes(r.status)||(surface==='anonymous-file'&&r.status===401)){
     const control=await request({actor:c.ownerId,surface:'file'});
     if(control.status===200&&control.body.includes(c.marker)){status='passed';reason='This exact anonymous request was denied or hidden and owner access was rechecked.'}
     else reason='Owner access changed during the anonymous check. Not evidence of protection.';
    }
    else reason='Unexpected anonymous response; not evidence of protection.';
   }catch{reason='Anonymous file request could not complete.'}
  }
  report.results.push({id:surface,status,reason});
 }
 report.summary=Object.fromEntries(['passed','failed','incomplete'].map(s=>[s,report.results.filter(r=>r.status===s).length]));
 report.verdict=report.summary.failed?'needs-attention':report.summary.incomplete?'incomplete':'checks-passed';
 return {...report,createdAt:new Date().toISOString(),adapter:'supabase-document-privacy-v3',requirementsHash:createHash('sha256').update(JSON.stringify(c)).digest('hex'),scope:`One synthetic file, two authenticated customers and anonymous public/authenticated file URLs, with repeated controls around denials. Sequential observations are not an atomic snapshot. Retrieval: ${c.retrieval.mode==='rpc'?'reviewed GET function with document_id argument':'direct document row'}. No model answers, vector ranking, signed links or whole-app assurance.`};
}
