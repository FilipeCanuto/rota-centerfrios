import { describe, expect, it } from "vitest";
import { destinoAposLogin, setorDaRota, validarAcessos } from "./setores";

describe("destinoAposLogin", () => {
  const disp = ["comercial", "rh"];
  it("sem setor liberado: sem acesso", () => {
    expect(destinoAposLogin([], disp)).toEqual({ tipo: "sem_acesso" });
  });
  it("setor liberado mas indisponível não conta", () => {
    expect(destinoAposLogin(["financeiro"], disp)).toEqual({ tipo: "sem_acesso" });
    expect(destinoAposLogin(["comercial", "financeiro"], disp)).toEqual({
      tipo: "direto",
      setor: "comercial",
    });
  });
  it("um setor: vai direto", () => {
    expect(destinoAposLogin(["rh"], disp)).toEqual({ tipo: "direto", setor: "rh" });
  });
  it("dois setores: escolhe, salvo escolha lembrada ainda válida", () => {
    expect(destinoAposLogin(["rh", "comercial"], disp)).toEqual({
      tipo: "escolher",
      setores: ["comercial", "rh"],
    });
    expect(destinoAposLogin(["rh", "comercial"], disp, "rh")).toEqual({
      tipo: "direto",
      setor: "rh",
    });
    expect(destinoAposLogin(["comercial", "rh"], disp, "compras").tipo).toBe("escolher");
  });
});

describe("setorDaRota", () => {
  const rotas = { comercial: ["/inicio", "/clientes", "/configuracoes/feriados"], rh: ["/rh"] };
  it("acha o setor pelo prefixo, sem confundir nomes parecidos", () => {
    expect(setorDaRota("/clientes/123", rotas)).toBe("comercial");
    expect(setorDaRota("/rh", rotas)).toBe("rh");
    expect(setorDaRota("/rhx", rotas)).toBeNull();
  });
  it("telas comuns não pertencem a setor", () => {
    expect(setorDaRota("/configuracoes", rotas)).toBeNull();
    expect(setorDaRota("/configuracoes/feriados", rotas)).toBe("comercial");
  });
});

describe("validarAcessos", () => {
  const ok = {
    nome: "Ana",
    email: "ana@centerfrios.com",
    papeis: ["vendedor"],
    empresas: ["e1"],
    setores: ["comercial"],
  };
  it("aceita o cadastro completo", () => expect(validarAcessos(ok)).toBeNull());
  it("exige pelo menos um setor", () =>
    expect(validarAcessos({ ...ok, setores: [] })?.campo).toBe("setores"));
  it("recusa e-mail de fora da empresa", () =>
    expect(validarAcessos({ ...ok, email: "ana@gmail.com" })?.campo).toBe("email"));
});
