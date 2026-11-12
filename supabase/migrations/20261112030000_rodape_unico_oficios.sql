-- Move o rodapé institucional escolhido do corpo do modelo padrão para o campo compartilhado.
do $$
declare
 corpo text;
 rodape_escolhido text;
begin
 if not exists(select 1 from public.configuracoes where rodape_html like '%1.038%' and rodape_html like '%Direito Recredenciado%') then
  return;
 end if;

 select modelo_html into corpo from public.modelos_oficio where chave='padrao' for update;
 rodape_escolhido := substring(corpo from '(<p[^>]*>Credenciada pela Portaria Min\.[^<]*664[^<]*</p>.*)$');
 if rodape_escolhido is null or rodape_escolhido not like '%09.801.291/0001-91%www.facesf.com.br</p>' then
  return;
 end if;

 update public.modelos_oficio
 set modelo_html=left(corpo, length(corpo)-length(rodape_escolhido))
 where chave='padrao';
 update public.configuracoes
 set rodape_html=rodape_escolhido
 where rodape_html like '%1.038%' and rodape_html like '%Direito Recredenciado%';
end $$;
