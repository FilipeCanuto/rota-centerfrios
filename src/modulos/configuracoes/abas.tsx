import { Building2, ImageIcon, PlugZap, UserCog, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import IntegracoesAba from "./IntegracoesAba";
import MidiaLoginAba from "./MidiaLoginAba";
import SetoresAba from "./SetoresAba";
import UsuariosAba from "./UsuariosAba";

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
  {
    id: "usuarios",
    rotulo: "Usuários e acessos",
    icone: UserCog,
    Componente: UsuariosAba,
  },
  {
    id: "setores",
    rotulo: "Setores",
    icone: Building2,
    Componente: SetoresAba,
  },
  {
    id: "integracoes",
    rotulo: "Integrações",
    icone: PlugZap,
    Componente: IntegracoesAba,
  },
];

export const ABA_PADRAO = ABAS_CONFIGURACAO[0]!.id;
export const abaValida = (v: unknown) =>
  ABAS_CONFIGURACAO.some((a) => a.id === v) ? (v as string) : ABA_PADRAO;
