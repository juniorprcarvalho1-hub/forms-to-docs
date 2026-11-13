/** Captura a página com o layout do navegador, incluindo kerning e pontuação. */
export async function capturarPaginaPdf(pagina: HTMLElement): Promise<HTMLCanvasElement> {
  const documento = pagina.ownerDocument;
  const copia = pagina.cloneNode(true) as HTMLElement;
  const largura = Math.ceil(pagina.getBoundingClientRect().width);
  const altura = Math.ceil(Math.max(pagina.getBoundingClientRect().height, pagina.scrollHeight));
  const escala = 2;

  await Promise.all(Array.from(copia.querySelectorAll("img"), async (img) => {
    const origem = img.getAttribute("src");
    if (!origem || origem.startsWith("data:")) return;
    const resposta = await fetch(new URL(origem, documento.baseURI), { signal: AbortSignal.timeout(8000) });
    if (!resposta.ok) throw new Error("Não foi possível carregar uma imagem do PDF.");
    const blob = await resposta.blob();
    img.src = await new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result));
      leitor.onerror = () => reject(leitor.error);
      leitor.readAsDataURL(blob);
    });
    img.removeAttribute("srcset");
    img.removeAttribute("crossorigin");
  }));

  const ns = "http://www.w3.org/2000/svg";
  const svg = documento.createElementNS(ns, "svg");
  svg.setAttribute("width", String(largura * escala));
  svg.setAttribute("height", String(altura * escala));
  svg.setAttribute("viewBox", "0 0 " + largura + " " + altura);
  const objeto = documento.createElementNS(ns, "foreignObject");
  objeto.setAttribute("width", String(largura));
  objeto.setAttribute("height", String(altura));
  const raiz = documento.createElement("div");
  for (const estilo of documento.head.querySelectorAll("style")) {
    raiz.appendChild(estilo.cloneNode(true));
  }
  raiz.appendChild(copia);
  objeto.appendChild(raiz);
  svg.appendChild(objeto);

  const imagem = new Image();
  imagem.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  await imagem.decode();
  const canvas = documento.createElement("canvas");
  canvas.width = largura * escala;
  canvas.height = altura * escala;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a captura do PDF.");
  contexto.fillStyle = "#fff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.drawImage(imagem, 0, 0);
  return canvas;
}
