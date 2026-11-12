/** Evita que o fundo dos parágrafos cubra as letras da linha anterior na captura. */
export function prepararRodapeParaPdf(pagina: HTMLElement): void {
  const janela = pagina.ownerDocument.defaultView;
  if (!janela) return;

  const branco = "rgb(255, 255, 255)";
  const transparente = "rgba(0, 0, 0, 0)";
  for (const paragrafo of pagina.querySelectorAll<HTMLElement>("[data-rodape-oficio] p")) {
    if (!paragrafo.textContent?.trim()) continue;
    const estilo = janela.getComputedStyle(paragrafo);
    const alturaMinima = Number.parseFloat(estilo.fontSize) * 1.5;
    const alturaAtual = Number.parseFloat(estilo.lineHeight);
    if (alturaAtual < alturaMinima || estilo.lineHeight === "normal") {
      paragrafo.style.setProperty("line-height", alturaMinima + "px", "important");
    }

    if (estilo.backgroundColor !== branco || estilo.backgroundImage !== "none") continue;
    for (let fundo = paragrafo.parentElement; fundo && pagina.contains(fundo); fundo = fundo.parentElement) {
      const estiloFundo = janela.getComputedStyle(fundo);
      if (estiloFundo.backgroundImage !== "none") break;
      if (estiloFundo.backgroundColor === branco) {
        paragrafo.style.setProperty("background-color", "transparent", "important");
        break;
      }
      if (estiloFundo.backgroundColor !== transparente) break;
    }
  }
}
