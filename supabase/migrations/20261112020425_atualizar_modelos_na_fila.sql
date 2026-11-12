-- Atualiza somente documentos que ainda não reservaram nem arquivaram um PDF.
create function private.atualizar_modelo_na_fila() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 tipo_modelo text := case tg_table_name
  when 'modelos_oficio' then 'oficios'
  when 'modelos_declaracao' then 'declaracoes'
  when 'modelos_declaracao_resposta' then 'declaracoes_resposta'
 end;
 chave_modelo text := to_jsonb(new)->>'chave';
begin
 if tg_table_name='configuracoes' then
  if (to_jsonb(new)-array['updated_at','webhook_token']) is not distinct from
     (to_jsonb(old)-array['updated_at','webhook_token']) then return new; end if;
 elsif new.modelo_html is not distinct from old.modelo_html then
  return new;
 end if;

 update private.documento_jobs j
 set snapshot=private.automacao_snapshot(j.tipo,j.snapshot->'documento'),
     estado=case when j.erro_codigo in ('modelo_ausente','campo_ausente','pdf_layout','imagem_invalida') then 'pendente' else j.estado end,
     tentativas=case when j.erro_codigo in ('modelo_ausente','campo_ausente','pdf_layout','imagem_invalida') then 0 else j.tentativas end,
     erro_codigo=case when j.erro_codigo in ('modelo_ausente','campo_ausente','pdf_layout','imagem_invalida') then null else j.erro_codigo end,
     disponivel_em=case when j.erro_codigo in ('modelo_ausente','campo_ausente','pdf_layout','imagem_invalida') then now() else j.disponivel_em end,
     updated_at=now()
 where j.etapa='pdf' and j.estado in('pendente','erro_recuperavel','bloqueado_configuracao')
   and j.html is null and j.pdf_path is null and j.pdf_base64 is null
   and (tipo_modelo is null or (j.tipo=tipo_modelo and j.snapshot->'documento'->>'modelo_chave'=chave_modelo));
 return new;
end $$;
revoke all on function private.atualizar_modelo_na_fila() from public,anon,authenticated;

create trigger atualizar_oficios_na_fila after update of modelo_html on public.modelos_oficio
for each row execute function private.atualizar_modelo_na_fila();
create trigger atualizar_preceptoria_na_fila after update of modelo_html on public.modelos_declaracao
for each row execute function private.atualizar_modelo_na_fila();
create trigger atualizar_respostas_na_fila after update of modelo_html on public.modelos_declaracao_resposta
for each row execute function private.atualizar_modelo_na_fila();
create trigger atualizar_configuracoes_na_fila after update on public.configuracoes
for each row execute function private.atualizar_modelo_na_fila();
