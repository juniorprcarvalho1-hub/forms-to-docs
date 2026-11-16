const crc = Uint32Array.from({ length: 256 }, (_, valor) => {
  for (let bit = 0; bit < 8; bit++) valor = (valor & 1 ? 0xedb88320 : 0) ^ (valor >>> 1);
  return valor >>> 0;
});

export async function criarZip(arquivos: readonly { nome: string; conteudo: Blob }[]): Promise<Blob> {
  const partes: BlobPart[] = [];
  const diretorio: ArrayBuffer[] = [];
  const encoder = new TextEncoder();
  let posicao = 0;
  let tamanhoDiretorio = 0;
  if (arquivos.length > 65535) throw new Error("Selecione menos documentos por download.");

  for (const arquivo of arquivos) {
    const nome = encoder.encode(arquivo.nome);
    const tamanho = arquivo.conteudo.size;
    if (posicao + tamanho + nome.length + 76 + tamanhoDiretorio > 0xffffffff) {
      throw new Error("O pacote excede o tamanho suportado. Selecione menos documentos.");
    }
    let checksum = 0xffffffff;
    const leitor = arquivo.conteudo.stream().getReader();
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      for (const byte of value) checksum = crc[(checksum ^ byte) & 255]! ^ (checksum >>> 8);
    }
    checksum = (checksum ^ 0xffffffff) >>> 0;
    // ZIP sem compressão: os PDFs já têm compressão interna.
    const local = new DataView(new ArrayBuffer(30 + nome.length));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(12, 33, true);
    local.setUint32(14, checksum, true);
    local.setUint32(18, tamanho, true);
    local.setUint32(22, tamanho, true);
    local.setUint16(26, nome.length, true);
    new Uint8Array(local.buffer).set(nome, 30);

    const central = new DataView(new ArrayBuffer(46 + nome.length));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    new Uint8Array(central.buffer).set(new Uint8Array(local.buffer, 6, 22), 8);
    central.setUint32(42, posicao, true);
    new Uint8Array(central.buffer).set(nome, 46);
    partes.push(local.buffer, arquivo.conteudo);
    diretorio.push(central.buffer);
    posicao += local.byteLength + tamanho;
    tamanhoDiretorio += central.byteLength;
  }
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoDiretorio, true);
  fim.setUint32(16, posicao, true);
  return new Blob([...partes, ...diretorio, fim.buffer], { type: "application/zip" });
}
