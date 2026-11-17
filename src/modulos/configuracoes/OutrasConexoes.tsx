import { useId } from "react";
import { SeloStatus } from "@/design-system/SeloStatus";
import { CONEXOES } from "@/integracoes";

/** WhatsApp, e-mail e Instagram: ainda em modo simulado. Mostra só o nome dos Secrets, nunca valores. */
export default function OutrasConexoes() {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-4">
      <h2 id={`${id}-titulo`} className="text-lg font-semibold">
        Outras conexões
      </h2>
      <p className="text-sm text-muted-foreground">
        Funcionam em modo simulado: nada sai da Rota. As senhas e chaves vão só nos Secrets do
        servidor (Lovable → Secrets), com os nomes abaixo; esta tela nunca mostra os valores.
      </p>
      <ul className="grid gap-4 md:grid-cols-3">
        {CONEXOES.map((c) => (
          <li key={c.chave} className="cartao flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{c.nome}</h3>
              <SeloStatus tom="info">Simulado</SeloStatus>
            </div>
            <p className="text-sm">{c.descricao}</p>
            <div>
              <h4 className="text-sm font-semibold">Secrets</h4>
              <p className="break-words font-mono text-xs">{c.segredos.join(", ")}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">O que falta</h4>
              <ul className="list-disc pl-5 text-sm">
                {c.falta.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
