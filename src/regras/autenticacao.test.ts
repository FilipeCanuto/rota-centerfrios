import { describe, expect, it } from "vitest";
import {
  causaDoLink,
  causaDoLogin,
  ehLinkDeAcesso,
  emailDaEmpresa,
  linkExpirado,
  mensagemSenhaNova,
  normalizarEmail,
  validarAcesso,
} from "./autenticacao";

describe("autenticação", () => {
  it("normaliza e confere o domínio da empresa", () => {
    expect(normalizarEmail("  Clara@CenterFrios.com ")).toBe("clara@centerfrios.com");
    expect(emailDaEmpresa(" Clara@CenterFrios.com")).toBe(true);
    expect(emailDaEmpresa("vendas@grupo381.com.br")).toBe(true);
    expect(emailDaEmpresa("clara@gmail.com")).toBe(false);
    expect(emailDaEmpresa("clara@centerfrios.com.br")).toBe(false);
  });
  it("valida o formulário campo a campo", () => {
    expect(validarAcesso("", "x")?.campo).toBe("email");
    expect(validarAcesso("clara", "x")?.mensagem).toMatch(/formato/);
    expect(validarAcesso("clara@gmail.com", "x")?.mensagem).toMatch(/e-mail da empresa/);
    expect(validarAcesso("clara@centerfrios.com", "")?.campo).toBe("senha");
    expect(validarAcesso("clara@centerfrios.com", null)).toBeNull();
    expect(validarAcesso("clara@centerfrios.com", "segredo")).toBeNull();
  });
  it("separa não confirmado, credenciais e limite no login", () => {
    expect(causaDoLogin({ code: "email_not_confirmed" })).toBe("nao_confirmado");
    expect(causaDoLogin({ message: "Invalid login credentials" })).toBe("credenciais");
    expect(causaDoLogin({ status: 429 })).toBe("limite");
    expect(causaDoLogin({ message: "falha de rede" })).toBe("outro");
  });
  it("separa limite e convite ao pedir o link", () => {
    expect(causaDoLink({ status: 429, code: "over_email_send_rate_limit" })).toBe("limite");
    expect(
      causaDoLink({
        message: "For security purposes, you can only request this after 42 seconds.",
      }),
    ).toBe("limite");
    expect(causaDoLink({ status: 500, message: "Database error saving new user" })).toBe(
      "sem_convite",
    );
    expect(causaDoLink({ message: "Signups not allowed for otp" })).toBe("sem_convite");
    expect(causaDoLink({ message: "erro qualquer" })).toBe("outro");
  });
  it("reconhece os links de e-mail (acesso, confirmação, convite, recuperação)", () => {
    expect(ehLinkDeAcesso("", "#access_token=a&type=recovery")).toBe(true);
    expect(ehLinkDeAcesso("", "#access_token=a&type=magiclink")).toBe(true);
    expect(ehLinkDeAcesso("?type=signup", "")).toBe(true);
    expect(ehLinkDeAcesso("", "#type=email_change")).toBe(false);
    expect(ehLinkDeAcesso("", "")).toBe(false);
  });
  it("reconhece link vencido", () => {
    expect(linkExpirado("#error=access_denied&error_code=otp_expired")).toBe(true);
    expect(linkExpirado("")).toBe(false);
  });
  it("traduz erros de senha nova", () => {
    expect(mensagemSenhaNova("New password should be different from the old password.")).toMatch(
      /diferente/,
    );
    expect(mensagemSenhaNova("Password is known to be weak and easy to guess")).toMatch(/fraca/);
  });
});
