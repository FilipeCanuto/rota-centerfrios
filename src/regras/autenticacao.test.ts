import { describe, expect, it } from "vitest";
import {
  cadastroDeContaExistente,
  causaDoLogin,
  ehLinkDeRecuperacao,
  linkExpirado,
} from "./autenticacao";

describe("autenticação", () => {
  it("separa não confirmado, credenciais e limite", () => {
    expect(causaDoLogin({ code: "email_not_confirmed" })).toBe("nao_confirmado");
    expect(causaDoLogin({ message: "Email not confirmed" })).toBe("nao_confirmado");
    expect(causaDoLogin({ message: "Invalid login credentials" })).toBe("credenciais");
    expect(causaDoLogin({ status: 429 })).toBe("limite");
    expect(causaDoLogin({ message: "falha de rede" })).toBe("outro");
  });
  it("cadastro sem identidades é conta que já existe", () => {
    expect(cadastroDeContaExistente({ identities: [] })).toBe(true);
    expect(cadastroDeContaExistente({ identities: [{}] })).toBe(false);
    expect(cadastroDeContaExistente(null)).toBe(false);
  });
  it("reconhece o link de recuperação no hash e na consulta", () => {
    expect(ehLinkDeRecuperacao("", "#access_token=a&type=recovery")).toBe(true);
    expect(ehLinkDeRecuperacao("?type=recovery", "")).toBe(true);
    expect(ehLinkDeRecuperacao("?code=1", "#type=signup")).toBe(false);
    expect(ehLinkDeRecuperacao("", "")).toBe(false);
  });
  it("reconhece link vencido", () => {
    expect(linkExpirado("#error=access_denied&error_code=otp_expired")).toBe(true);
    expect(linkExpirado("")).toBe(false);
  });
});
