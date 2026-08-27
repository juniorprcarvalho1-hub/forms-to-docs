import { jsPDF } from "jspdf";

const LARGURA_A4 = 210;
const ALTURA_A4 = 297;
const MARGEM = 0;

function documentoEmPagina(html: string) {
  const pagina = document.createElement("div");
  // Mesma classe usada no editor e na visualização: o PDF sai idêntico ao salvo.
  pagina.className = "prose-oficio pagina-a4";
  pagina.style.position = "fixed";
  pagina.style.left = "0";
  pagina.style.top = "0";
  pagina.style.zIndex = "-1";
  pagina.style.pointerEvents = "none";
  pagina.innerHTML = html;
  return pagina;
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
  const pagina = documentoEmPagina(html);
  document.body.appendChild(pagina);

  try {
    await document.fonts.ready;
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
      foreignObjectRendering: true,
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
    pagina.remove();
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
