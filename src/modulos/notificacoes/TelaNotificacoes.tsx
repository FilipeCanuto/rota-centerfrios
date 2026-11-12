import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useSessao } from "@/modulos/sessao/sessao";
import { useMarcarLidas, useNotificacoes } from "./dados";

const quando = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Maceio",
});

export function TelaNotificacoes() {
  const { data: sessao } = useSessao();
  const eu = sessao?.usuario?.id;
  const q = useNotificacoes(eu);
  const marcar = useMarcarLidas(eu);
  const naoLidas = (q.data ?? []).filter((n) => !n.lida_em);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Notificações</h1>
        {naoLidas.length > 0 && (
          <Button
            variant="outline"
            className="ml-auto min-h-11"
            disabled={marcar.isPending}
            onClick={() => marcar.mutate(undefined)}
          >
            <CheckCheck aria-hidden="true" /> Marcar todas como lidas
          </Button>
        )}
      </div>
      <p className="text-muted-foreground" aria-live="polite">
        {naoLidas.length === 0
          ? "Nenhuma notificação não lida."
          : `${naoLidas.length} ${naoLidas.length === 1 ? "não lida" : "não lidas"}.`}
      </p>
      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <EstadoErro
          titulo="Não foi possível carregar as notificações."
          aoTentar={() => void q.refetch()}
          tentando={q.isFetching}
        />
      ) : q.data.length === 0 ? (
        <EstadoVazio icone={Bell} titulo="Nada por aqui">
          <p>Os avisos sobre clientes, orçamentos e metas aparecem nesta lista.</p>
        </EstadoVazio>
      ) : (
        <ul className="cartao cascata divide-y">
          {q.data.map((n) => (
            <li key={n.id} className="linha-interativa flex flex-col gap-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <SeloStatus tom={n.lida_em ? "info" : "atencao"}>
                  {n.lida_em ? "Lida" : "Não lida"}
                </SeloStatus>
                <span className="text-sm text-muted-foreground">
                  {quando.format(new Date(n.created_at))}
                </span>
              </div>
              <p className="font-semibold">{n.titulo}</p>
              {n.corpo && <p className="text-sm text-muted-foreground">{n.corpo}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {n.link && (
                  <Button asChild variant="outline" className="min-h-11">
                    <Link to="/inicio" hash="alertas" onClick={() => marcar.mutate([n.id])}>
                      Ver
                    </Link>
                  </Button>
                )}
                {!n.lida_em && (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    disabled={marcar.isPending}
                    onClick={() => marcar.mutate([n.id])}
                  >
                    Marcar como lida
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
