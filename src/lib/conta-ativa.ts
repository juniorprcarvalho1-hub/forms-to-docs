type ResultadoAcesso = { data: unknown; error: unknown };
/** Revalida no banco antes de efeitos que não passam por RLS, como envio de e-mail. */
export async function comContaAtiva<T>(
  consultar: () => PromiseLike<ResultadoAcesso>,
  executar: () => Promise<T>,
): Promise<T> {
  const { data, error } = await consultar();
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    !("liberado" in data) ||
    data.liberado !== true
  ) {
    throw new Error("Sua conta não tem acesso ativo ao sistema.");
  }
  return executar();
}
