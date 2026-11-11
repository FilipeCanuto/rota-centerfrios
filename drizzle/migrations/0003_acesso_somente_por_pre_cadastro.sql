-- Convites (sem tela nesta etapa): o administrador cria public.usuarios com o
-- e-mail corporativo da pessoa e auth_user_id NULL; cria os vínculos desejados em
-- public.usuario_empresas e os papéis em public.papeis_pre_cadastro.
-- Depois, a pessoa entra com Google ou cria sua senha em "Primeiro acesso" usando
-- o mesmo e-mail. Cadastro permanece habilitado; confirmação por e-mail permanece
-- obrigatória para senha. O gatilho recusa qualquer criação sem pré-cadastro.
-- Esta migração não altera contas, papéis ou vínculos de usuários existentes.

CREATE TABLE public.papeis_pre_cadastro (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  origem public.origem_dado NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT papeis_pre_cadastro_unico UNIQUE NULLS NOT DISTINCT (usuario_id, role, empresa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papeis_pre_cadastro TO authenticated;
GRANT ALL ON public.papeis_pre_cadastro TO service_role;
ALTER TABLE public.papeis_pre_cadastro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "administrador gerencia papéis pré-cadastro"
  ON public.papeis_pre_cadastro FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

COMMENT ON TABLE public.papeis_pre_cadastro IS
  'Papéis pendentes definidos somente pelo administrador; consumidos atomicamente no primeiro cadastro autorizado.';
COMMENT ON COLUMN public.papeis_pre_cadastro.empresa_id IS
  'NULL = todas as empresas. Os vínculos de acesso são definidos em usuario_empresas; user_roles mantém o modelo existente de papéis globais, sem empresa_id.';

CREATE OR REPLACE FUNCTION public.ao_criar_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_usuario_id uuid;
BEGIN
  IF new.email IS NULL OR lower(new.email) !~ '^[^@]+@(centerfrios\.com|grupo381\.com\.br)$' THEN
    RAISE EXCEPTION 'Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora.';
  END IF;

  SELECT u.id INTO v_usuario_id
  FROM public.usuarios AS u
  WHERE lower(u.email) = lower(new.email)
    AND u.auth_user_id IS NULL
  ORDER BY u.id
  LIMIT 1
  FOR UPDATE;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Seu acesso ainda não foi liberado. Peça o convite ao administrador.';
  END IF;

  UPDATE public.usuarios
  SET auth_user_id = new.id
  WHERE id = v_usuario_id;

  -- Consome somente os papéis pré-definidos, sem atribuir privilégios implícitos.
  -- A vinculação, a cópia e o consumo são parte da mesma transação do cadastro.
  WITH papeis_consumidos AS (
    DELETE FROM public.papeis_pre_cadastro
    WHERE usuario_id = v_usuario_id
    RETURNING role
  )
  INSERT INTO public.user_roles (user_id, role)
  SELECT DISTINCT new.id, role FROM papeis_consumidos
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.ao_criar_usuario() FROM PUBLIC, anon, authenticated;
