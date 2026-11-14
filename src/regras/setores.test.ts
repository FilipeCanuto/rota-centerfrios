import { describe, expect, it } from "vitest";
import {
  chaveDoSetor,
  chavesDisponiveis,
  destinoAposLogin,
  setorDaRota,
  validarAcessos,
  validarSetor,
} from "./setores";

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

describe("catálogo de setores", () => {
  const l = (chave: string, ativo: boolean, disponivel: boolean) => ({
    chave,
    nome: chave,
    icone: null,
    ativo,
    disponivel,
  });
  it("só entra setor ativo, disponível e com módulo no código", () => {
    const linhas = [
      l("comercial", true, true),
      l("rh", true, false),
      l("fiscal", true, true),
      l("x", false, true),
    ];
    expect(chavesDisponiveis(linhas, ["comercial", "x"])).toEqual(["comercial"]);
  });
  it("gera a chave sem acento e valida", () => {
    expect(chaveDoSetor("Logística Sul")).toBe("logistica_sul");
    expect(validarSetor("Logística Sul", "logistica_sul")).toBeNull();
    expect(validarSetor("A", "a")).not.toBeNull();
    expect(validarSetor("123", chaveDoSetor("123"))).not.toBeNull();
  });
});
