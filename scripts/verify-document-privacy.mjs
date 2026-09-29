// Invoked only after verify-supabase validates the disposable container and loopback API.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runSupabasePrivacy} from '../server/supabase-privacy.mjs';

export async function verifyDocumentPrivacy({base,key,sql,alice,bob}){
 if(base.origin!=='http://127.0.0.1:54321')throw Error('Disposable local Supabase only.');
 const bucket='boundary-private-documents',object=`${alice.id}/synthetic.txt`,marker=`BOUNDARY_SYNTHETIC_${randomUUID()}`;
 async function http(route,token,method='GET',body){
  const r=await fetch(new URL(route,base),{method,headers:{apikey:key,...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'text/plain'},body,redirect:'error',signal:AbortSignal.timeout(15000)});
  const text=await r.text();let json;try{json=JSON.parse(text)}catch{}
  return {status:r.status,text,json};
 }
 sql(`INSERT INTO storage.buckets(id,name,public) VALUES('${bucket}','${bucket}',false);
 CREATE POLICY boundary_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='${bucket}' AND (storage.foldername(name))[1]=auth.uid()::text);
 CREATE POLICY boundary_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='${bucket}' AND (storage.foldername(name))[1]=auth.uid()::text);
 CREATE TABLE public.boundary_document_chunks(id integer PRIMARY KEY, owner_id uuid NOT NULL, content text NOT NULL);
 ALTER TABLE public.boundary_document_chunks ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.boundary_document_chunks TO authenticated;
 CREATE POLICY boundary_chunks_read ON public.boundary_document_chunks FOR SELECT TO authenticated USING(owner_id=auth.uid());
 INSERT INTO public.boundary_document_chunks VALUES(1,'${alice.id}','${marker}');
 NOTIFY pgrst, 'reload schema';`);
 const upload=await http(`/storage/v1/object/${bucket}/${object}`,alice.token,'POST',marker);
 assert.equal(upload.status,200,'Synthetic owner upload must succeed');
 for(let i=0;i<30;i++){
  const ready=await http('/rest/v1/boundary_document_chunks?select=content&id=eq.1',alice.token);
  if(ready.status===200)break;
  if(ready.status!==404||i===29)throw Error('Document fixture schema not ready');
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 const config={version:1,authorized:true,synthetic:true,origin:base.origin,ownerId:alice.id,otherId:bob.id,bucket,object,table:'boundary_document_chunks',recordId:1,marker};
 const phases=[];
 async function run(phase,expectedFailures){
  const report=await runSupabasePrivacy(config,{publishableKey:key,ownerToken:alice.token,otherToken:bob.token});
  phases.push({phase,...report});
  assert.equal(report.summary.incomplete,0,`${phase}: unexpected incomplete response`);
  assert.deepEqual(report.results.filter(r=>r.status==='failed').map(r=>r.id),expectedFailures);
 }
 await run('secure',[]);
 sql(`ALTER POLICY boundary_file_read ON storage.objects USING(bucket_id='${bucket}');`);
 await run('file-policy-regression',['file-other-customer']);
 sql('ALTER POLICY boundary_chunks_read ON public.boundary_document_chunks USING(true);');
 await run('combined-regression',['file-other-customer','retrieval-other-customer']);
 sql(`ALTER POLICY boundary_file_read ON storage.objects USING(bucket_id='${bucket}' AND (storage.foldername(name))[1]=auth.uid()::text);
 ALTER POLICY boundary_chunks_read ON public.boundary_document_chunks USING(owner_id=auth.uid());`);
 await run('repaired',[]);
 const privateAnon=await http(`/storage/v1/object/public/${bucket}/${object}`);
 assert.notEqual(privateAnon.text,marker,'Private bucket must not expose the synthetic file anonymously');
 assert([400,403,404].includes(privateAnon.status),'Private anonymous access must be explicitly denied');
 sql(`UPDATE storage.buckets SET public=true WHERE id='${bucket}';`);
 // Real Storage serving bypasses read policies for public buckets on these routes.
 // Run 36623418514 observed all three exposures; the checker correctly failed them.
 await run('public-bucket-regression',['file-other-customer','public-file','anonymous-file']);
 const publicAnon=await http(`/storage/v1/object/public/${bucket}/${object}`);
 assert.equal(publicAnon.status,200);assert.equal(publicAnon.text,marker,'Public bucket mutation must expose the known marker');
 sql(`UPDATE storage.buckets SET public=false WHERE id='${bucket}';`);
 await run('private-bucket-restored',[]);
 const restoredAnon=await http(`/storage/v1/object/public/${bucket}/${object}`);
 assert([400,403,404].includes(restoredAnon.status));assert.notEqual(restoredAnon.text,marker);
 sql(`CREATE FUNCTION public.boundary_retrieve_document(document_id integer) RETURNS TABLE(content text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS 'SELECT d.content FROM public.boundary_document_chunks d WHERE d.id=document_id';
 REVOKE ALL ON FUNCTION public.boundary_retrieve_document(integer) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.boundary_retrieve_document(integer) TO authenticated;
 NOTIFY pgrst, 'reload schema';`);
 for(let i=0;i<30;i++){const ready=await http('/rest/v1/rpc/boundary_retrieve_document?document_id=1',alice.token);if(ready.status===200)break;if(ready.status!==404||i===29)throw Error('Retrieval function unavailable');await new Promise(r=>setTimeout(r,500))}
 config.retrieval={mode:'rpc',functionName:'boundary_retrieve_document',reviewedReadOnly:true};
 await run('retrieval-function-secure',[]);
 sql('ALTER FUNCTION public.boundary_retrieve_document(integer) SECURITY DEFINER;');
 await run('privileged-retrieval-function',['retrieval-other-customer']);
 sql('ALTER FUNCTION public.boundary_retrieve_document(integer) SECURITY INVOKER;');
 await run('retrieval-function-repaired',[]);
 return {scope:'Real disposable Supabase Auth, Storage, row retrieval and GET retrieval function including owner-privilege bypass. No vector ranking, LLM answers, signed links or customer environment.',phases,anonymousPublicBucket:{privateDenied:true,publicMutationDetected:true,privateRestored:true},ok:true};
}
