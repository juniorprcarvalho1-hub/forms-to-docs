import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cadastroUsuarioSchema,
  alteracaoPlanoSchema,
  suspensaoUsuarioSchema,
} from "./controle-usuarios";
const listaSchema = z
  .object({
    pagina: z.number().int().min(1).max(10000).default(1),
    busca: z.string().trim().max(200).default(""),
  })
  .strict();
export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listaSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { controleServidor } = await import("./controle-usuarios.server");
    return controleServidor(context.supabase).listar(data);
  });
export const cadastrarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cadastroUsuarioSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { controleServidor } = await import("./controle-usuarios.server");
    return controleServidor(context.supabase).cadastrar(data);
  });
export const atualizarPlanoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => alteracaoPlanoSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { controleServidor } = await import("./controle-usuarios.server");
    return controleServidor(context.supabase).salvarPlano(data);
  });
export const alterarSuspensaoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => suspensaoUsuarioSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { controleServidor } = await import("./controle-usuarios.server");
    return controleServidor(context.supabase).suspender(data);
  });
