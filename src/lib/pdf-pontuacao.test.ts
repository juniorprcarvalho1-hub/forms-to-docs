import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { ajustarPontuacaoPdf } from "./pdf-pontuacao";
import { paginaHtmlRenderizacao } from "./automacao-html";

test("corrige a pontuação no texto, inclusive entre trechos formatados", () => {
  const { document } = parseHTML('<html><body><p>Capemisa , <strong>estudante&nbsp;</strong><i> ,</i> encaminhado (a).</p><p>CPF 123.456.789-00</p><pre>x , y</pre></body></html>');
  ajustarPontuacaoPdf(document.body as unknown as Node);
  expect(document.body.textContent).toBe("Capemisa, estudante, encaminhado(a).CPF 123.456.789-00x , y");
});

test("o renderizador automático normaliza o texto e preserva atributos", () => {
  const { html } = paginaHtmlRenderizacao('<p title="x , y">Atenciosamente&nbsp;,</p>', "a".repeat(32));
  expect(html).toContain('<p title="x , y">Atenciosamente,</p>');
});
