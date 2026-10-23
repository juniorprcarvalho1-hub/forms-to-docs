import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { donoConfirmado } from "./controle-usuarios";
import type { ControleDatabase } from "./controle-usuarios.db";
export type StatusAcesso = {
  liberado: boolean;
  admin: boolean;
  dono: boolean;
  ip: string;
  motivo: string | null;
};
export const verificarAcesso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatusAcesso> => {
    const req = getRequest();
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "desconhecido";
    // getUser consulta a identidade atual; metadados editáveis e papéis institucionais não definem o dono.
    const { data: auth, error: authError } = await context.supabase.auth.getUser();
    if (authError || !auth.user)
      throw new Error("Não foi possível verificar a sessão. Entre novamente.");
    // O dono consegue abrir a gestão sem importar cliente privilegiado ou depender das tabelas de planos.
    if (donoConfirmado(auth.user))
      return { liberado: true, admin: true, dono: true, ip, motivo: null };
    const db = context.supabase as unknown as SupabaseClient<ControleDatabase>;
    const { data, error } = await db.rpc("status_acesso_usuario", { p_ip: ip });
    if (error || !data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Não foi possível verificar as permissões de acesso.");
    const status = data as { liberado?: unknown; admin?: unknown; motivo?: unknown };
    if (typeof status.liberado !== "boolean" || typeof status.admin !== "boolean")
      throw new Error("Resposta de acesso inválida.");
    return {
      liberado: status.liberado,
      admin: status.admin,
      dono: false,
      ip,
      motivo: typeof status.motivo === "string" ? status.motivo : null,
    };
  });
