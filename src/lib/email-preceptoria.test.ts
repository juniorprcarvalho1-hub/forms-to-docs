import { expect, test } from "bun:test";
import { mensagemEmailPreceptoria } from "./email-preceptoria.ts";
import { mensagemEmailDeclaracao, type Declaracao } from "./declaracoes.ts";

const documento: Declaracao = {
  id: "local-test", nome: "Preceptor de teste", coren: "", hospital: "",
  data_inicio: "2030-01-01", data_fim: "2030-06-30", data_emissao: "2030-07-01",
  carga_horaria: "", alunos: "", email: "", curso: "Enfermagem", modelo_chave: "enfermagem",
  conteudo_html: null, pdf_path: null, email_enviado_em: null, origem: "", created_at: "",
};

test("manual preserva seu assunto e usa a mesma mensagem do worker", () => {
  const manual = mensagemEmailDeclaracao(documento);
  const automatico = mensagemEmailPreceptoria(documento);
  expect(manual.assunto).toBe("Declaração de Preceptoria - Preceptor de teste");
  expect(automatico.assunto).toBe("DECLARAÇÃO DE PRECEPTORIA.");
  expect(manual.corpo).toBe(automatico.corpo);
  expect(manual.corpo_html).toBe(automatico.corpo_html);
});

test("semestre institucional permanece 2026.2 independentemente das datas", () => {
  for (const data_inicio of ["2026-01-01", "2030-07-01", ""]) {
    const mensagem = mensagemEmailDeclaracao({ ...documento, data_inicio });
    expect(mensagem.corpo.match(/semestre letivo (\d{4}\.\d)/)?.[1]).toBe("2026.2");
    expect(mensagem.corpo).not.toContain("2030");
  }
});

test("saudação não interpola identidade do preceptor", () => {
  const mensagem = mensagemEmailDeclaracao(documento);
  expect(mensagem.corpo.split("\n")[0]).toBe("Prezado(a),");
  expect(mensagem.corpo).not.toContain(documento.nome);
  expect(mensagem.corpo_html).not.toContain(documento.nome);
});
