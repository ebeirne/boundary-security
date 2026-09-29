-- Repair for the owned demo only. Review before adapting to another app.
DROP POLICY read_documents ON public.documents;
CREATE POLICY read_documents ON public.documents FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));
DROP POLICY update_documents ON public.documents;
CREATE POLICY update_documents ON public.documents FOR UPDATE TO authenticated
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));