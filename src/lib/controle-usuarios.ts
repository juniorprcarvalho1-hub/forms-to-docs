import { z } from "zod";
export const DONO_EMAIL = "juniorprcarvalho1@gmail.com";
export const PLANOS = {
  mensal: { nome: "Mensal", valor: 250, meses: 1 },
  semestral: { nome: "Semestral", valor: 1500, meses: 6 },
  anual: { nome: "Anual", valor: 3000, meses: 12 },
} as const;
export type Plano = keyof typeof PLANOS;
export type Identidade = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
};
export function donoConfirmado(user: Identidade | null | undefined): boolean {
  return Boolean(
    user?.id &&
    !user.is_anonymous &&
    user.email_confirmed_at &&
    user.email?.toLowerCase() === DONO_EMAIL,
  );
}
export function hojeISO(data = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}
const dataValida = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
export const planoSchema = z.enum(["mensal", "semestral", "anual"]);
export const vencimentoSchema = z.string().refine(dataValida, "Informe uma data válida.");
export function calcularVencimento(plano: Plano, base = hojeISO()): string {
  planoSchema.parse(plano);
  vencimentoSchema.parse(base);
  const original = new Date(base + "T12:00:00Z");
  const d = new Date(
    Date.UTC(original.getUTCFullYear(), original.getUTCMonth() + PLANOS[plano].meses, 1, 12),
  );
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(original.getUTCDate(), ultimo));
  return d.toISOString().slice(0, 10);
}
export const cadastroUsuarioSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome.").max(120),
    email: z
      .string()
      .trim()
      .email("Informe um e-mail válido.")
      .max(254)
      .transform((v) => v.toLowerCase()),
    senha: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .refine((v) => new TextEncoder().encode(v).length <= 72, "A senha deve ter até 72 bytes."),
    plano: planoSchema,
    vencimento: vencimentoSchema,
  })
  .strict();
export const alteracaoPlanoSchema = z
  .object({ userId: z.string().uuid(), plano: planoSchema, vencimento: vencimentoSchema })
  .strict();
export const suspensaoUsuarioSchema = z
  .object({ userId: z.string().uuid(), suspenso: z.boolean() })
  .strict();
export function situacaoAssinatura(
  a: { suspenso: boolean; vencimento: string },
  hoje = hojeISO(),
): "ativo" | "suspenso" | "vencido" {
  return a.suspenso ? "suspenso" : a.vencimento < hoje ? "vencido" : "ativo";
}
export type UsuarioGerenciado = {
  userId: string;
  nome: string;
  email: string;
  plano: Plano | null;
  vencimento: string | null;
  suspenso: boolean;
  createdAt: string;
};
export type ListaUsuarios = { usuarios: UsuarioGerenciado[]; total: number; pagina: number };
