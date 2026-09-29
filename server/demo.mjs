export const ALICE='11111111-1111-4111-8111-111111111111';
export const BOB='22222222-2222-4222-8222-222222222222';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D1='dddddddd-dddd-4ddd-8ddd-dddddddddd01',D2='dddddddd-dddd-4ddd-8ddd-dddddddddd02';
export const demoMigration=`-- Owned demonstration. Intentionally broad read/update policies.
CREATE TABLE public.memberships (user_id uuid NOT NULL, org_id uuid NOT NULL, PRIMARY KEY(user_id,org_id));
CREATE TABLE public.documents (id uuid PRIMARY KEY, org_id uuid NOT NULL, title text NOT NULL);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
CREATE POLICY own_membership ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY read_documents ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY update_documents ON public.documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY insert_documents ON public.documents FOR INSERT TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY delete_documents ON public.documents FOR DELETE TO authenticated USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));`;
export const demoPatch=`-- Repair for the owned demo only. Review before adapting to another app.
DROP POLICY read_documents ON public.documents;
CREATE POLICY read_documents ON public.documents FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
DROP POLICY update_documents ON public.documents;
CREATE POLICY update_documents ON public.documents FOR UPDATE TO authenticated
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));`;
const check=(id,label,userId,operation,expected,doc=D1,values={})=>({id,label,actor:userId?'Alice · Northstar':'Visitor',role:userId?'authenticated':'anon',userId,table:'public.documents',operation,expected,match:operation==='insert'?{}:{id:doc},values});
export function demoProject() {return {id:'demo',name:'Northstar client portal',revision:'demo-v1',owner:'Owned local demonstration',authorized:true,synthetic:true,isDemo:true,migration:demoMigration,seed:`INSERT INTO public.memberships VALUES ('${ALICE}','${A}'),('${BOB}','${B}');
INSERT INTO public.documents VALUES ('${D1}','${A}','Northstar brief'),('${D2}','${B}','Orbit brief');`,contract:{version:1,checks:[
check('read-own','Read own organization’s document',ALICE,'select','allow'),
check('read-other','Read another organization’s document',ALICE,'select','deny',D2),
check('read-anon','Read private documents without signing in',null,'select','deny'),
check('update-own','Edit own organization’s document',ALICE,'update','allow',D1,{title:'Updated synthetic brief'}),
check('update-other','Edit another organization’s document',ALICE,'update','deny',D2,{title:'Unauthorized synthetic edit'}),
check('update-anon','Edit a document without signing in',null,'update','deny',D1,{title:'Anonymous synthetic edit'}),
check('delete-own','Delete own organization’s document',ALICE,'delete','allow'),
check('delete-other','Delete another organization’s document',ALICE,'delete','deny',D2),
check('insert-own','Create a document for own organization',ALICE,'insert','allow',null,{id:'dddddddd-dddd-4ddd-8ddd-dddddddddd03',org_id:A,title:'New synthetic brief'}),
check('insert-other','Create a document for another organization',ALICE,'insert','deny',null,{id:'dddddddd-dddd-4ddd-8ddd-dddddddddd03',org_id:B,title:'New synthetic brief'})
]}};}
