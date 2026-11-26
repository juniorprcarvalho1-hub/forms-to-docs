-- Troca somente o endereço da logo no modelo de Psicologia; preserva o restante do HTML.
update public.modelos_declaracao
set modelo_html=replace(modelo_html,'https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/public/oficios/conteudo/preceptoria-modelo-20261111-nupep.png','/brand/nupep-psicologia.jpg')
where chave='psicologia' and position('https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/public/oficios/conteudo/preceptoria-modelo-20261111-nupep.png' in modelo_html)>0;
