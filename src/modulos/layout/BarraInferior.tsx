import { Link, useRouterState } from "@tanstack/react-router";
import { DESTINOS } from "./navegacao";

export function BarraInferior() {
  const caminho = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {DESTINOS.map((d) => {
          const ativo = caminho.startsWith(d.url);
          return (
            <li key={d.url}>
              <Link
                to={d.url}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold pressionar linha-interativa ${ativo ? "text-primary" : "text-muted-foreground"}`}
              >
                <d.icone className="size-5" aria-hidden="true" strokeWidth={ativo ? 2.4 : 1.8} />
                {d.titulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
