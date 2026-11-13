/** A captura por canvas redesenha palavras e pontuação separadamente. */
export function prepararAlinhamentoPdf(pagina: HTMLElement): void {
  const janela = pagina.ownerDocument.defaultView;
  if (!janela) return;
  for (const elemento of [pagina, ...pagina.querySelectorAll<HTMLElement>("*")]) {
    if (!elemento.style) continue;
    const alinhamento = janela.getComputedStyle(elemento).textAlign;
    if (alinhamento === "justify" || alinhamento === "justify-all") {
      elemento.style.setProperty("text-align", "start", "important");
    }
  }
}
