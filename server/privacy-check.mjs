// Experimental, bounded HTTP privacy checks. No discovery or automatic repairs.
// An adapter supplies exact authorized routes; response bodies and credentials never enter reports.
export async function checkDocumentPrivacy({request, owner, outsider, marker}) {
  if (typeof request !== 'function' || !owner || !outsider || owner === outsider || typeof marker !== 'string' || marker.length < 16) {
    throw new Error('Provide two distinct synthetic identities and a unique marker of at least 16 characters.');
  }
  const results=[];
  const add=(id,status,reason)=>results.push({id,status,reason});
  const call=async(actor,surface)=>{try{return await request({actor,surface})}catch{return {status:0,body:null}}};
  const validIdentity=async actor=>{
    const r=await call(actor,'identity');
    return r.status===200 && r.body?.id===actor;
  };
  const authenticated=(await validIdentity(owner)) && (await validIdentity(outsider));
  add('distinct-authenticated-users',authenticated?'passed':'incomplete',authenticated?'Both sessions resolved to the declared distinct users.':'Could not establish both test identities. No privacy checks were classified.');
  if(authenticated) for(const surface of ['file','retrieval']) {
    const own=await call(owner,surface);
    const extract=r=>surface==='file' ? (typeof r.body==='string'?r.body:null) :
      (Array.isArray(r.body) && r.body.every(d=>d && typeof d.content==='string') ? r.body.map(d=>d.content).join('\n'):null);
    const ownText=extract(own);
    const baseline=own.status===200 && ownText!==null && ownText.includes(marker);
    add(`${surface}-owner`,baseline?'passed':'incomplete',baseline?'The owner received the known synthetic document.':'Owner access or the synthetic marker was not verified. This cannot establish a safe denial.');
    if(!baseline){add(`${surface}-other-customer`,'incomplete','Skipped because the owner baseline was not verified.');continue;}
    const other=await call(outsider,surface);
    const otherText=extract(other);
    if(other.status===200 && otherText?.includes(marker)) add(`${surface}-other-customer`,'failed','Another customer received the private synthetic marker.');
    else if((surface==='file' && [403,404].includes(other.status)) || (surface==='retrieval' && other.status===200 && Array.isArray(other.body) && other.body.length===0)) {
      const stillAuthenticated=await validIdentity(outsider);
      const control=await call(owner,surface),controlText=extract(control);
      const stable=stillAuthenticated && control.status===200 && controlText!==null && controlText.includes(marker);
      add(`${surface}-other-customer`,stable?'passed':'incomplete',stable?'Access was denied or hidden, with the other session and owner access rechecked.':'The session or owner control changed during the check. Not evidence of protection.');
    }
    else add(`${surface}-other-customer`,'incomplete','Unexpected response, invalid session, unavailable service, or unrecognized content. Not treated as a safe denial.');
  }
  const summary=Object.fromEntries(['passed','failed','incomplete'].map(s=>[s,results.filter(r=>r.status===s).length]));
  return {version:1,scope:'Two-account synthetic document check. Exact file and retrieval routes only. No model answer, prompt injection, signed-link, revocation or whole-app assurance.',results,summary,verdict:summary.failed?'needs-attention':summary.incomplete?'incomplete':'checks-passed'};
}

// A local adapter for the self-owned fixture only. Live platform adapters need separate validation.
export function localPrivacyAdapter({origin,tokens,fetchImpl=fetch}) {
  const url=new URL(origin);
  if(url.protocol!=='http:' || url.hostname!=='127.0.0.1' || url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw new Error('The experimental fixture adapter only accepts a loopback HTTP origin.');
  return async({actor,surface})=>{
    if(!['identity','file','retrieval'].includes(surface) || !Object.hasOwn(tokens,actor)) throw new Error('Unknown fixture route or identity.');
    const response=await fetchImpl(new URL(`/privacy/${surface}`,url),{headers:{Authorization:`Bearer ${tokens[actor]}`},redirect:'error',signal:AbortSignal.timeout(3000),cache:'no-store'});
    // Bound memory and time even when Content-Length is absent or misleading.
    const reader=response.body?.getReader();let size=0;const chunks=[];
    if(reader) try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new Error('Response too large');chunks.push(value)}}finally{await reader.cancel()}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    const body=new TextDecoder().decode(bytes);
    return {status:response.status,body:surface==='file'?body:JSON.parse(body)};
  };
}
