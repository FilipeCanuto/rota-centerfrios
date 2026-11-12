import { describe, expect, it } from "vitest";
import {
  cantoMaisProximo,
  cantoValido,
  enfileirar,
  estadoEfetivo,
  EXPEDIENTE_PADRAO,
  esperaDaFila,
  FILA_VAZIA,
  foraDoExpediente,
  normalizarEstado,
  permanenciaMs,
  proximaFala,
  type Fala,
} from "./index";

const fala = (id: string, prioridade: Fala["prioridade"], extra: Partial<Fala> = {}): Fala => ({
  id,
  tipo: "teste",
  prioridade,
  texto: `Fala ${id}`,
  ...extra,
});
const INTERVALO = 20_000;

describe("estados do mascote", () => {
  it("aceita os estados do mapa", () => {
    expect(normalizarEstado("comemorando")).toBe("comemorando");
    expect(normalizarEstado("descanso")).toBe("descanso");
  });
  it("estado desconhecido, vazio ou de outro tipo cai em neutro", () => {
    for (const e of ["dancando", "", undefined, null, 3, "toString", "__proto__"])
      expect(normalizarEstado(e)).toBe("neutro");
  });
});

describe("fila de balões", () => {
  it("ordena por prioridade e mantém a ordem de chegada no empate", () => {
    let f = FILA_VAZIA;
    for (const x of [
      fala("i1", "informativo"),
      fala("imp1", "importante"),
      fala("u1", "urgente"),
      fala("imp2", "importante"),
    ])
      f = enfileirar(f, x);
    expect(f.pendentes.map((p) => p.id)).toEqual(["u1", "imp1", "imp2", "i1"]);
  });

  it("não repete o mesmo id, nem depois de já ter sido mostrado", () => {
    let f = enfileirar(FILA_VAZIA, fala("a", "informativo"));
    expect(enfileirar(f, fala("a", "urgente"))).toBe(f);
    f = proximaFala(f, 1000, INTERVALO).fila;
    expect(enfileirar(f, fala("a", "informativo")).pendentes).toHaveLength(0);
  });

  it("prioridade inválida vira informativo", () => {
    const f = enfileirar(FILA_VAZIA, fala("a", "qualquer" as Fala["prioridade"]));
    expect(f.pendentes[0]?.prioridade).toBe("informativo");
  });

  it("respeita o limite de frequência entre balões comuns", () => {
    let f = enfileirar(enfileirar(FILA_VAZIA, fala("a", "importante")), fala("b", "informativo"));
    const primeira = proximaFala(f, 1000, INTERVALO);
    expect(primeira.fala?.id).toBe("a");
    f = primeira.fila;
    expect(proximaFala(f, 1000 + INTERVALO - 1, INTERVALO).fala).toBeNull();
    expect(esperaDaFila(f, 6000, INTERVALO)).toBe(15_000);
    expect(proximaFala(f, 1000 + INTERVALO, INTERVALO).fala?.id).toBe("b");
  });

  it("urgente fura o limite de frequência", () => {
    let f = enfileirar(FILA_VAZIA, fala("a", "informativo"));
    f = proximaFala(f, 1000, INTERVALO).fila;
    f = enfileirar(f, fala("u", "urgente"));
    expect(esperaDaFila(f, 1500, INTERVALO)).toBe(0);
    expect(proximaFala(f, 1500, INTERVALO).fala?.id).toBe("u");
  });

  it("descarta falas vencidas e devolve null com a fila vazia", () => {
    const f = enfileirar(FILA_VAZIA, fala("velha", "urgente", { expiraEm: 500 }));
    const r = proximaFala(f, 1000, INTERVALO);
    expect(r.fala).toBeNull();
    expect(r.fila.pendentes).toHaveLength(0);
    expect(esperaDaFila(r.fila, 1000, INTERVALO)).toBeNull();
  });
});

describe("tempo, expediente e cantos", () => {
  it("permanência cresce com o texto e respeita o piso", () => {
    expect(permanenciaMs("Oi", 70, 5000)).toBe(5000);
    expect(permanenciaMs("x".repeat(90), 70, 5000)).toBe(6300);
  });
  it("fora do expediente: antes, depois, domingo, feriado e sábado à tarde", () => {
    const e = EXPEDIENTE_PADRAO;
    expect(foraDoExpediente("07:59", 2, false, e)).toBe(true);
    expect(foraDoExpediente("08:00:00", 2, false, e)).toBe(false);
    expect(foraDoExpediente("18:00", 2, false, e)).toBe(true);
    expect(foraDoExpediente("10:00", 0, false, e)).toBe(true);
    expect(foraDoExpediente("10:00", 3, true, e)).toBe(true);
    expect(foraDoExpediente("10:00", 6, false, e)).toBe(false);
    expect(foraDoExpediente("13:00", 6, false, e)).toBe(true);
    expect(foraDoExpediente("10:00", 6, false, { ...e, sabadoInicio: null })).toBe(true);
  });
  it("máquina de estados: fala > temporário > ocupado > descanso > neutro", () => {
    expect(estadoEfetivo({})).toBe("neutro");
    expect(estadoEfetivo({ foraDoExpediente: true })).toBe("descanso");
    expect(estadoEfetivo({ ocupado: true, foraDoExpediente: true })).toBe("pensando");
    expect(estadoEfetivo({ temporario: "erro", ocupado: true })).toBe("erro");
    expect(estadoEfetivo({ fala: "comemorando", temporario: "erro" })).toBe("comemorando");
    expect(estadoEfetivo({ temporario: "inexistente", foraDoExpediente: true })).toBe("neutro");
  });
  it("encaixa no canto mais próximo e corrige canto inválido", () => {
    expect(cantoMaisProximo(10, 10, 400, 800)).toBe("superior-esquerdo");
    expect(cantoMaisProximo(390, 700, 400, 800)).toBe("inferior-direito");
    expect(cantoMaisProximo(100, 700, 400, 800)).toBe("inferior-esquerdo");
    expect(cantoValido("meio")).toBe("inferior-direito");
    expect(cantoValido("superior-direito")).toBe("superior-direito");
  });
});
