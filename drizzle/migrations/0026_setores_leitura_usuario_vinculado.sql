DROP POLICY IF EXISTS setores_ler ON public.setores;
CREATE POLICY setores_ler ON public.setores FOR SELECT TO authenticated
USING ((SELECT public.meu_usuario_id()) IS NOT NULL);