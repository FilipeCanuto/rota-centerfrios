export function Progresso({ valor, rotulo }: { valor: number; rotulo: string }) {
  const p = Math.max(0, Math.min(1, valor));
  const atingido = valor >= 1;
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      className="h-2 w-full overflow-hidden rounded-full bg-trilha"
    >
      <div
        className={`h-full rounded-full barra-entrar ${atingido ? "bg-ouro ring-2 ring-foreground ring-inset" : "bg-primary"}`}
        style={{ width: `${p * 100}%` }}
      />
    </div>
  );
}
