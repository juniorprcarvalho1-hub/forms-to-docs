-- A conta institucional continua lendo modelos para visualizar documentos.
do $$
declare tabela text;
begin
 foreach tabela in array array['configuracoes','modelos_oficio','modelos_declaracao','modelos_declaracao_resposta','orientadores','cursos','professores','modulos_estagio'] loop
  if to_regclass('public.'||tabela) is null then continue; end if;
  execute format('alter policy "Configuracao documental escrita" on public.%I using ((select private.automacao_dono())) with check ((select private.automacao_dono()))',tabela);
 end loop;
end $$;
