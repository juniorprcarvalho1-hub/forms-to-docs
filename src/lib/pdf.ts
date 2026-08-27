import { jsPDF } from "jspdf";

const LARGURA_A4 = 210;
const ALTURA_A4 = 297;
const MARGEM = 0;

function estilosDaAplicacao(): string {
  return Array.from(document.styleSheets)
    .map((folha) => {
      try {
        return Array.from(folha.cssRules)
          .map((regra) => regra.cssText)
          .join("\n");
      } catch {
        // Folhas externas protegidas pelo navegador não fazem parte dos estilos
        // locais do editor e podem ser ignoradas com segurança.
        return "";
      }
    })
    .join("\n");
}

function documentoEmPagina(html: string) {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.style.position = "fixed";
  quadro.style.inset = "0 auto auto 0";
  quadro.style.width = "794px";
  quadro.style.height = "1123px";
  quadro.style.border = "0";
  quadro.style.zIndex = "-1";
  quadro.style.pointerEvents = "none";
  document.body.appendChild(quadro);

  const documento = quadro.contentDocument;
  if (!documento) {
    quadro.remove();
    throw new Error("Não foi possível preparar a página do PDF.");
  }
  documento.documentElement.className = document.documentElement.className;
  documento.documentElement.style.colorScheme = "light";

  const estilos = documento.createElement("style");
  estilos.textContent = `${estilosDaAplicacao()}
    html, body { margin: 0 !important; width: 794px !important; min-height: 1123px; background: #fff !important; }
    .pagina-a4 { overflow: visible !important; box-shadow: none !important; }
    .img-selecionada { outline: none !important; }
  `;
  documento.head.appendChild(estilos);

  const paginaCriada = documento.createElement("div");
  paginaCriada.className = "prose-oficio pagina-a4";
  paginaCriada.innerHTML = html;
  documento.body.appendChild(paginaCriada);

  const pagina = documento.querySelector<HTMLElement>(".pagina-a4");
  if (!pagina) {
    quadro.remove();
    throw new Error("Não foi possível montar a página do PDF.");
  }
  return { quadro, pagina };
}

function aguardarImagem(imagem: HTMLImageElement): Promise<void> {
  if (imagem.complete) return Promise.resolve();

  return new Promise((resolve) => {
    const concluir = () => {
      window.clearTimeout(limite);
      resolve();
    };
    const limite = window.setTimeout(concluir, 5000);
    imagem.addEventListener("load", concluir, { once: true });
    imagem.addEventListener("error", concluir, { once: true });
  });
}

export async function gerarPdfDeHtml(html: string): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");
  const { quadro, pagina } = documentoEmPagina(html);

  try {
    await quadro.contentDocument?.fonts.ready;
    const imagens = Array.from(pagina.querySelectorAll("img"));
    await Promise.all(imagens.map(aguardarImagem));
    imagens.forEach((imagem) => {
      if (imagem.naturalWidth === 0) imagem.remove();
    });

    const canvas = await html2canvas(pagina, {
      scale: 2,
      useCORS: true,
      imageTimeout: 5000,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const larguraUtil = LARGURA_A4 - MARGEM * 2;
    const alturaUtil = ALTURA_A4 - MARGEM * 2;
    const escala = Math.min(larguraUtil / canvas.width, alturaUtil / canvas.height);
    const larguraRenderizada = canvas.width * escala;
    const alturaRenderizada = canvas.height * escala;
    const x = MARGEM + (larguraUtil - larguraRenderizada) / 2;

    // O documento inteiro é reduzido proporcionalmente quando necessário.
    // Nunca há recorte nem vazamento de assinaturas/rodapé para uma segunda página.
    doc.addImage(
      canvas.toDataURL("image/jpeg", 0.97),
      "JPEG",
      x,
      MARGEM,
      larguraRenderizada,
      alturaRenderizada,
      undefined,
      "FAST",
    );

    return doc.output("blob");
  } finally {
    quadro.remove();
  }
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function imprimirBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.src = url;
  frame.onload = () => frame.contentWindow?.print();
  document.body.appendChild(frame);
}
