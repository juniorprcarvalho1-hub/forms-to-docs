import { describe, expect, test } from "bun:test";
import {
  cpfValido,
  dataISO,
  escaparCelulaCsv,
  lerDelimitado,
  lerJson,
  revisarTabela,
  sugerirMapeamento,
  tabelaDaMatriz,
} from "./importacao";

describe("leitura de respostas", () => {
  test("lê CSV brasileiro, acentos, BOM, aspas e quebras de linha", () => {
    const t = lerDelimitado(
      '\uFEFFNome completo;Endereço\r\n"Pessoa Fictícia";"Rua; Teste\nCasa ""A"""\r\n',
    );
    expect(t.colunas).toEqual(["Nome completo", "Endereço"]);
    expect(t.linhas).toEqual([["Pessoa Fictícia", 'Rua; Teste\nCasa "A"']]);
  });
  test("reconhece cópia tabulada e vírgulas dentro de aspas", () => {
    expect(lerDelimitado("Nome\tE-mail\nTeste\tteste@example.invalid").linhas[0]).toEqual([
      "Teste",
      "teste@example.invalid",
    ]);
    expect(lerDelimitado('Nome,Endereço\nTeste,"Rua A, 10"').linhas[0]?.[1]).toBe("Rua A, 10");
  });
  test("não confunde separadores no título entre aspas", () => {
    expect(
      lerDelimitado('"Nome, como consta no documento";Email\nTeste;teste@example.invalid').colunas
        .length,
    ).toBe(2);
  });
  test("recusa dados truncados, cabeçalhos repetidos e arquivo vazio", () => {
    for (const t of ["Nome;Nome\nA;B", 'Nome\n"sem fechar', "Nome;Email\nA;B;C", ""])
      expect(() => lerDelimitado(t)).toThrow();
  });
  test("não descarta respostas além do limite silenciosamente", () => {
    expect(() =>
      tabelaDaMatriz([["Nome"], ...Array.from({ length: 501 }, (_, i) => [`Teste ${i}`])]),
    ).toThrow("500");
  });
  test("JSON preserva zeros à esquerda e recusa objetos aninhados", () => {
    expect(lerJson('[{"nome":"Teste","cpf":"01234567890"}]').linhas[0]?.[1]).toBe("01234567890");
    expect(() => lerJson('[{"nome":{"valor":"Teste"}}]')).toThrow("aninhados");
  });
  test("converte datas do Excel sem deslocar o dia", () => {
    expect(
      tabelaDaMatriz([["Nascimento"], [new Date("2000-02-29T00:00:00Z")]]).linhas[0]?.[0],
    ).toBe("2000-02-29");
  });
});

describe("validação e mapeamento", () => {
  test("mapeia títulos exatos, sem adivinhar nome do responsável como paciente", () => {
    const t = lerDelimitado(
      "Nome do responsável;Nome completo;WhatsApp;Data de nascimento\nResponsável fictício;Paciente fictício;(81) 99999-0000;29/02/2000",
    );
    const mapa = sugerirMapeamento(t.colunas, "pacientes");
    expect(mapa["nome"]).toBe("Nome completo");
    expect(mapa["responsavel"]).toBe("Nome do responsável");
    const linha = revisarTabela(t, mapa, "pacientes")[0]!;
    expect(linha.erros).toEqual([]);
    expect(linha.dados["telefone"]).toBe("81999990000");
    expect(linha.dados["data_nascimento"]).toBe("2000-02-29");
    expect(linha.avisos.length).toBe(1);
  });
  test("não aceita datas impossíveis, telefone curto ou CPF inválido", () => {
    expect(dataISO("31/02/2026")).toBeNull();
    expect(dataISO("29/02/2024")).toBe("2024-02-29");
    expect(cpfValido("111.111.111-11")).toBe(false);
    const t = lerDelimitado("Nome;CPF;WhatsApp\nTeste;123;99");
    expect(
      revisarTabela(t, sugerirMapeamento(t.colunas, "pacientes"), "pacientes")[0]?.erros.length,
    ).toBe(2);
  });
  test("detecta duplicatas normalizadas e mantém linhas inválidas corrigíveis", () => {
    const t = lerDelimitado(
      "Nome;E-mail\nTeste;teste@example.invalid\nTeste;teste@example.invalid\n;incorreto",
    );
    const r = revisarTabela(t, sugerirMapeamento(t.colunas, "pacientes"), "pacientes");
    expect(r[1]?.duplicada).toBe(true);
    expect(r[2]?.erros.length).toBe(2);
  });
  test("declarações exigem curso reconhecido e supervisor quando necessário", () => {
    const t = lerDelimitado("Nome;Curso\nPreceptor fictício;Desconhecido");
    expect(
      revisarTabela(t, sugerirMapeamento(t.colunas, "declaracoes"), "declaracoes")[0]?.erros[0],
    ).toContain("Curso");
  });
  test("neutraliza fórmulas ao exportar pendências", () => {
    expect(escaparCelulaCsv('=HYPERLINK("url")')).toBe('"\'=HYPERLINK(""url"")"');
  });
});
