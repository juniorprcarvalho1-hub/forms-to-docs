-- Permite editar somente o texto dos documentos no acervo compartilhado.
create function public.salvar_conteudo_documental(p_tipo text,p_id uuid,p_original text,p_html text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare salvo jsonb;
begin
 if not coalesce(private.controle_conta_ativa(auth.uid()),false) then raise exception 'ACESSO_DOCUMENTAL_NEGADO'; end if;
 if p_tipo is null or p_tipo not in ('oficios','declaracoes','declaracoes_resposta') then raise exception 'TIPO_DOCUMENTAL_INVALIDO'; end if;
 if p_html is null or btrim(p_html)='' or length(p_html)>2000000 then raise exception 'CONTEUDO_DOCUMENTAL_INVALIDO'; end if;
 execute format('update public.%I d set conteudo_html=$1 where d.id=$2 and d.conteudo_html is not distinct from $3 returning to_jsonb(d)',p_tipo)
 into salvo using p_html,p_id,p_original;
 if salvo is null then raise exception 'DOCUMENTO_ALTERADO_OU_INDISPONIVEL'; end if;
 return salvo;
end $$;
revoke all on function public.salvar_conteudo_documental(text,uuid,text,text) from public,anon;
grant execute on function public.salvar_conteudo_documental(text,uuid,text,text) to authenticated;
