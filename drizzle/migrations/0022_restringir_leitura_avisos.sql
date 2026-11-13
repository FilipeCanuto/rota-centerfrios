DROP POLICY IF EXISTS avisos_ler ON public.avisos;
CREATE POLICY avisos_ler ON public.avisos FOR SELECT TO authenticated
  USING ((SELECT public.meu_usuario_id()) IS NOT NULL AND (
    (SELECT public.pode_publicar_avisos())
    OR (ativo AND (inicio IS NULL OR inicio <= now()) AND (fim IS NULL OR fim >= now()))
  ));
DROP POLICY IF EXISTS avisos_arquivos_ler ON storage.objects;
CREATE POLICY avisos_arquivos_ler ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avisos' AND (SELECT public.meu_usuario_id()) IS NOT NULL AND (
    (SELECT public.pode_publicar_avisos())
    OR EXISTS (SELECT 1 FROM public.avisos a WHERE a.arquivo_path = storage.objects.name)
  ));