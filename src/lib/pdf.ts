import { jsPDF } from "jspdf";

import { renderizarModelo, type Configuracoes, type Oficio } from "./oficios";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarPdf(oficio: Oficio, config: Configuracoes): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 25;
  const largura = 210 - margem * 2;
  let y = 20;

  if (config.logo_url) {
    const logo = await toDataUrl(config.logo_url);
    if (logo) {
      try {
        doc.addImage(logo, "PNG", (210 - 35) / 2, y, 35, 20, undefined, "FAST");
        y += 26;
      } catch {
        /* ignora logo inválida */
      }
    }
  }

  doc.setFont("times", "normal");
  doc.setFontSize(12);

  const texto = renderizarModelo(config.modelo, oficio, config);
  const linhas = doc.splitTextToSize(texto, largura) as string[];

  for (const linha of linhas) {
    if (y > 265) {
      doc.addPage();
      y = 25;
    }
    doc.text(linha, margem, y);
    y += 7;
  }

  if (config.assinatura_url) {
    const assinatura = await toDataUrl(config.assinatura_url);
    if (assinatura) {
      try {
        if (y > 230) {
          doc.addPage();
          y = 40;
        }
        doc.addImage(assinatura, "PNG", (210 - 50) / 2, y + 6, 50, 22, undefined, "FAST");
      } catch {
        /* ignora assinatura inválida */
      }
    }
  }

  return doc.output("blob");
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
