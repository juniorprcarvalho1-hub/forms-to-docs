/** Campos de formulários são texto, nunca HTML ou novas tags do modelo. */
export function preencherModeloSeguro(
  modelo: string,
  valores: Record<string, string | undefined | null>,
): string {
  return modelo.replace(/\{\{([^}]+)\}\}/g, (_, chave: string) =>
    String(valores[chave] ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;"),
  );
}
