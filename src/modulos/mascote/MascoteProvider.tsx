import { useIsFetching, useIsMutating, useQueryClient } from "@tanstack/react-query";
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAnunciar } from "@/design-system/Anunciador";
import { useRegrasDaEmpresa } from "@/modulos/clientes/dados";
import { useNotificacoes } from "@/modulos/notificacoes/dados";
import { useEmpresasAtivas, useSessao } from "@/modulos/sessao/sessao";
import {
  enfileirar,
  esperaDaFila,
  estadoEfetivo,
  ESTADOS_MASCOTE,
  FILA_VAZIA,
  normalizarEstado,
  permanenciaMs,
  proximaFala,
  REGRAS_PADRAO,
  type EstadoMascote,
  type Fala,
  type VersaoPinguim,
} from "@/regras";
import {
  registrarNoSino,
  usePreferenciasMascote,
  useSilencio,
  type PreferenciasMascote,
} from "./dados";
import { MascoteFlutuante } from "./MascoteFlutuante";
import { REACAO_PADRAO, REACAO_POR_TIPO, TIPOS_RESUMIDOS } from "./mensagens";
import { falarEmVoz, tocar } from "./som";

/** Contrato estável: as telas e regras só usam isto. Nunca importam o desenho do mascote. */
export interface ApiMascote {
  /** Fala num balão (se puder) e sempre registra no sino. Mesmo `id` nunca repete. */
  notificar: (fala: Fala) => void;
  /** Reação sem fala, por alguns segundos. Estado desconhecido vira "neutro". */
  definirEstado: (estado: string, duracaoMs?: number) => void;
}
const SEM_MASCOTE: ApiMascote = { notificar: () => {}, definirEstado: () => {} };
const Ctx = createContext<ApiMascote>(SEM_MASCOTE);
/** Fora do provider (login, testes) devolve funções vazias: emitir evento nunca quebra a tela. */
export const useMascote = () => useContext(Ctx);

/** O que o flutuante precisa para desenhar. Interno do módulo. */
export interface VisaoMascote {
  apelido: string;
  versao: VersaoPinguim;
  estado: EstadoMascote;
  fala: Fala | null;
  fechar: () => void;
  pausar: (pausado: boolean) => void;
  prefs: PreferenciasMascote;
  definirPrefs: (mudanca: Partial<PreferenciasMascote>) => void;
}

/** Se o mascote falhar, some em silêncio e o sistema segue. Nunca lança para fora. */
class LimiteMascote extends Component<{ children: ReactNode }, { falhou: boolean }> {
  override state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  override componentDidCatch(erro: unknown) {
    console.warn("Mascote desligado por erro:", erro);
  }
  override render() {
    return this.state.falhou ? null : this.props.children;
  }
}

export function MascoteProvider({ children }: { children: ReactNode }) {
  const usuario = useSessao().data?.usuario ?? undefined;
  const [empresaId] = useEmpresasAtivas();
  const cfg = useRegrasDaEmpresa(empresaId).data ?? REGRAS_PADRAO;
  const { fora, tiposDesligados } = useSilencio(usuario?.id);
  const [prefs, definirPrefs] = usePreferenciasMascote(usuario?.id);
  const anunciar = useAnunciar();
  const qc = useQueryClient();

  const [fila, setFila] = useState(FILA_VAZIA);
  const [fala, setFala] = useState<Fala | null>(null);
  const [temporario, setTemporario] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);
  // Sempre o valor mais recente dentro de funções estáveis (a API não muda de identidade).
  const atual = useRef({ fora, tiposDesligados, prefs, cfg, usuarioId: usuario?.id });
  atual.current = { fora, tiposDesligados, prefs, cfg, usuarioId: usuario?.id };
  const noSino = useRef(new Set<string>());
  const falados = useRef(new Set<string>());

  const emitir = useCallback(
    (f: Fala, registrar: boolean) => {
      try {
        const a = atual.current;
        if (!f?.id || !f.texto || a.tiposDesligados.includes(f.tipo)) return;
        falados.current.add(f.texto);
        if (registrar && a.usuarioId && !noSino.current.has(f.id)) {
          noSino.current.add(f.id);
          registrarNoSino(f)
            .then((n) => {
              if (n) void qc.invalidateQueries({ queryKey: ["notificacoes", a.usuarioId] });
            })
            .catch(() => {});
        }
        // Balões ocultos ou fora do expediente: fica só o registro no sino (urgente ainda fala).
        if (a.prefs.baloesOcultos || (a.fora && f.prioridade !== "urgente")) return;
        setFila((atualFila) => enfileirar(atualFila, f));
      } catch {
        /* o mascote nunca derruba quem o chamou */
      }
    },
    [qc],
  );

  const tempo = useRef<ReturnType<typeof setTimeout>>(undefined);
  const api = useMemo<ApiMascote>(
    () => ({
      notificar: (f) => emitir(f, true),
      definirEstado: (estado, duracaoMs) => {
        clearTimeout(tempo.current);
        setTemporario(normalizarEstado(estado));
        const ms = duracaoMs ?? atual.current.cfg.mascote_permanencia_minima_s * 1000;
        tempo.current = setTimeout(() => setTemporario(null), ms);
      },
    }),
    [emitir],
  );
  useEffect(() => () => clearTimeout(tempo.current), []);

  // Fila: mostra a próxima quando o limite de frequência deixa. Urgente troca o balão atual.
  const intervalo = cfg.mascote_intervalo_baloes_s * 1000;
  useEffect(() => {
    const proxima = fila.pendentes[0];
    if (fala && !(proxima?.prioridade === "urgente" && fala.prioridade !== "urgente")) return;
    const espera = esperaDaFila(fila, Date.now(), intervalo);
    if (espera === null) return;
    const t = setTimeout(() => {
      const r = proximaFala(fila, Date.now(), intervalo);
      setFila(r.fila);
      if (!r.fala) return;
      setFala(r.fala);
      const som = ESTADOS_MASCOTE[normalizarEstado(r.fala.estado)].som;
      if (som && !atual.current.prefs.somMudo) tocar(som);
      falarEmVoz(r.fala.texto);
      // Urgente é anunciado pelo próprio balão (role="alert"); o resto, com educação.
      if (r.fala.prioridade !== "urgente") anunciar(r.fala.texto);
    }, espera);
    return () => clearTimeout(t);
  }, [fila, fala, intervalo, anunciar]);

  // Permanência proporcional ao texto; pausa enquanto o mouse ou o foco está no balão.
  useEffect(() => {
    if (!fala || pausado) return;
    const ms = permanenciaMs(
      fala.texto,
      cfg.mascote_ms_por_caractere,
      cfg.mascote_permanencia_minima_s * 1000,
    );
    const t = setTimeout(() => setFala(null), ms);
    return () => clearTimeout(t);
  }, [fala, pausado, cfg.mascote_ms_por_caractere, cfg.mascote_permanencia_minima_s]);

  // Notificações novas gravadas pelo banco (pontos, selos, metas…) também viram fala.
  const desde = useRef(new Date().toISOString());
  const { data: notificacoes } = useNotificacoes(usuario?.id);
  useEffect(() => {
    for (const n of notificacoes ?? []) {
      if (n.lida_em || n.created_at < desde.current) continue;
      if (TIPOS_RESUMIDOS.includes(n.tipo) || falados.current.has(n.titulo)) continue;
      const reacao = REACAO_POR_TIPO[n.tipo] ?? REACAO_PADRAO;
      emitir(
        {
          id: `sino:${n.id}`,
          tipo: n.tipo,
          texto: n.titulo,
          estado: reacao.estado,
          prioridade: reacao.prioridade,
          acao: n.link ? { rotulo: "Abrir", link: n.link } : undefined,
        },
        false,
      );
    }
  }, [notificacoes, emitir]);

  // Erro em qualquer consulta ou gravação: reação de erro, sem a tela precisar avisar o mascote.
  useEffect(() => {
    const aoErrar = (e: { type: string; action?: { type: string } }) => {
      if (e.type !== "updated" || e.action?.type !== "error") return;
      api.definirEstado("erro");
      if (!atual.current.prefs.somMudo) tocar("erro");
    };
    const parar = [qc.getQueryCache().subscribe(aoErrar), qc.getMutationCache().subscribe(aoErrar)];
    return () => parar.forEach((p) => p());
  }, [qc, api]);

  // "Pensando" enquanto algo é gravado ou a IA responde (consultas com chave ["ia", …]).
  const ocupado = useIsMutating() + useIsFetching({ queryKey: ["ia"] }) > 0;

  const visao: VisaoMascote = {
    apelido: usuario?.apelido_copiloto ?? "",
    versao: usuario?.pinguim_versao ?? "consultor",
    estado: estadoEfetivo({
      fala: fala?.estado ?? null,
      temporario,
      ocupado,
      foraDoExpediente: fora,
    }),
    fala,
    fechar: () => setFala(null),
    pausar: setPausado,
    prefs,
    definirPrefs,
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {usuario && (
        <LimiteMascote>
          <MascoteFlutuante {...visao} />
        </LimiteMascote>
      )}
    </Ctx.Provider>
  );
}
