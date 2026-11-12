/** E-mail como o Supabase guarda: sem espaços nas pontas e em minúsculas. */
export const normalizarEmail = (email: string) => email.trim().toLowerCase();

/** Mesma regra do gatilho do banco (cadastro só com e-mail da CENTERFRIOS ou da 381). */
export function emailDaEmpresa(email: string): boolean {
  return /^[^@\s]+@(centerfrios\.com|grupo381\.com\.br)$/.test(normalizarEmail(email));
}

/** Confere o formulário antes de ir ao servidor; devolve o erro do primeiro campo com problema. */
export function validarAcesso(
  email: string,
  senha: string | null,
): { campo: "email" | "senha"; mensagem: string } | null {
  const e = normalizarEmail(email);
  if (!e) return { campo: "email", mensagem: "Digite o seu e-mail da empresa." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    return {
      campo: "email",
      mensagem: "Confira o e-mail: ele precisa ter o formato nome@empresa.com.",
    };
  if (!emailDaEmpresa(e))
    return {
      campo: "email",
      mensagem: "Use o e-mail da empresa (@centerfrios.com ou @grupo381.com.br).",
    };
  if (senha !== null && !senha) return { campo: "senha", mensagem: "Digite a sua senha." };
  return null;
}

type ErroSupabase = {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
};
const textoDo = (e: ErroSupabase) => `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();

export type CausaLogin = "nao_confirmado" | "credenciais" | "limite" | "outro";

/** Separa as causas que o Supabase devolve no login com senha (o código vale mais que o texto). */
export function causaDoLogin(e: ErroSupabase): CausaLogin {
  const texto = textoDo(e);
  if (/email_not_confirmed|not confirmed/.test(texto)) return "nao_confirmado";
  if (/invalid_credentials|invalid login/.test(texto)) return "credenciais";
  if (e.status === 429 || /rate_limit|too many/.test(texto)) return "limite";
  return "outro";
}

export const MENSAGEM_LOGIN: Record<CausaLogin, string> = {
  nao_confirmado:
    "Seu e-mail ainda não foi confirmado. Use “Receber link de acesso”: o link confirma o e-mail e já entra.",
  credenciais:
    "E-mail ou senha incorretos. Se é o seu primeiro acesso, se esqueceu a senha ou se sempre entrou com o Google, use “Receber link de acesso”.",
  limite: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  outro: "Não foi possível entrar agora. Confira a conexão e tente de novo.",
};

export type CausaLink = "limite" | "sem_convite" | "outro";

/** Erros ao pedir o link de acesso por e-mail. */
export function causaDoLink(e: ErroSupabase): CausaLink {
  const texto = textoDo(e);
  if (e.status === 429 || /rate_limit|too many|security purposes/.test(texto)) return "limite";
  // O gatilho do banco recusa quem não foi convidado; o Supabase devolve "Database error…".
  if (
    /database error|ainda não foi liberado|acesso restrito|signups not allowed|not allowed/.test(
      texto,
    )
  )
    return "sem_convite";
  return "outro";
}

export const MENSAGEM_LINK: Record<CausaLink, string> = {
  limite: "Já enviamos um link há pouco. Aguarde um minuto e confira também a caixa de spam.",
  sem_convite:
    "Seu acesso ainda não foi liberado. Peça ao administrador para cadastrar este e-mail.",
  outro: "Não foi possível enviar o link agora. Tente de novo em alguns minutos.",
};

/**
 * Links enviados por e-mail (acesso, confirmação, convite ou recuperação) trazem `type=` no endereço.
 * Todos levam à tela "Crie sua senha", que também deixa seguir sem criar.
 */
export function ehLinkDeAcesso(busca: string, hash: string): boolean {
  return /(^|[?&#])type=(recovery|magiclink|signup|invite)(&|$)/.test(
    `${busca}&${hash.replace(/^#/, "")}`,
  );
}

/** Link de e-mail vencido ou já usado: o Supabase volta com `error_code=otp_expired`. */
export function linkExpirado(texto: string): boolean {
  return /otp_expired|access_denied/.test(texto);
}

/** Erros de senha nova devolvidos pelo Supabase, em português. */
export function mensagemSenhaNova(msg: string): string {
  if (/different from the old|same/i.test(msg))
    return "A nova senha precisa ser diferente da anterior.";
  if (/weak|short|characters|pwned|leaked/i.test(msg))
    return "Essa senha é fraca ou já apareceu em vazamentos. Use pelo menos 8 caracteres, misturando letras e números.";
  if (/session|jwt|expired/i.test(msg)) return "O link expirou. Peça um novo link de acesso.";
  return "Não foi possível salvar a senha. Tente de novo.";
}
