/** Limites das regras. Os valores reais vêm da tabela configuracoes_regras, por empresa. */
export interface ConfiguracaoRegras {
  recompra_minimo_compras: number;
  recompra_fator_atencao: number;
  recompra_fator_urgente: number;
  cliente_esquecido_dias: number;
  cliente_sem_compra_dias: number;
  orcamento_parado_dias_uteis: number;
  plano_do_dia_max: number;
  /** Mascote: intervalo mínimo entre balões não urgentes, em segundos. */
  mascote_intervalo_baloes_s: number;
  /** Mascote: tempo de balão por caractere (ms) e piso de permanência (s). */
  mascote_ms_por_caractere: number;
  mascote_permanencia_minima_s: number;
  /** Mascote: a partir de qual atingimento da meta (0 a 1) ele incentiva a fechar o mês. */
  mascote_incentivo_atingimento: number;
  /** Expediente (hora cheia, fuso de Maceió): fora dele o mascote descansa e não fala. */
  expediente_inicio_hora: number;
  expediente_fim_hora: number;
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
  mascote_intervalo_baloes_s: 20,
  mascote_ms_por_caractere: 70,
  mascote_permanencia_minima_s: 5,
  mascote_incentivo_atingimento: 0.7,
  expediente_inicio_hora: 8,
  expediente_fim_hora: 18,
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
