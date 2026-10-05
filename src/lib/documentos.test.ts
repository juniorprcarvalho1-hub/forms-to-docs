import { describe, expect, test } from "bun:test";

import { montarDeclaracaoHtml, type Declaracao, type ModeloDeclaracao } from "./declaracoes";
import {
  montarDeclaracaoRespostaHtml,
  type DeclaracaoResposta,
  type ModeloDeclaracaoResposta,
} from "./declaracoes-resposta";
import { montarDocumentoHtml, type Configuracoes, type ModeloOficio, type Oficio } from "./oficios";

const config = {
  cidade: "Belém do São Francisco",
  modelo: "",
  modelo_html: "",
  cabecalho_html: "<header>CABEÇALHO ATUAL</header>",
  rodape_html: "<footer>RODAPÉ E ASSINATURAS</footer>",
} as Configuracoes;

const oficio = {
  numero_formatado: "001/2026",
  data: "2026-08-27",
  nome: "Aluno Teste",
  curso: "Enfermagem",
  modelo_chave: "padrao",
  conteudo_html: null,
} as Oficio;

const declaracao = {
  nome: "Preceptor Teste",
  coren: "12345",
  curso: "Enfermagem",
  modelo_chave: "enfermagem",
  data_emissao: "2026-08-27",
  conteudo_html: null,
} as Declaracao;

describe("fonte atual dos documentos", () => {
  for (const chave of ["padrao", "nutricao", "psicologia"]) {
    test(`ofício ${chave} usa exatamente o modelo recebido do banco`, () => {
      const marcador = `MODELO-ATUAL-OFICIO-${chave}`;
      const modelos = [{ chave, modelo_html: `<p>${marcador} {{nome}}</p>` }] as ModeloOficio[];
      const html = montarDocumentoHtml({ ...oficio, modelo_chave: chave }, config, modelos);
      expect(html).toContain(`${marcador} Aluno Teste`);
      expect(html).toContain("CABEÇALHO ATUAL");
      expect(html).toContain("RODAPÉ E ASSINATURAS");
    });
  }

  for (const chave of ["enfermagem", "fisioterapia", "nutricao", "psicologia"]) {
    test(`declaração ${chave} usa exatamente o modelo recebido do banco`, () => {
      const marcador = `MODELO-ATUAL-DECLARACAO-${chave}`;
      const modelos = [{ chave, modelo_html: `<p>${marcador} {{nome}} {{conselho}} {{coren}}</p>` }] as ModeloDeclaracao[];
      const html = montarDeclaracaoHtml(
        { ...declaracao, curso: chave, modelo_chave: chave },
        config,
        modelos,
      );
      expect(html).toContain(marcador);
      expect(html).toContain("Preceptor Teste");
      expect(html).not.toContain("{{nome}}");
    });
  }

  test("edição manual do documento continua prevalecendo", () => {
    const html = montarDocumentoHtml(
      { ...oficio, conteudo_html: "<p>EDIÇÃO MANUAL</p>" },
      config,
      [{ chave: "padrao", modelo_html: "<p>MODELO NOVO</p>" }] as ModeloOficio[],
    );
    expect(html).toBe("<p>EDIÇÃO MANUAL</p>");
  });

  test("declaração de resposta inclui automaticamente o período recebido", () => {
    const resposta = {
      supervisor: "Supervisor Teste",
      estagiario: "Estagiário Teste",
      curso: "Fisioterapia",
      modelo_chave: "fisioterapia",
      tipo_avaliacao: "AVALIAÇÃO PARCIAL",
      periodo: "9",
      data_emissao: "2026-10-05",
      conteudo_html: null,
    } as DeclaracaoResposta;
    const modelos = [{
      chave: "fisioterapia",
      modelo_html: "<p>{{estagiario}} — {{periodo}}º período</p>",
    }] as ModeloDeclaracaoResposta[];

    const html = montarDeclaracaoRespostaHtml(resposta, modelos);
    expect(html).toContain("Estagiário Teste — 9º período");
    expect(html).not.toContain("{{periodo}}");
  });
});