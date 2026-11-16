import { csvParaLancamento } from "@/regras/carrinho";
import { shop9EnvioManual } from "./manual";
import type { Shop9Gateway } from "./tipos";

/**
 * Envio pelo conector local (conector-shop9/, no computador do módulo Integrações do Shop9).
 * O conector busca a fila `shop9_envios` em /api/conector/trabalhos e devolve o código Shop9, então a
 * tela não marca nada à mão. Credenciais do Shop9 ficam só naquele computador, nunca na Rota.
 * Qual modo vale é decidido em Configurações > Integrações (`shop9_integracao.modo`).
 */
export const shop9EnvioApi: Shop9Gateway = {
  nome: "Conector Shop9",
  automatico: true,
  pendentes: shop9EnvioManual.pendentes,
  exportar: csvParaLancamento,
  marcarEnviado: async () => {
    throw new Error("No modo conector o envio é marcado automaticamente.");
  },
};
