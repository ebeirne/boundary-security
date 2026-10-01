export const alice='10000000-0000-4000-8000-000000000001',bob='20000000-0000-4000-8000-000000000002',outsider='30000000-0000-4000-8000-000000000003';
export function fixture(extra=''){
 const check=(id,operation,expected,userId,record,values={})=>({id,label:id,actor:userId===alice?'Owner':userId?'Other identity':'Visitor',role:userId?'authenticated':'anon',userId,table:'public.notes',operation,expected,match:operation==='insert'?{}:{id:record},values});
 const checks=[];
 for(const op of ['select','update','delete','insert']){
  const values=op==='update'?{body:'changed'}:{};
  checks.push(check(op+'-own',op,'allow',alice,1,op==='insert'?{id:3,owner_id:alice,body:'new'}:values));
  checks.push(check(op+'-other',op,'deny',alice,2,op==='insert'?{id:3,owner_id:bob,body:'new'}:values));
  checks.push(check(op+'-anon',op,'deny',null,1,op==='insert'?{id:3,owner_id:alice,body:'new'}:values));
 }
 checks.push(check('outsider', 'select','deny',outsider,1));
 return {name:'Direct ownership stress fixture',revision:'test',owner:'Owned synthetic fixture',authorized:true,synthetic:true,migration:`CREATE TABLE public.notes(id integer PRIMARY KEY, owner_id uuid NOT NULL, body text NOT NULL); GRANT ALL ON public.notes TO authenticated, anon; ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
 CREATE POLICY r ON public.notes FOR SELECT TO authenticated USING(owner_id=auth.uid());
 CREATE POLICY u ON public.notes FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
 CREATE POLICY d ON public.notes FOR DELETE TO authenticated USING(owner_id=auth.uid());
 CREATE POLICY i ON public.notes FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
 ${extra}`,seed:`INSERT INTO public.notes VALUES(1,'${alice}','one'),(2,'${bob}','two');`,contract:{version:1,checks}};
}

export function advancedCases(){
 const cases=[
  {name:'permissive-policy-or',project:fixture('CREATE POLICY extra_read ON public.notes FOR SELECT TO authenticated USING(true);'),failures:['select-other','outsider']},
  {name:'restrictive-policy-and',project:fixture('ALTER POLICY r ON public.notes USING(true); CREATE POLICY owner_guard ON public.notes AS RESTRICTIVE FOR SELECT TO authenticated USING(owner_id=auth.uid());'),failures:[]}
 ];
 for(const invoker of [false,true]){
  const project=fixture(`CREATE VIEW public.notes_view ${invoker?'WITH (security_invoker=true)':''} AS SELECT * FROM public.notes; GRANT ALL ON public.notes_view TO authenticated,anon;`);
  project.contract.checks=project.contract.checks.map(c=>({...c,table:'public.notes_view'}));
  cases.push({name:invoker?'invoker-view':'owner-view-bypass',project,failures:invoker?[]:['select-other','select-anon','update-other','update-anon','delete-other','delete-anon','insert-other','insert-anon','outsider']});
 }
 return cases;
}


