CREATE TABLE public.feriados (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid REFERENCES public.empresas(id),
 data date NOT NULL,
 nome text NOT NULL,
 abrangencia text NOT NULL CONSTRAINT feriados_abrangencia_valida CHECK (abrangencia IN ('nacional','estadual','municipal')),
 localidade text,
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT feriados_empresa_data_unico UNIQUE NULLS NOT DISTINCT (empresa_id,data)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.feriados TO authenticated;
GRANT ALL ON public.feriados TO service_role;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.feriados FOR SELECT TO authenticated USING (empresa_id IS NULL OR public.tem_empresa(empresa_id));
CREATE POLICY inserir ON public.feriados FOR INSERT TO authenticated WITH CHECK (public.ve_tudo());
CREATE POLICY alterar ON public.feriados FOR UPDATE TO authenticated USING (public.ve_tudo()) WITH CHECK (public.ve_tudo());
CREATE POLICY apagar ON public.feriados FOR DELETE TO authenticated USING (public.ve_tudo());
CREATE INDEX feriados_data_idx ON public.feriados(data);
CREATE TRIGGER auditar_feriados AFTER INSERT OR UPDATE OR DELETE ON public.feriados FOR EACH ROW EXECUTE FUNCTION public.auditoria_alteracao('alteracao_feriado');
COMMENT ON TABLE public.feriados IS 'Calendário comercial. Empresa nula vale para ambas. Carga inicial: somente os 20 feriados nacionais fornecidos para 2026 e 2027, inseridos pela ferramenta de dados; estaduais, municipais e pontos facultativos são cadastrados posteriormente pela diretoria.';