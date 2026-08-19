import { jsPDF } from "jspdf";

import { montarDocumentoHtml, type Configuracoes, type Oficio } from "./oficios";

const LARGURA_A4 = 210;
const ALTURA_A4 = 297;
const MARGEM = 15;

function documentoEmPagina(html: string) {
  const pagina = document.createElement("div");
  pagina.className = "prose-oficio";
  pagina.style.position = "fixed";
  pagina.style.left = "-10000px";
  pagina.style.top = "0";
  pagina.style.width = "794px"; // A4 em 96dpi
  pagina.style.padding = "56px";
  pagina.style.background = "#ffffff";
  pagina.style.color = "#000000";
  pagina.style.fontFamily = '"Times New Roman", serif';
  pagina.style.fontSize = "16px";
  pagina.style.lineHeight = "1.6";
  pagina.innerHTML = html;
  return pagina;
}

/** Gera o PDF a partir do HTML formatado do ofício, preservando imagens e estilos. */
export async function gerarPdf(oficio: Oficio, config: Configuracoes): Promise<Blob> {
  return gerarPdfDeHtml(montarDocumentoHtml(oficio, config));
}

export async function gerarPdfDeHtml(html: string): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");
  const pagina = documentoEmPagina(html);
  document.body.appendChild(pagina);

  try {
    const canvas = await html2canvas(pagina, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const larguraUtil = LARGURA_A4 - MARGEM * 2;
    const alturaUtil = ALTURA_A4 - MARGEM * 2;
    const alturaTotal = (canvas.height * larguraUtil) / canvas.width;

    const alturaFatiaPx = Math.floor((alturaUtil * canvas.width) / larguraUtil);
    let deslocamento = 0;
    let primeira = true;

    while (deslocamento < canvas.height) {
      const altura = Math.min(alturaFatiaPx, canvas.height - deslocamento);
      const fatia = document.createElement("canvas");
      fatia.width = canvas.width;
      fatia.height = altura;
      const ctx = fatia.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, fatia.width, fatia.height);
      ctx.drawImage(canvas, 0, deslocamento, canvas.width, altura, 0, 0, canvas.width, altura);

      if (!primeira) doc.addPage();
      doc.addImage(
        fatia.toDataURL("image/jpeg", 0.95),
        "JPEG",
        MARGEM,
        MARGEM,
        larguraUtil,
        (altura * larguraUtil) / canvas.width,
        undefined,
        "FAST",
      );
      primeira = false;
      deslocamento += altura;
      if (alturaTotal <= alturaUtil) break;
    }

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
  a.click();
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
