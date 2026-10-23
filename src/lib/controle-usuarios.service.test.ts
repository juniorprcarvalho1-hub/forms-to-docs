import { describe, expect, test } from "bun:test";
import { criarServicoControle } from "./controle-usuarios.service";
const owner = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "juniorprcarvalho1@gmail.com",
  email_confirmed_at: "2026-01-01",
};
const other = "00000000-0000-4000-8000-000000000002";
function fixture(identity: any = owner) {
  const calls: string[] = [];
  const deps = {
    identidade: async () => identity,
    listar: async () => {
      calls.push("listar");
      return { usuarios: [], total: 0, pagina: 1 };
    },
    criar: async () => {
      calls.push("criar");
      return { id: other };
    },
    remover: async () => {
      calls.push("remover");
    },
    salvarPlano: async () => {
      calls.push("plano");
    },
    suspender: async () => {
      calls.push("suspender");
    },
    bloquearLogin: async () => {
      calls.push("login");
    },
  };
  return { calls, deps, service: criarServicoControle(deps) };
}
const cadastro = {
  nome: "Pessoa Teste",
  email: "pessoa@example.com",
  senha: "SenhaInicial123!",
  plano: "mensal",
  vencimento: "2026-11-22",
};
describe("operações exclusivas do proprietário", () => {
  test("administrador institucional não pode listar, cadastrar, mudar plano nem suspender", async () => {
    const f = fixture({ ...owner, email: "admin@example.com", app_metadata: { role: "admin" } });
    for (const fn of [
      () => f.service.listar({ pagina: 1, busca: "" }),
      () => f.service.cadastrar(cadastro),
      () => f.service.salvarPlano({ userId: other, plano: "anual", vencimento: "2027-10-22" }),
      () => f.service.suspender({ userId: other, suspenso: true }),
    ])
      await expect(fn()).rejects.toThrow("proprietário");
    expect(f.calls).toEqual([]);
  });
  test("não admite dono com e-mail não confirmado ou sem sessão", async () => {
    for (const id of [null, { ...owner, email_confirmed_at: null }])
      await expect(fixture(id).service.cadastrar(cadastro)).rejects.toThrow("proprietário");
  });
  test("cria conta e plano sem registrar pagamento", async () => {
    const f = fixture();
    await f.service.cadastrar(cadastro);
    expect(f.calls).toEqual(["criar", "plano"]);
  });
  test("falha no plano remove apenas a conta recém-criada", async () => {
    const f = fixture();
    f.deps.salvarPlano = async () => {
      throw new Error("database failure");
    };
    await expect(f.service.cadastrar(cadastro)).rejects.toThrow("plano");
    expect(f.calls).toEqual(["criar", "remover"]);
  });
  test("não permite cadastrar e-mail do dono nem suspender a própria conta", async () => {
    const f = fixture();
    await expect(f.service.cadastrar({ ...cadastro, email: owner.email })).rejects.toThrow();
    await expect(f.service.suspender({ userId: owner.id, suspenso: true })).rejects.toThrow();
    await expect(
      f.service.salvarPlano({ userId: owner.id, plano: "mensal", vencimento: "2026-11-22" }),
    ).rejects.toThrow();
    expect(f.calls).toEqual([]);
  });
  test("suspende primeiro os dados e depois o login", async () => {
    const f = fixture();
    await f.service.suspender({ userId: other, suspenso: true });
    expect(f.calls).toEqual(["suspender", "login"]);
  });
  test("mantém bloqueio dos dados se o provedor de login falhar", async () => {
    const f = fixture();
    f.deps.bloquearLogin = async () => {
      throw new Error("provider");
    };
    const r = await f.service.suspender({ userId: other, suspenso: true });
    expect(f.calls).toEqual(["suspender"]);
    expect(r.aviso).toBeTruthy();
  });
});
