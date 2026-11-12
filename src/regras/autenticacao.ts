export type CausaLogin = "nao_confirmado" | "credenciais" | "limite" | "outro";

/** Separa as causas que o Supabase devolve no login com senha (o código vale mais que o texto). */
export function causaDoLogin(e: {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
}) {
  const texto = `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();
  if (/email_not_confirmed|not confirmed/.test(texto)) return "nao_confirmado" as const;
  if (/invalid_credentials|invalid login/.test(texto)) return "credenciais" as const;
  if (e.status === 429 || /rate_limit|too many/.test(texto)) return "limite" as const;
  return "outro" as const;
}

export const MENSAGEM_LOGIN: Record<CausaLogin, string> = {
  nao_confirmado:
    "Seu e-mail ainda não foi confirmado. Abra o link que enviamos ao criar a senha ou peça um novo abaixo.",
  credenciais:
    "E-mail ou senha incorretos. Se você sempre entrou com o Google, ainda não tem senha: use “Esqueci minha senha” para criar uma.",
  limite: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  outro: "Não foi possível entrar agora. Confira a conexão e tente de novo.",
};

/**
 * Cadastro de e-mail que já existe: o Supabase responde "sucesso" sem enviar nada
 * e devolve o usuário sem identidades. Não é um cadastro novo.
 */
export function cadastroDeContaExistente(user: { identities?: unknown[] | null } | null) {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

/** O link de recuperação de senha traz `type=recovery` no endereço (hash ou consulta). */
export function ehLinkDeRecuperacao(busca: string, hash: string): boolean {
  return /(^|[?&#])type=recovery(&|$)/.test(`${busca}&${hash.replace(/^#/, "")}`);
}

/** Link de e-mail vencido ou já usado: o Supabase volta com `error_code=otp_expired`. */
export function linkExpirado(texto: string): boolean {
  return /otp_expired|access_denied/.test(texto);
}
