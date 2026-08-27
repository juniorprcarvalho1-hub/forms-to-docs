import { supabase } from "@/integrations/supabase/client";
import type { ModeloDeclaracao, ConfiguracoesDeclaracao } from "@/lib/declaracoes";
import type { Configuracoes, ModeloOficio } from "@/lib/oficios";

export async function buscarConfiguracoesAtuais() {
  const { data, error } = await supabase.from("configuracoes").select("*").maybeSingle();
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