import {
  cadastroUsuarioSchema,
  alteracaoPlanoSchema,
  suspensaoUsuarioSchema,
  donoConfirmado,
  DONO_EMAIL,
  type Identidade,
  type ListaUsuarios,
  type Plano,
} from "./controle-usuarios.ts";
type PlanoInput = { userId: string; plano: Plano; vencimento: string; nome?: string };
export type ControleDependencias = {
  identidade: () => Promise<Identidade | null>;
  listar: (input: { pagina: number; busca: string }) => Promise<ListaUsuarios>;
  criar: (input: { nome: string; email: string; senha: string }) => Promise<{ id: string }>;
  remover: (userId: string) => Promise<void>;
  salvarPlano: (input: PlanoInput) => Promise<void>;
  suspender: (input: { userId: string; suspenso: boolean }) => Promise<void>;
  bloquearLogin: (userId: string, suspenso: boolean) => Promise<void>;
};
export function criarServicoControle(dep: ControleDependencias) {
  async function dono() {
    const u = await dep.identidade();
    if (!u || !donoConfirmado(u)) throw new Error("Acesso exclusivo do proprietário do sistema.");
    return u;
  }
  function outro(id: string, owner: Identidade) {
    if (id === owner.id)
      throw new Error("A conta do proprietário não pode ser alterada por esta operação.");
  }
  return {
    async listar(input: { pagina: number; busca: string }) {
      await dono();
      return dep.listar(input);
    },
    async cadastrar(input: unknown) {
      await dono();
      const d = cadastroUsuarioSchema.parse(input);
      if (d.email === DONO_EMAIL) throw new Error("A conta do proprietário já está protegida.");
      const user = await dep.criar(d);
      try {
        await dep.salvarPlano({
          userId: user.id,
          nome: d.nome,
          plano: d.plano,
          vencimento: d.vencimento,
        });
      } catch {
        try {
          await dep.remover(user.id);
        } catch {
          throw new Error(
            "A conta foi criada, mas o plano não foi salvo. Localize o usuário na lista e salve o plano antes de liberar o acesso.",
          );
        }
        throw new Error(
          "Não foi possível salvar o plano. O cadastro foi cancelado; tente novamente.",
        );
      }
      return { userId: user.id };
    },
    async salvarPlano(input: unknown) {
      const owner = await dono();
      const d = alteracaoPlanoSchema.parse(input);
      outro(d.userId, owner);
      await dep.salvarPlano(d);
      return { ok: true };
    },
    async suspender(input: unknown) {
      const owner = await dono();
      const d = suspensaoUsuarioSchema.parse(input);
      outro(d.userId, owner);
      await dep.suspender(d);
      try {
        await dep.bloquearLogin(d.userId, d.suspenso);
        return { ok: true, aviso: null };
      } catch {
        return {
          ok: true,
          aviso: d.suspenso
            ? "O acesso aos dados foi suspenso, mas o bloqueio de novos logins não pôde ser confirmado."
            : "O acesso aos dados foi reativado, mas a liberação de novos logins não pôde ser confirmada.",
        };
      }
    },
  };
}
