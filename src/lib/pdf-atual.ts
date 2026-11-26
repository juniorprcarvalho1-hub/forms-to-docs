/** Exporta a visualização aberta ou monta a versão atual para ações na lista.
 * PDFs da automação são arquivos históricos e não substituem o conteúdo exibido.
 */
export async function gerarPdfAtual(
  montarHtml: () => Promise<string>,
  renderizar: (html: string) => Promise<Blob>,
  htmlVisualizado?: string,
): Promise<Blob> {
  const html = htmlVisualizado ?? await montarHtml();
  if (!html.trim()) throw new Error("Não foi possível obter o conteúdo atual do documento.");
  return renderizar(html);
}
