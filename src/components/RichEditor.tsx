import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Indent,
  Italic,
  List,
  ListOrdered,
  Outdent,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { EscalaA4 } from "@/components/PaginaA4";
import { cn } from "@/lib/utils";
import { uploadArquivo, urlAssinada, prepararImagensInstitucionais } from "@/lib/storage";
import { etiquetasParaTags, tagsParaEtiquetas } from "@/lib/tags";

type Props = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  minHeight?: number;
  placeholder?: string;
  /** Rótulos personalizados para as etiquetas dos campos automáticos. */
  rotulos?: Record<string, string>;
};

const FONTES = ["Times New Roman", "Arial", "Georgia", "Roboto", "Courier New", "Verdana"];
const TAMANHOS: { label: string; value: string }[] = [
  { label: "8", value: "1" },
  { label: "10", value: "2" },
  { label: "12", value: "3" },
  { label: "14", value: "4" },
  { label: "18", value: "5" },
  { label: "24", value: "6" },
  { label: "32", value: "7" },
];

function comando(nome: string, valor?: string) {
  document.execCommand(nome, false, valor);
}

export function RichEditor({
  value,
  onChange,
  className,
  minHeight = 260,
  placeholder,
  rotulos,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [imagemSelecionada, setImagemSelecionada] = useState<HTMLImageElement | null>(null);
  const [larguraImagem, setLarguraImagem] = useState(240);
  const [deslocamentoX, setDeslocamentoX] = useState(0);
  const [deslocamentoY, setDeslocamentoY] = useState(0);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    if (etiquetasParaTags(area.innerHTML) !== (value || "")) {
      area.innerHTML = tagsParaEtiquetas(value || "", rotulos);
      void prepararImagensInstitucionais(area).catch(() => {});
    }
  }, [value, rotulos]);

  const emitir = useCallback(() => {
    if (!areaRef.current) return;
    const clone = areaRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img.img-selecionada").forEach((img) => {
      img.classList.remove("img-selecionada");
      if (!img.getAttribute("class")) img.removeAttribute("class");
    });
    onChange(etiquetasParaTags(clone.innerHTML));
  }, [onChange]);

  function executar(nome: string, valor?: string) {
    areaRef.current?.focus();
    comando(nome, valor);
    emitir();
  }

  async function inserirImagem(file: File) {
    try {
      const path = `conteudo/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "-")}`;
      await uploadArquivo(path, file);
      const url = await urlAssinada(path, 60 * 60 * 24 * 365);
      areaRef.current?.focus();
      comando(
        "insertHTML",
        `<img src="${url}" alt="Imagem do documento" style="width:240px;max-width:100%;display:inline-block" />`,
      );
      emitir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao inserir a imagem.");
    }
  }

  function selecionar(img: HTMLImageElement | null) {
    areaRef.current
      ?.querySelectorAll("img.img-selecionada")
      .forEach((i) => i.classList.remove("img-selecionada"));
    if (img) img.classList.add("img-selecionada");
    setImagemSelecionada(img);
    if (img) {
      setLarguraImagem(Math.round(img.getBoundingClientRect().width) || 240);
      setDeslocamentoX(parseInt(img.style.left || "0", 10) || 0);
      setDeslocamentoY(parseInt(img.style.top || "0", 10) || 0);
    }
  }

  function aoClicar(e: React.MouseEvent) {
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === "IMG") selecionar(alvo as HTMLImageElement);
    else selecionar(null);
  }

  function ajustarImagem(px: number) {
    if (!imagemSelecionada) return;
    setLarguraImagem(px);
    imagemSelecionada.style.width = `${px}px`;
    imagemSelecionada.style.height = "auto";
    imagemSelecionada.style.maxWidth = "100%";
    emitir();
  }

  function alinharImagem(valor: "left" | "center" | "right") {
    if (!imagemSelecionada) return;
    imagemSelecionada.style.float = "";
    imagemSelecionada.style.display = "block";
    imagemSelecionada.style.marginLeft = valor === "left" ? "0" : "auto";
    imagemSelecionada.style.marginRight = valor === "right" ? "0" : "auto";
    emitir();
  }

  function flutuarImagem(valor: "left" | "right" | "none") {
    if (!imagemSelecionada) return;
    if (valor === "none") {
      imagemSelecionada.style.float = "";
      imagemSelecionada.style.display = "inline-block";
      imagemSelecionada.style.margin = "";
    } else {
      imagemSelecionada.style.display = "inline";
      imagemSelecionada.style.float = valor;
      imagemSelecionada.style.margin = valor === "left" ? "0 12px 8px 0" : "0 0 8px 12px";
    }
    emitir();
  }

  function moverImagem(eixo: "x" | "y", px: number) {
    if (!imagemSelecionada) return;
    imagemSelecionada.style.position = "relative";
    if (eixo === "x") {
      setDeslocamentoX(px);
      imagemSelecionada.style.left = `${px}px`;
    } else {
      setDeslocamentoY(px);
      imagemSelecionada.style.top = `${px}px`;
    }
    emitir();
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
        <select
          aria-label="Fonte"
          className="h-8 rounded-md border bg-background px-2 text-xs"
          defaultValue=""
          onChange={(e) => e.target.value && executar("fontName", e.target.value)}
        >
          <option value="">Fonte</option>
          {FONTES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          aria-label="Tamanho"
          className="h-8 rounded-md border bg-background px-2 text-xs"
          defaultValue=""
          onChange={(e) => e.target.value && executar("fontSize", e.target.value)}
        >
          <option value="">Tamanho</option>
          {TAMANHOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Estilo do parágrafo"
          className="h-8 rounded-md border bg-background px-2 text-xs"
          defaultValue=""
          onChange={(e) => e.target.value && executar("formatBlock", e.target.value)}
        >
          <option value="">Parágrafo</option>
          <option value="p">Normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="blockquote">Citação</option>
        </select>

        <Botao titulo="Negrito" onClick={() => executar("bold")}>
          <Bold className="size-4" />
        </Botao>
        <Botao titulo="Itálico" onClick={() => executar("italic")}>
          <Italic className="size-4" />
        </Botao>
        <Botao titulo="Sublinhado" onClick={() => executar("underline")}>
          <Underline className="size-4" />
        </Botao>
        <Botao titulo="Tachado" onClick={() => executar("strikeThrough")}>
          <Strikethrough className="size-4" />
        </Botao>

        <input
          type="color"
          aria-label="Cor do texto"
          title="Cor do texto"
          className="size-8 cursor-pointer rounded-md border bg-background p-1"
          onChange={(e) => executar("foreColor", e.target.value)}
        />

        <Botao titulo="Alinhar à esquerda" onClick={() => executar("justifyLeft")}>
          <AlignLeft className="size-4" />
        </Botao>
        <Botao titulo="Centralizar" onClick={() => executar("justifyCenter")}>
          <AlignCenter className="size-4" />
        </Botao>
        <Botao titulo="Alinhar à direita" onClick={() => executar("justifyRight")}>
          <AlignRight className="size-4" />
        </Botao>
        <Botao titulo="Justificar" onClick={() => executar("justifyFull")}>
          <AlignJustify className="size-4" />
        </Botao>

        <Botao titulo="Lista com marcadores" onClick={() => executar("insertUnorderedList")}>
          <List className="size-4" />
        </Botao>
        <Botao titulo="Lista numerada" onClick={() => executar("insertOrderedList")}>
          <ListOrdered className="size-4" />
        </Botao>
        <Botao titulo="Aumentar recuo" onClick={() => executar("indent")}>
          <Indent className="size-4" />
        </Botao>
        <Botao titulo="Diminuir recuo" onClick={() => executar("outdent")}>
          <Outdent className="size-4" />
        </Botao>

        <label
          title="Inserir imagem PNG/JPG"
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border bg-background px-2 text-xs"
        >
          <ImageIcon className="size-4" /> Imagem
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) inserirImagem(file);
              e.target.value = "";
            }}
          />
        </label>

        <Botao titulo="Desfazer" onClick={() => executar("undo")}>
          <Undo2 className="size-4" />
        </Botao>
        <Botao titulo="Refazer" onClick={() => executar("redo")}>
          <Redo2 className="size-4" />
        </Botao>
        <Botao titulo="Limpar formatação" onClick={() => executar("removeFormat")}>
          <RemoveFormatting className="size-4" />
        </Botao>
      </div>

      {imagemSelecionada && (
        <div className="space-y-3 border-b bg-accent/40 px-3 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs">Largura</Label>
            <Slider
              className="w-40"
              min={40}
              max={794}
              step={5}
              value={[larguraImagem]}
              onValueChange={(v) => ajustarImagem(v[0] ?? larguraImagem)}
            />
            <Input
              type="number"
              className="h-8 w-24"
              min={20}
              max={1200}
              value={larguraImagem}
              onChange={(e) => ajustarImagem(Number(e.target.value) || larguraImagem)}
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Posição</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => alinharImagem("left")}>
              Esquerda
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => alinharImagem("center")}
            >
              Centro
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => alinharImagem("right")}
            >
              Direita
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => flutuarImagem("left")}>
              Texto à direita
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => flutuarImagem("right")}
            >
              Texto à esquerda
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => flutuarImagem("none")}>
              No meio do texto
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs">Ajuste fino horizontal ({deslocamentoX}px)</Label>
            <Slider
              className="w-32"
              min={-300}
              max={300}
              step={2}
              value={[deslocamentoX]}
              onValueChange={(v) => moverImagem("x", v[0] ?? deslocamentoX)}
            />
            <Label className="text-xs">Vertical ({deslocamentoY}px)</Label>
            <Slider
              className="w-32"
              min={-300}
              max={300}
              step={2}
              value={[deslocamentoY]}
              onValueChange={(v) => moverImagem("y", v[0] ?? deslocamentoY)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                imagemSelecionada.remove();
                selecionar(null);
                emitir();
              }}
            >
              Remover
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Você também pode arrastar a imagem para qualquer ponto do texto. Adicione quantas
            imagens quiser pelo botão “Imagem”.
          </p>
        </div>
      )}

      <div className="bg-muted/30 p-4">
        <EscalaA4>
          <div
            ref={areaRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={placeholder ?? "Editor de texto"}
            data-placeholder={placeholder}
            onInput={emitir}
            onBlur={emitir}
            onClick={aoClicar}
            style={{ minHeight }}
            className="prose-oficio pagina-a4 shadow-sm outline-none"
          />
        </EscalaA4>
      </div>
    </div>
  );
}

function Botao({
  titulo,
  onClick,
  children,
}: {
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      title={titulo}
      aria-label={titulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
