/** Converte as cores calculadas pelo navegador para o sRGB aceito pelo html2canvas. */
export function normalizarCoresParaPdf(pagina: HTMLElement): void {
  const documento = pagina.ownerDocument;
  const janela = documento.defaultView;
  const amostra = documento.createElement("canvas");
  amostra.width = amostra.height = 1;
  const pincel = amostra.getContext("2d", { willReadFrequently: true });
  if (!janela || !pincel) return;

  const coresModernas = /\b(?:oklch|oklab|lch|lab|hwb|color)\([^()]+\)/gi;
  const convertidas = new Map<string, string>();

  for (const elemento of [pagina, ...pagina.querySelectorAll<HTMLElement | SVGElement>("*")]) {
    if (!elemento.style) continue;
    const estilo = janela.getComputedStyle(elemento);
    for (const propriedade of Array.from(estilo)) {
      if (propriedade.startsWith("--")) continue;
      const valor = estilo.getPropertyValue(propriedade);
      const compatível = valor.replace(coresModernas, (cor) => {
        const anterior = convertidas.get(cor);
        if (anterior !== undefined) return anterior;

        pincel.clearRect(0, 0, 1, 1);
        pincel.fillStyle = cor;
        pincel.fillRect(0, 0, 1, 1);
        const canais = pincel.getImageData(0, 0, 1, 1).data;
        const rgb = "rgba(" + canais[0] + ", " + canais[1] + ", " + canais[2] + ", " + (canais[3] ?? 255) / 255 + ")";
        convertidas.set(cor, rgb);
        return rgb;
      });
      if (compatível !== valor) elemento.style.setProperty(propriedade, compatível, "important");
    }
  }
}
