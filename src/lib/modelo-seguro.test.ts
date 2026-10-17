import { expect, test } from "bun:test";
import { preencherModeloSeguro } from "./modelo-seguro";
test("campos importados não injetam HTML no documento", () => {
  expect(
    preencherModeloSeguro('<p title="{{nome}}">{{nome}}</p>', {
      nome: '<img src=x onerror="alert(1)">',
    }),
  ).toBe(
    '<p title="&lt;img src=x onerror=&quot;alert(1)&quot;&gt;">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>',
  );
});
test("substitui tags uma única vez e preserva o texto literal do paciente", () => {
  expect(
    preencherModeloSeguro("<p>{{nome}} / {{cpf}} / {{ausente}}</p>", {
      nome: "{{cpf}}",
      cpf: "FICTICIO",
    }),
  ).toBe("<p>{{cpf}} / FICTICIO / </p>");
});
