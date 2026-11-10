import { CalendarDays, Home, MessageCircle, MoreHorizontal, Users } from "lucide-react";

export const DESTINOS = [
  { titulo: "Início", url: "/inicio", icone: Home },
  { titulo: "Conversas", url: "/conversas", icone: MessageCircle },
  { titulo: "Clientes", url: "/clientes", icone: Users },
  { titulo: "Agenda", url: "/agenda", icone: CalendarDays },
  { titulo: "Mais", url: "/mais", icone: MoreHorizontal },
] as const;
