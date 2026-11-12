DROP POLICY IF EXISTS arquivos_ler ON storage.objects;
CREATE POLICY arquivos_ler ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'arquivos' AND (SELECT public.meu_usuario_id()) IS NOT NULL);