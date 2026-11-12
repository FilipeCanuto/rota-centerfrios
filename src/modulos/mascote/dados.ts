import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  cantoValido,
  dataLocal,
  EXPEDIENTE_PADRAO,
  foraDoExpediente,
  FUSO,
  hojeEmMaceio,
  type Canto,
  type Expediente,
  type Fala,
} from "@/regras";

/** Preferências de notificação que já existem no banco: horário de trabalho e tipos desligados. */
export function useSilencio(usuarioId: string | undefined) {
  const hoje = dataLocal(new Date());
  const { data } = useQuery({
    queryKey: ["mascote-silencio", usuarioId, hoje],
    enabled: !!usuarioId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [prefs, feriado] = await Promise.all([
        supabase
          .from("preferencias_notificacao")
          .select("tipos_desligados,expediente_inicio,expediente_fim,sabado_inicio,sabado_fim")
          .eq("usuario_id", usuarioId!)
          .maybeSingle(),
        supabase.from("feriados").select("data").eq("data", hoje).limit(1),
      ]);
      const p = prefs.data;
      const expediente: Expediente = p
        ? {
            inicio: p.expediente_inicio,
            fim: p.expediente_fim,
            sabadoInicio: p.sabado_inicio,
            sabadoFim: p.sabado_fim,
          }
        : EXPEDIENTE_PADRAO;
      return {
        expediente,
        tiposDesligados: p?.tipos_desligados ?? [],
        feriado: !!feriado.data?.some((f) => f.data === hoje),
      };
    },
  });
  // Reavalia a cada minuto, para o mascote descansar e acordar na hora certa.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hora = agora.toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    tiposDesligados: data?.tiposDesligados ?? [],
    fora: foraDoExpediente(
      hora,
      hojeEmMaceio(agora).getDay(),
      data?.feriado ?? false,
      data?.expediente ?? EXPEDIENTE_PADRAO,
    ),
  };
}

/** O balão é efêmero; o sino é o registro. A chave evita repetir a mesma fala no sino. */
export async function registrarNoSino(fala: Fala) {
  const { data } = await supabase.rpc("registrar_notificacoes", {
    _itens: [
      {
        tipo: fala.tipo,
        titulo: fala.texto,
        corpo: null,
        link: fala.acao?.link ?? null,
        chave: `mascote:${fala.id}`,
      },
    ],
  });
  return data;
}

export interface PreferenciasMascote {
  canto: Canto;
  minimizado: boolean;
  baloesOcultos: boolean;
  somMudo: boolean;
}
const PADRAO: PreferenciasMascote = {
  canto: "inferior-direito",
  minimizado: false,
  baloesOcultos: false,
  somMudo: false,
};

/** Posição e preferências por usuário, neste aparelho. Sem localStorage, vale só na sessão. */
export function usePreferenciasMascote(usuarioId: string | undefined) {
  const chave = `rota-mascote:${usuarioId ?? "anonimo"}`;
  const [prefs, setPrefs] = useState(PADRAO);
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(chave) ?? "{}");
      setPrefs({
        canto: cantoValido(salvo.canto),
        minimizado: salvo.minimizado === true,
        baloesOcultos: salvo.baloesOcultos === true,
        somMudo: salvo.somMudo === true,
      });
    } catch {
      setPrefs(PADRAO);
    }
  }, [chave]);
  const definir = (mudanca: Partial<PreferenciasMascote>) =>
    setPrefs((atual) => {
      const novo = { ...atual, ...mudanca };
      try {
        localStorage.setItem(chave, JSON.stringify(novo));
      } catch {
        /* armazenamento bloqueado: vale só nesta sessão */
      }
      return novo;
    });
  return [prefs, definir] as const;
}
