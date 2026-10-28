import { prepararImagensInstitucionais } from "./storage";
import { jsPDF } from "jspdf";

const LARGURA_A4 = 210;
const ALTURA_A4 = 297;
const MARGEM = 0;

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
  documento.open();
  documento.write(`<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 794px; background: #fff; }
    .pagina-a4 { width: 794px; min-height: 1123px; padding: 38px 48px; overflow: visible;
      background: #fff; color: #000; font-family: "Times New Roman", serif;
      font-size: 14px; line-height: 1.35; }
    h1 { font-size: 1.6em; } h2 { font-size: 1.35em; } h3 { font-size: 1.15em; }
    h1, h2, h3 { font-weight: 700; margin: .45em 0; }
    p { margin: 0 0 .4em; }
    ul, ol { padding-left: 1.6em; margin: 0 0 .6em; }
    blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; margin: 0 0 .6em; }
    img { display: inline-block; max-width: 100%; }
    table { max-width: 100%; }
    .img-selecionada { outline: none !important; }
  </style></head><body><div class="prose-oficio pagina-a4">${html}</div></body></html>`);
  documento.close();
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
    await prepararImagensInstitucionais(pagina);
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
