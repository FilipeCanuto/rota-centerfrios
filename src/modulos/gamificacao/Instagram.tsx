import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { Textarea } from "@/components/ui/textarea";
import { useAnunciar } from "@/design-system/Anunciador";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useSessao } from "@/modulos/sessao/sessao";
import { formatarISO, hojeEmMaceio, legendaValida, MENCAO_INSTAGRAM } from "@/regras";
import {
  useEnviarPost,
  useHashtag,
  usePostsInstagram,
  useValidarPost,
  type PostInstagram,
} from "./dados";

const ROTULO = {
  pendente: { tom: "info", texto: "Aguardando validação" },
  aprovado: { tom: "sucesso", texto: "Aprovado" },
  recusado: { tom: "perigo", texto: "Recusado" },
} as const;
const dia = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function InstagramPosts({ empresaId }: { empresaId: string }) {
  const { data: sessao } = useSessao();
  const eu = sessao?.usuario?.id;
  const posts = usePostsInstagram(empresaId);
  const lista = posts.data ?? [];
  return (
    <div className="cartao flex flex-col gap-4 p-5">
      <h3 className="text-lg font-bold">Posts do Instagram</h3>
      {sessao?.papeis.includes("vendedor") && <FormPost empresaId={empresaId} />}
      {posts.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : posts.isError ? (
        <EstadoErro
          titulo="Não foi possível carregar os posts."
          aoTentar={() => void posts.refetch()}
          tentando={posts.isFetching}
        />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nenhum post enviado ainda.</p>
      ) : (
        <ul className="divide-y">
          {lista.map((p) => (
            <ItemPost key={p.id} post={p} meu={p.vendedor_id === eu} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FormPost({ empresaId }: { empresaId: string }) {
  const id = useId();
  const enviar = useEnviarPost();
  const anunciar = useAnunciar();
  const consulta = useHashtag(empresaId);
  const hashtag = consulta.data ?? "";
  const [url, setUrl] = useState("");
  const [legenda, setLegenda] = useState("");
  const [data, setData] = useState(formatarISO(hojeEmMaceio()));
  const [erro, setErro] = useState<string | null>(null);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) return setErro("Cole o endereço do post (https://…).");
    if (!legenda.trim()) return setErro("Cole a legenda do post.");
    // Sem a hashtag carregada, quem decide é o servidor na validação.
    if (consulta.isSuccess && !legendaValida(legenda, hashtag))
      return setErro(
        `A legenda precisa citar ${MENCAO_INSTAGRAM}${hashtag ? ` ou ${hashtag}` : ""}.`,
      );
    setErro(null);
    try {
      await enviar.mutateAsync({
        empresa_id: empresaId,
        url: url.trim(),
        legenda: legenda.trim(),
        data_post: data,
      });
    } catch {
      return setErro("Não foi possível enviar o post. Tente de novo.");
    }
    setUrl("");
    setLegenda("");
    toast.success("Post enviado para validação.");
    anunciar("Post enviado para validação.");
  }

  return (
    <form onSubmit={submeter} className="grid gap-3 border-b pb-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-u`}>Endereço do post</Label>
        <Input
          id={`${id}-u`}
          type="url"
          inputMode="url"
          className="min-h-11"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://instagram.com/p/…"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-l`}>Legenda</Label>
        <Textarea
          id={`${id}-l`}
          maxLength={2200}
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5 sm:max-w-48">
        <Label htmlFor={`${id}-d`}>Data do post</Label>
        <Input
          id={`${id}-d`}
          type="date"
          max={formatarISO(hojeEmMaceio())}
          className="min-h-11"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>
      {erro && (
        <p role="alert" className="font-semibold text-perigo">
          {erro}
        </p>
      )}
      <Button type="submit" className="min-h-11 w-fit" disabled={enviar.isPending}>
        {enviar.isPending ? "Enviando…" : "Enviar para validação"}
      </Button>
    </form>
  );
}

function ItemPost({ post, meu }: { post: PostInstagram; meu: boolean }) {
  const { data: sessao } = useSessao();
  const validar = useValidarPost();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();
  // O banco decide quem valida (supervisor da equipe ou diretoria); aqui só se esconde o botão do próprio post.
  const podeValidar =
    !meu &&
    post.status === "pendente" &&
    !!sessao?.papeis.some((p) => p === "supervisor" || p === "diretoria");

  async function decidir(aprovar: boolean) {
    if (!aprovar && !motivo.trim()) return setErro("Informe o motivo da recusa.");
    setErro(null);
    try {
      await validar.mutateAsync({ id: post.id, aprovar, motivo });
      toast.success(aprovar ? "Post aprovado." : "Post recusado.");
    } catch (e) {
      setErro((e as { message?: string }).message ?? "Não foi possível validar.");
    }
  }

  const r = ROTULO[post.status];
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeloStatus tom={r.tom}>{r.texto}</SeloStatus>
        <span className="text-sm text-muted-foreground">
          {dia.format(new Date(`${post.data_post}T12:00:00`))}
        </span>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto min-h-11 content-center underline"
        >
          Abrir post
        </a>
      </div>
      <p className="line-clamp-3 text-sm">{post.legenda}</p>
      {post.motivo_recusa && <p className="text-sm text-perigo">Motivo: {post.motivo_recusa}</p>}
      {podeValidar && (
        <div className="flex flex-col gap-2">
          {recusando && (
            <>
              <Label htmlFor={`${id}-m`}>Motivo da recusa</Label>
              <Input
                id={`${id}-m`}
                ref={(el) => el?.focus()}
                className="min-h-11"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {!recusando && (
              <Button
                className="min-h-11"
                onClick={() => decidir(true)}
                disabled={validar.isPending}
              >
                Aprovar
              </Button>
            )}
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => (recusando ? decidir(false) : setRecusando(true))}
              disabled={validar.isPending}
            >
              {recusando ? "Confirmar recusa" : "Recusar"}
            </Button>
          </div>
        </div>
      )}
      {erro && (
        <p role="alert" className="font-semibold text-perigo">
          {erro}
        </p>
      )}
    </li>
  );
}
