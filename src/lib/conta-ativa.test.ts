import { test, expect } from "bun:test";
import { comContaAtiva } from "./conta-ativa";
test("e-mail não executa com conta bloqueada ou erro no banco", async () => {
  for (const result of [
    { data: { liberado: false, motivo: "Conta suspensa" }, error: null },
    { data: null, error: { message: "falha" } },
    { data: {}, error: null },
  ]) {
    let enviados = 0;
    await expect(
      comContaAtiva(
        async () => result,
        async () => {
          enviados++;
        },
      ),
    ).rejects.toThrow();
    expect(enviados).toBe(0);
  }
});
test("operação executa uma vez somente após confirmar acesso ativo", async () => {
  let enviados = 0;
  expect(
    await comContaAtiva(
      async () => ({ data: { liberado: true }, error: null }),
      async () => {
        enviados++;
        return "enviado";
      },
    ),
  ).toBe("enviado");
  expect(enviados).toBe(1);
});
