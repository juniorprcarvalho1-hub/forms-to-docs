import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatusAcesso = {
  liberado: boolean;
  admin: boolean;
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

    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (admin) return { liberado: true, admin: true, ip, motivo: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bloqueio } = await supabaseAdmin
      .from("ips_bloqueados")
      .select("id")
      .eq("ip", ip)
      .maybeSingle();
    if (bloqueio) return { liberado: false, admin: false, ip, motivo: "Acesso bloqueado para este endereço de rede." };

    const { data: ass } = await supabaseAdmin.from("assinatura").select("status, vencimento").maybeSingle();
    if (ass?.status === "bloqueada")
      return { liberado: false, admin: false, ip, motivo: "Acesso suspenso. Entre em contato com o administrador." };
    if (ass && ass.vencimento < new Date().toISOString().slice(0, 10))
      return { liberado: false, admin: false, ip, motivo: "Assinatura vencida. Entre em contato com o administrador para renovar." };

    return { liberado: true, admin: false, ip, motivo: null };
  });
