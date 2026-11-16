export function semestreDaData(data: string | null | undefined): string | undefined {
  if (!data) return;
  const civil = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(data);
  if (civil) return civil[1] + "." + (Number(civil[2]) <= 6 ? 1 : 2);
  const instante = new Date(data);
  if (Number.isNaN(instante.getTime())) return;
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Fortaleza", year: "numeric", month: "numeric",
  }).formatToParts(instante);
  const ano = partes.find((parte) => parte.type === "year")?.value;
  const mes = Number(partes.find((parte) => parte.type === "month")?.value);
  return ano + "." + (mes <= 6 ? 1 : 2);
}

export async function listarPaginas<T extends { id: string }>(
  buscar: (inicio: number, fim: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const itens = new Map<string, T>();
  const tamanho = 500;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await buscar(inicio, inicio + tamanho - 1);
    if (error) throw error;
    const pagina = (data ?? []) as T[];
    for (const item of pagina) itens.set(item.id, item);
    if (pagina.length < tamanho) return [...itens.values()];
  }
}
