ALTER TABLE public.links ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.links ALTER COLUMN url DROP NOT NULL;
ALTER TABLE public.links
 ADD COLUMN arquivo_path text,
 ADD COLUMN mensagem_whatsapp text,
 ADD COLUMN ordem int NOT NULL DEFAULT 0,
 ADD COLUMN ativo boolean NOT NULL DEFAULT true,
 ADD CONSTRAINT links_url_ou_arquivo CHECK (nullif(btrim(url),'') IS NOT NULL OR nullif(btrim(arquivo_path),'') IS NOT NULL);
CREATE INDEX links_empresa_ordem_idx ON public.links(empresa_id, ordem);
-- Colunas novas cobertas pelos GRANTs de tabela já existentes; escrita segue restrita por RLS a diretoria/administrador.
GRANT SELECT, INSERT, UPDATE (arquivo_path,mensagem_whatsapp,ordem,ativo) ON public.links TO authenticated;

DROP POLICY leitura ON public.links;
CREATE POLICY leitura ON public.links FOR SELECT TO authenticated USING (
 (empresa_id IS NULL OR public.tem_empresa(empresa_id)) AND (ativo OR (SELECT public.eh_admin())));

-- Bucket privado "arquivos" (20 MB). Tipos permitidos verificados pela extensão do arquivo.
CREATE POLICY arquivos_ler ON storage.objects FOR SELECT TO authenticated USING (bucket_id='arquivos');
CREATE POLICY arquivos_enviar ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='arquivos' AND ((SELECT public.eh_admin()) OR (SELECT public.ve_tudo()))
 AND lower(storage.extension(name)) IN ('pdf','jpg','jpeg','png','webp'));
CREATE POLICY arquivos_substituir ON storage.objects FOR UPDATE TO authenticated
 USING (bucket_id='arquivos' AND ((SELECT public.eh_admin()) OR (SELECT public.ve_tudo())))
 WITH CHECK (bucket_id='arquivos' AND ((SELECT public.eh_admin()) OR (SELECT public.ve_tudo())) AND lower(storage.extension(name)) IN ('pdf','jpg','jpeg','png','webp'));
CREATE POLICY arquivos_apagar ON storage.objects FOR DELETE TO authenticated USING (bucket_id='arquivos' AND ((SELECT public.eh_admin()) OR (SELECT public.ve_tudo())));