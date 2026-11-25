-- Reduz a distância entre a assinatura e o nome da coordenadora.
update public.modelos_declaracao
set modelo_html=replace(modelo_html,
'alt="Assinatura de Millena Marília Canário Cabral e Sousa" style="position:absolute;left:20pt;top:586pt;width:220pt;height:76pt;object-fit:contain;"',
'alt="Assinatura de Millena Marília Canário Cabral e Sousa" style="position:absolute;left:20pt;top:593pt;width:220pt;height:76pt;object-fit:contain;"')
where chave in ('enfermagem','fisioterapia','nutricao','psicologia')
and modelo_html like '%alt="Assinatura de Millena Marília Canário Cabral e Sousa"%';
