import { ImageIcon, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import MidiaLoginAba from "./MidiaLoginAba";

export interface AbaConfiguracao {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  Componente: ComponentType;
}

/**
 * Abas da tela Configurações (só administradores). Para criar uma nova (ex.: "Avisos"),
 * crie o componente da aba e acrescente uma linha aqui: rota, menu e testes já valem para ela.
 */
export const ABAS_CONFIGURACAO: AbaConfiguracao[] = [
  {
    id: "midia-login",
    rotulo: "Mídia do login",
    icone: ImageIcon,
    Componente: MidiaLoginAba,
  },
];

export const ABA_PADRAO = ABAS_CONFIGURACAO[0]!.id;
export const abaValida = (v: unknown) =>
  ABAS_CONFIGURACAO.some((a) => a.id === v) ? (v as string) : ABA_PADRAO;
