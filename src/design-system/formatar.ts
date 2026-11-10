const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dataLonga = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

export const formatarMoeda = (v: number) => moeda.format(v);
export const formatarPercentual = (v: number) => pct.format(v);
export const formatarDataCurta = (d: Date) => dataCurta.format(d);
export const formatarDataLonga = (d: Date) => dataLonga.format(d);
