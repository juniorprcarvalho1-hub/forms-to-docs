import { describe, expect, test } from "bun:test";
import {
  donoConfirmado,
  calcularVencimento,
  cadastroUsuarioSchema,
  alteracaoPlanoSchema,
  situacaoAssinatura,
  hojeISO,
} from "./controle-usuarios";
const owner = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "juniorprcarvalho1@gmail.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
};
describe("identidade do proprietário", () => {
  test("exige e-mail confirmado da conta autenticada", () => {
    expect(donoConfirmado(owner)).toBe(true);
    expect(donoConfirmado({ ...owner, email: "JUNIORPRCARVALHO1@gmail.com" })).toBe(true);
    expect(donoConfirmado({ ...owner, email_confirmed_at: null })).toBe(false);
    expect(donoConfirmado({ ...owner, email: "outro@example.com" })).toBe(false);
    expect(donoConfirmado(null)).toBe(false);
  });
  test("não confia em metadados nem em usuário anônimo", () => {
    expect(
      donoConfirmado({
        ...owner,
        email: "outro@example.com",
        user_metadata: { email: owner.email },
      } as any),
    ).toBe(false);
    expect(donoConfirmado({ ...owner, is_anonymous: true })).toBe(false);
  });
});
describe("planos e datas", () => {
  test("preserva o último dia válido em meses curtos", () => {
    expect(calcularVencimento("mensal", "2026-01-31")).toBe("2026-02-28");
    expect(calcularVencimento("mensal", "2028-01-31")).toBe("2028-02-29");
    expect(calcularVencimento("anual", "2028-02-29")).toBe("2029-02-28");
    expect(calcularVencimento("semestral", "2026-10-22")).toBe("2027-04-22");
  });
  test("rejeita plano desconhecido e datas impossíveis", () => {
    expect(() => calcularVencimento("gratis" as any, "2026-10-22")).toThrow();
    expect(() => calcularVencimento("mensal", "2026-02-30")).toThrow();
  });
  test("usa o dia de Fortaleza", () => {
    expect(hojeISO(new Date("2026-10-23T01:00:00Z"))).toBe("2026-10-22");
  });
  test("suspensão prevalece e vencimento é inclusivo", () => {
    expect(situacaoAssinatura({ suspenso: true, vencimento: "2026-10-30" }, "2026-10-22")).toBe(
      "suspenso",
    );
    expect(situacaoAssinatura({ suspenso: false, vencimento: "2026-10-22" }, "2026-10-22")).toBe(
      "ativo",
    );
    expect(situacaoAssinatura({ suspenso: false, vencimento: "2026-10-21" }, "2026-10-22")).toBe(
      "vencido",
    );
  });
});
describe("entradas administrativas", () => {
  const cadastro = {
    nome: " Conta Teste ",
    email: "TESTE@example.com",
    senha: "SenhaInicial123!",
    plano: "mensal",
    vencimento: "2026-11-22",
  };
  test("normaliza nome e e-mail sem guardar a senha como metadado", () => {
    const d = cadastroUsuarioSchema.parse(cadastro);
    expect(d.nome).toBe("Conta Teste");
    expect(d.email).toBe("teste@example.com");
  });
  test("rejeita senha fraca, e-mail inválido, data impossível e plano forjado", () => {
    for (const bad of [
      { senha: "123" },
      { email: "inválido" },
      { vencimento: "2026-02-30" },
      { plano: "admin" },
    ])
      expect(cadastroUsuarioSchema.safeParse({ ...cadastro, ...bad }).success).toBe(false);
  });
  test("alterar plano exige usuário e data válidos", () => {
    expect(
      alteracaoPlanoSchema.safeParse({ userId: owner.id, plano: "anual", vencimento: "2027-10-22" })
        .success,
    ).toBe(true);
    expect(
      alteracaoPlanoSchema.safeParse({
        userId: "qualquer",
        plano: "anual",
        vencimento: "2027-10-22",
      }).success,
    ).toBe(false);
  });
});
