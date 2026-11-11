/** Limites das regras. Os valores reais vêm da tabela configuracoes_regras, por empresa. */
export interface ConfiguracaoRegras {
  recompra_minimo_compras: number;
  recompra_fator_atencao: number;
  recompra_fator_urgente: number;
  cliente_esquecido_dias: number;
  cliente_sem_compra_dias: number;
  orcamento_parado_dias_uteis: number;
  plano_do_dia_max: number;
}

/** Reserva usada só quando a empresa não tem a chave cadastrada. */
export const REGRAS_PADRAO: ConfiguracaoRegras = {
  recompra_minimo_compras: 3,
  recompra_fator_atencao: 1.5,
  recompra_fator_urgente: 2,
  cliente_esquecido_dias: 30,
  cliente_sem_compra_dias: 90,
  orcamento_parado_dias_uteis: 2,
  plano_do_dia_max: 10,
};

export function montarConfiguracao(linhas: { chave: string; valor: number }[]): ConfiguracaoRegras {
  const c = { ...REGRAS_PADRAO };
  for (const l of linhas)
    if (l.chave in c) (c as Record<string, number>)[l.chave] = Number(l.valor);
  return c;
}

/** Uma configuração por empresa: as regras de uma empresa nunca vazam para a outra. */
export function configuracaoPorEmpresa(
  linhas: { empresa_id: string; chave: string; valor: number }[],
  empresas: string[],
): Map<string, ConfiguracaoRegras> {
  return new Map(
    empresas.map((e) => [e, montarConfiguracao(linhas.filter((l) => l.empresa_id === e))]),
  );
}
