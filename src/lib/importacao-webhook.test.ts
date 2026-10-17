import { expect, test } from "bun:test";
import { receberCadastro } from "../routes/api/public/webhooks/pacientes";

test("webhook recusa token ausente e não revela pacientes", async () => {
  const r = await receberCadastro(
    new Request("https://example.invalid/api", { method: "POST", body: "{}" }),
  );
  expect(r.status).toBe(401);
});
test("webhook exige JSON e limita o tamanho real", async () => {
  const headers = { "x-webhook-token": "a".repeat(64), "content-type": "text/plain" };
  expect(
    (
      await receberCadastro(
        new Request("https://example.invalid/api", { method: "POST", headers, body: "{}" }),
      )
    ).status,
  ).toBe(415);
  headers["content-type"] = "application/json";
  expect(
    (
      await receberCadastro(
        new Request("https://example.invalid/api", {
          method: "POST",
          headers,
          body: "x".repeat(64001),
        }),
      )
    ).status,
  ).toBe(413);
});
test("webhook rejeita CPF e dados inválidos antes de tocar no banco", async () => {
  const r = await receberCadastro(
    new Request("https://example.invalid/api", {
      method: "POST",
      headers: { "x-webhook-token": "a".repeat(64), "content-type": "application/json" },
      body: JSON.stringify({ "Nome completo": ["Teste fictício"], CPF: ["11111111111"] }),
    }),
  );
  expect(r.status).toBe(422);
});
