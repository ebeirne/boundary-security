// Owned, invented agency portal. Expectations are specified independently of policies.
const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222', viewer='33333333-3333-4333-8333-333333333333', revoked='44444444-4444-4444-8444-444444444444';
const member="tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id=auth.uid() AND active)";
const editor="tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id=auth.uid() AND active AND permission='editor')";
export function realisticProject(){
 const checks=[];
 const add=(id,user,operation,expected,record,values={})=>checks.push({id,label:id.replaceAll('-',' '),actor:({[alice]:'Alice / Acme editor',[bob]:'Bob / Orbit editor',[viewer]:'Acme viewer',[revoked]:'Revoked Acme member'})[user]??'Anonymous visitor',role:user?'authenticated':'anon',userId:user,table:'public.documents',operation,expected,match:operation==='insert'?{}:{id:record},values});
 add('alice-read-own',alice,'select','allow',1);
 add('alice-read-orbit',alice,'select','deny',2);
 add('bob-read-own',bob,'select','allow',2);
 add('bob-read-acme',bob,'select','deny',1);
 add('viewer-read-acme',viewer,'select','allow',1);
 add('revoked-read-acme',revoked,'select','deny',1);
 add('anonymous-read-acme',null,'select','deny',1);
 add('alice-edit-own',alice,'update','allow',1,{title:'Edited synthetic title'});
 add('alice-edit-orbit',alice,'update','deny',2,{title:'Wrong tenant'});
 add('viewer-edit-acme',viewer,'update','deny',1,{title:'Viewer must not write'});
 add('revoked-edit-acme',revoked,'update','deny',1,{title:'Revoked member must not write'});
 add('alice-transfer-tenant',alice,'update','deny',1,{tenant_id:20});
 add('alice-delete-own',alice,'delete','allow',1);
 add('alice-delete-orbit',alice,'delete','deny',2);
 add('alice-create-own',alice,'insert','allow',null,{id:3,tenant_id:10,title:'New synthetic document'});
 add('alice-create-orbit',alice,'insert','deny',null,{id:3,tenant_id:20,title:'Wrong tenant'});
 add('viewer-create-acme',viewer,'insert','deny',null,{id:3,tenant_id:10,title:'Viewer insert'});
 return {name:'Synthetic agency portal',revision:'secure-v1',owner:'Boundary synthetic lab',authorized:true,synthetic:true,contract:{version:1,checks},migration:`
 CREATE TABLE public.memberships(user_id uuid,tenant_id integer,permission text,active boolean,PRIMARY KEY(user_id,tenant_id));
 CREATE TABLE public.documents(id integer PRIMARY KEY,tenant_id integer NOT NULL,title text NOT NULL);
 ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
 ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.memberships TO authenticated;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.documents TO authenticated;
 CREATE POLICY memberships_self ON public.memberships FOR SELECT TO authenticated USING(user_id=auth.uid());
 CREATE POLICY documents_read ON public.documents FOR SELECT TO authenticated USING(${member});
 CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated USING(${editor}) WITH CHECK(${editor});
 CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK(${editor});
 CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated USING(${editor});`,seed:`
 INSERT INTO public.memberships VALUES ('${alice}',10,'editor',true),('${bob}',20,'editor',true),('${viewer}',10,'viewer',true),('${revoked}',10,'editor',false);
 INSERT INTO public.documents VALUES(1,10,'Acme invented brief'),(2,20,'Orbit invented brief');`};
}
export const realisticScenarios=[
 {id:'secure',failed:[],errors:[],mutate:p=>p},
 {id:'permissive-policy-regression',failed:['alice-read-orbit','bob-read-acme','revoked-read-acme'],errors:[],mutate:p=>{p.migration+='CREATE POLICY accidental_read ON public.documents FOR SELECT TO authenticated USING(true);';return p}},
 {id:'viewer-write-regression',failed:['viewer-edit-acme'],errors:[],mutate:p=>{p.migration+=`DROP POLICY documents_update ON public.documents; CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated USING(${member}) WITH CHECK(${member});`;return p}},
 {id:'update-check-weakened-read-still-protects',failed:[],errors:[],mutate:p=>{p.migration=p.migration.replace(`WITH CHECK(${editor});`,`WITH CHECK(true);`);return p}},
 {id:'tenant-transfer-regression',failed:['alice-read-orbit','bob-read-acme','revoked-read-acme','alice-transfer-tenant'],errors:[],mutate:p=>{p.migration=p.migration.replace(`WITH CHECK(${editor});`,`WITH CHECK(true);`);p.migration+='CREATE POLICY accidental_read ON public.documents FOR SELECT TO authenticated USING(true);';return p}},
 {id:'revoked-membership-regression',failed:['revoked-read-acme','revoked-edit-acme'],errors:[],mutate:p=>{p.migration=p.migration.replaceAll(' AND active','');return p}},
 {id:'blanket-deny-not-a-fix',failed:['alice-read-own','bob-read-own','viewer-read-acme','alice-edit-own','alice-delete-own','alice-create-own'],errors:[],mutate:p=>{p.migration+='REVOKE ALL ON public.documents FROM authenticated;';return p}},
 {id:'missing-record-not-a-pass',failed:[],errors:['alice-read-orbit'],mutate:p=>{p.contract.checks.find(c=>c.id==='alice-read-orbit').match.id=999;return p}},
 {id:'constraint-error-not-a-denial',failed:[],errors:['alice-create-orbit'],mutate:p=>{const c=p.contract.checks.find(c=>c.id==='alice-create-orbit');c.values={id:3,tenant_id:10,title:null};return p}}
];
