import { supabase } from "@/integrations/supabase/client";
import type { ModeloDeclaracao, ConfiguracoesDeclaracao } from "@/lib/declaracoes";
import type { Configuracoes, ModeloOficio } from "@/lib/oficios";

export async function buscarConfiguracoesAtuais() {
  const { data, error } = await supabase
    .from("configuracoes")
    .select(
      "assinatura_url,cabecalho_html,cidade,digitos,form_declaracao_url,form_resposta_url,form_url,formato_numeracao,id,logo_url,modelo,modelo_declaracao_html,modelo_html,padrao_apolice,padrao_area_estagio,padrao_carga_horaria,padrao_cargo_coordenador,padrao_coordenador,padrao_destinatario,padrao_periodo,padrao_professor,padrao_registro_professor,padrao_seguradora,rodape_html,updated_at",
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Configurações não encontradas.");
  return data as unknown as Configuracoes & ConfiguracoesDeclaracao;
}

export async function buscarModelosOficioAtuais() {
  const { data, error } = await supabase.from("modelos_oficio").select("*").order("chave");
  if (error) throw error;
  return (data ?? []) as unknown as ModeloOficio[];
}

export async function buscarModelosDeclaracaoAtuais() {
  const { data, error } = await supabase.from("modelos_declaracao").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as ModeloDeclaracao[];
}

export async function buscarFontesOficioAtuais() {
  const [config, modelos] = await Promise.all([
    buscarConfiguracoesAtuais(),
    buscarModelosOficioAtuais(),
  ]);
  return { config, modelos };
}

export async function buscarFontesDeclaracaoAtuais() {
  const [config, modelos] = await Promise.all([
    buscarConfiguracoesAtuais(),
    buscarModelosDeclaracaoAtuais(),
  ]);
  return { config, modelos };
}
