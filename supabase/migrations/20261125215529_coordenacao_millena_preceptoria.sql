-- Atualiza a coordenação nos quatro modelos de declaração de Preceptoria.
-- A imagem institucional existente foi substituída pela assinatura fornecida.
do $$
declare
  alterados integer;
begin
  if not exists (
    select 1 from storage.objects
    where bucket_id='oficios'
      and name='conteudo/preceptoria-modelo-20261111-assinatura-nathaly.png'
      and metadata->>'mimetype'='image/jpeg'
      and updated_at>='2026-11-25 21:51:00+00'::timestamptz
  ) then raise exception 'Confira a nova assinatura no armazenamento institucional.'; end if;

  update public.modelos_declaracao
  set modelo_html=replace(replace(replace(
    modelo_html,
    'alt="Assinatura de Nathaly Ferraz Queiroz Silva" style="position:absolute;left:81pt;top:591pt;width:89pt;height:37pt;object-fit:contain;"',
    'alt="Assinatura de Millena Marília Canário Cabral e Sousa" style="position:absolute;left:20pt;top:572pt;width:220pt;height:76pt;object-fit:contain;"'
  ),
    'position:absolute;top:633pt;left:36pt;width:177pt;text-align:center;font-size:10.5pt;line-height:12.7pt;font-style:italic;',
    'position:absolute;top:633pt;left:20pt;width:220pt;text-align:center;font-size:10.5pt;line-height:12.7pt;font-style:italic;'
  ),
    'Nathaly Ferraz Queiroz Silva<br>Coordenadora<br>NUPES/NUPEP',
    'Millena Marília Canário Cabral e Sousa<br>Coordenadora<br>NUPES/NUPEP'
  )
  where chave in ('enfermagem','fisioterapia','nutricao','psicologia')
    and modelo_html like '%alt="Assinatura de Nathaly Ferraz Queiroz Silva"%'
    and modelo_html like '%Nathaly Ferraz Queiroz Silva<br>Coordenadora<br>NUPES/NUPEP%';
  get diagnostics alterados=row_count;
  if alterados<>4 then raise exception 'Esperados quatro modelos, encontrados %.',alterados; end if;
end $$;
