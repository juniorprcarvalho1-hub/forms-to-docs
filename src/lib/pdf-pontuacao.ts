type NoDeTexto = { nodeType: number; nodeName: string; childNodes: ArrayLike<NoDeTexto> };
type Texto = NoDeTexto & { data: string };

/** Corrige espaços tipográficos no texto renderizado, inclusive entre trechos formatados. */
export function ajustarPontuacaoPdf(raiz: NoDeTexto): void {
  const espaco = /[ \t\r\n\u00a0\u202f]+$/u;
  const pontuacao = /^[,.;:!?]/u;
  const blocos = /^(?:address|article|aside|blockquote|br|dd|div|dl|dt|figure|figcaption|footer|h[1-6]|header|hr|li|main|ol|p|section|table|tbody|td|th|tr|ul)$/i;
  let anteriores: Texto[] = [];

  function limparFim(): void {
    for (let i = anteriores.length - 1; i >= 0; i--) {
      const texto = anteriores[i]!;
      texto.data = texto.data.replace(espaco, "");
      if (texto.data) break;
    }
  }

  function visitar(no: NoDeTexto): void {
    if (no.nodeType === 3) {
      const texto = no as Texto;
      texto.data = texto.data.replace(/(\S)[ \t\r\n\u00a0\u202f]+([,.;:!?])/gu, "$1$2")
        .replace(/(\p{L})[ \t\u00a0\u202f]+\((a|o|as|os)\)/giu, "$1($2)");
      const inicio = texto.data.replace(/^[ \t\r\n\u00a0\u202f]+/u, "");
      if (anteriores.length && (pontuacao.test(inicio) || /^\((?:a|o|as|os)\)/i.test(inicio))) {
        limparFim();
        texto.data = inicio;
      }
      if (inicio) anteriores = [texto];
      else if (texto.data && anteriores.length) anteriores.push(texto);
      return;
    }

    if (no.nodeType !== 1) return;
    const nome = no.nodeName;
    if (/^(?:script|style|code|pre|textarea)$/i.test(nome)) {
      anteriores = [];
      return;
    }
    const bloco = blocos.test(nome);
    if (bloco) anteriores = [];
    for (const filho of Array.from(no.childNodes)) visitar(filho);
    if (bloco) anteriores = [];
  }

  visitar(raiz);
}
