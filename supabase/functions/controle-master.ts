import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { criarServicoControle } from "../../src/lib/controle-usuarios.service.ts";
import { donoConfirmado, type ListaUsuarios } from "../../src/lib/controle-usuarios.ts";

const entrada = z.object({
  acao: z.enum(["listar", "cadastrar", "plano", "suspender"]),
  dados: z.unknown(),
}).strict();
const lista = z.object({
  pagina: z.number().int().min(1).max(10000).default(1),
  busca: z.string().trim().max(200).default(""),
}).strict();
const responder = (status: number, valor: unknown) => new Response(JSON.stringify(valor), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return responder(405, { erro: "Método não permitido." });
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return responder(401, { erro: "Entre novamente." });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identidade, error: authError } = await client.auth.getUser(authorization.slice(7));
  if (authError || !donoConfirmado(identidade.user)) return responder(403, { erro: "Acesso exclusivo do proprietário do sistema." });
  if (Number(request.headers.get("Content-Length") ?? 0) > 8192) return responder(413, { erro: "Pedido muito grande." });
  try {
    const leitor = request.body?.getReader();
    const partes: Uint8Array[] = [];
    let tamanho = 0;
    if (!leitor) return responder(400, { erro: "Pedido inválido." });
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > 8192) { await leitor.cancel(); return responder(413, { erro: "Pedido muito grande." }); }
      partes.push(value);
    }
    const corpo = new Uint8Array(tamanho);
    let posicao = 0;
    for (const parte of partes) { corpo.set(parte, posicao); posicao += parte.byteLength; }
    const pedido = entrada.parse(JSON.parse(new TextDecoder().decode(corpo)));
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const servico = criarServicoControle({
      identidade: async () => identidade.user,
      listar: async (dados) => {
        const { data, error } = await client.rpc("listar_usuarios_controle", { p_pagina: dados.pagina, p_busca: dados.busca });
        if (error) throw new Error("Não foi possível listar os usuários.");
        return data as ListaUsuarios;
      },
      criar: async (dados) => {
        const { data, error } = await admin.auth.admin.createUser({
          email: dados.email, password: dados.senha, email_confirm: true, user_metadata: { name: dados.nome },
        });
        if (error || !data.user) throw new Error("Não foi possível cadastrar. Confira os dados e se o e-mail já existe.");
        return { id: data.user.id };
      },
      remover: async (userId) => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw new Error("Falha ao cancelar cadastro incompleto.");
      },
      salvarPlano: async (dados) => {
        const { error } = await client.rpc("salvar_plano_usuario", {
          p_user_id: dados.userId, p_plano: dados.plano, p_vencimento: dados.vencimento,
          ...(dados.nome ? { p_nome: dados.nome } : {}),
        });
        if (error) throw new Error("Não foi possível salvar o plano.");
      },
      suspender: async (dados) => {
        const { error } = await client.rpc("suspender_usuario_controle", { p_user_id: dados.userId, p_suspenso: dados.suspenso });
        if (error) throw new Error("Não foi possível alterar a suspensão.");
      },
      bloquearLogin: async (userId, suspenso) => {
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: suspenso ? "876000h" : "none" });
        if (error) throw new Error("Não foi possível atualizar o login.");
      },
    });
    switch (pedido.acao) {
      case "listar": return responder(200, await servico.listar(lista.parse(pedido.dados)));
      case "cadastrar": return responder(200, await servico.cadastrar(pedido.dados));
      case "plano": return responder(200, await servico.salvarPlano(pedido.dados));
      case "suspender": return responder(200, await servico.suspender(pedido.dados));
    }
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return responder(400, { erro: "Confira os dados enviados." });
    return responder(400, { erro: error instanceof Error ? error.message : "Não foi possível concluir a operação." });
  }
});
