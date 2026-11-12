import { useEffect, useState } from "react";
import { useMidiaLogin } from "@/modulos/configuracoes/midiaLogin";
import { PalcoMarca, PalcoMidia } from "./PalcoMidia";

/**
 * Palco do login: o formulário já está na tela; só depois do primeiro desenho busca a mídia.
 * Enquanto carrega, falha ou não há nada ativo, mostra o fundo da marca (o tamanho nunca muda).
 */
export default function PalcoLogin() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPronto(true), 0);
    return () => clearTimeout(t);
  }, []);
  const { data } = useMidiaLogin(pronto);
  const ativos = (data ?? []).filter((m) => m.ativo);
  return ativos.length ? <PalcoMidia itens={ativos} /> : <PalcoMarca />;
}
