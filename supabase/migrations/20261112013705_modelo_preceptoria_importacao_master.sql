CREATE OR REPLACE FUNCTION public.importar_registros(p_destino text, p_registros jsonb, p_origem text, p_chave uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item jsonb; permitido text[]; dados jsonb; base jsonb; colunas text; selecao text;
  chave text; registro uuid; criados int := 0; repetidos int := 0; ano_doc int; numero_doc int;
  cfg public.configuracoes%ROWTYPE; anterior public.importacoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para importar.'; END IF;
  IF NOT private.automacao_dono() THEN RAISE EXCEPTION 'Importar dados está disponível somente para a conta master.'; END IF;
  IF p_destino NOT IN ('pacientes','oficios','declaracoes','declaracoes_resposta') THEN RAISE EXCEPTION 'Destino inválido.'; END IF;
  IF p_destino = 'pacientes' AND NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Somente administradores podem importar pacientes.'; END IF;
  IF jsonb_typeof(p_registros) IS DISTINCT FROM 'array' OR jsonb_array_length(p_registros) NOT BETWEEN 1 AND 500 OR octet_length(p_registros::text) > 2000000 THEN RAISE EXCEPTION 'Importe de 1 a 500 registros, até 2 MB.'; END IF;
  IF length(p_origem) > 200 OR p_origem IS NULL OR p_chave IS NULL THEN RAISE EXCEPTION 'Origem ou identificador inválido.'; END IF;
  -- Serializa também entre usuários: evita corridas na numeração e nos fingerprints.
  PERFORM pg_advisory_xact_lock(hashtextextended('facesf-importacao-' || p_destino, 0));
  SELECT * INTO anterior FROM public.importacoes WHERE id=p_chave;
  IF FOUND THEN
    IF anterior.destino <> p_destino THEN RAISE EXCEPTION 'Identificador já utilizado.'; END IF;
    RETURN jsonb_build_object('inseridos',anterior.inseridos,'ignorados',anterior.ignorados);
  END IF;
  INSERT INTO public.importacoes(id,destino,origem,total,created_by) VALUES(p_chave,p_destino,p_origem,jsonb_array_length(p_registros),auth.uid());
  SELECT * INTO cfg FROM public.configuracoes LIMIT 1;
  permitido := CASE p_destino
    WHEN 'pacientes' THEN ARRAY['nome','cpf','email','telefone','data_nascimento','responsavel','endereco','curso']
    WHEN 'oficios' THEN ARRAY['nome','cpf','curso','matricula','data','instituicao','cargo','assunto','destinatario','modulo','professor_orientador','registro_professor','carga_horaria','periodo','area_estagio','seguradora','apolice','coordenador']
    WHEN 'declaracoes' THEN ARRAY['nome','email','curso','coren','hospital','data_inicio','data_fim','carga_horaria','alunos','data_emissao']
    ELSE ARRAY['estagiario','supervisor','curso','tipo_avaliacao','periodo','email_supervisor','email_destino','data_emissao'] END;
  FOR item IN SELECT value FROM jsonb_array_elements(p_registros) LOOP
    IF jsonb_typeof(item) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_each(item) e WHERE jsonb_typeof(e.value) <> 'string' OR length(e.value#>>'{}') > 2000) THEN RAISE EXCEPTION 'Registro inválido: use campos de texto de até 2.000 caracteres.'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE NOT k = ANY(permitido)) THEN RAISE EXCEPTION 'Campo não permitido para o destino.'; END IF;
    dados := item;
    IF p_destino = 'pacientes' THEN
      dados := dados || jsonb_build_object('cpf', regexp_replace(coalesce(dados->>'cpf',''),'[^0-9]','','g'));
      PERFORM public.validar_cadastro_paciente(dados);
    ELSIF length(trim(coalesce(dados->>CASE WHEN p_destino='declaracoes_resposta' THEN 'estagiario' ELSE 'nome' END,''))) < 2 THEN RAISE EXCEPTION 'Nome obrigatório.';
    END IF;
    IF p_destino LIKE 'declaracoes%' AND (coalesce(dados->>'curso','') !~* '(enferm|fisio|nutri|psico)' OR (p_destino='declaracoes_resposta' AND trim(coalesce(dados->>'supervisor',''))='')) THEN RAISE EXCEPTION 'Confira curso e supervisor.'; END IF;
    chave := md5(dados::text);
    IF EXISTS(SELECT 1 FROM public.importacao_itens WHERE destino=p_destino AND fingerprint=chave)
      OR (p_destino='pacientes' AND (
        (coalesce(dados->>'cpf','')<>'' AND EXISTS(SELECT 1 FROM public.pacientes WHERE cpf=dados->>'cpf'))
        OR EXISTS(SELECT 1 FROM public.pacientes WHERE lower(nome)=lower(trim(dados->>'nome'))
          AND data_nascimento IS NOT DISTINCT FROM nullif(dados->>'data_nascimento','')::date
          AND telefone=coalesce(dados->>'telefone','') AND email=coalesce(dados->>'email',''))
      )) THEN repetidos := repetidos+1; CONTINUE; END IF;
    base := jsonb_build_object('origem',p_origem);
    IF p_destino='pacientes' THEN
      base := base || jsonb_build_object('created_by',auth.uid());
      IF coalesce(dados->>'data_nascimento','')='' THEN dados := dados - 'data_nascimento'; END IF;
    ELSE
      IF p_destino='oficios' THEN
        ano_doc := extract(year FROM coalesce(nullif(dados->>'data','')::date,current_date));
        numero_doc:=public.proximo_numero_oficio(ano_doc);
        base := base || jsonb_build_object('numero',numero_doc,'ano',ano_doc,
          'numero_formatado',replace(replace(coalesce(nullif(cfg.formato_numeracao,''),'OFÍCIO Nº {{seq}}/{{ano}}'),'{{seq}}',lpad(numero_doc::text,greatest(coalesce(cfg.digitos,3),length(numero_doc::text)),'0')),'{{ano}}',ano_doc::text),
          'data',coalesce(nullif(dados->>'data',''),current_date::text),
          'destinatario',coalesce(cfg.padrao_destinatario,''),'assunto','Estágio Curricular Obrigatório',
          'carga_horaria',coalesce(cfg.padrao_carga_horaria,''),'periodo',coalesce(cfg.padrao_periodo,''),
          'area_estagio',coalesce(cfg.padrao_area_estagio,''),'professor_orientador',coalesce(cfg.padrao_professor,''),
          'registro_professor',coalesce(cfg.padrao_registro_professor,''),'seguradora',coalesce(cfg.padrao_seguradora,''),
          'apolice',coalesce(cfg.padrao_apolice,''),'coordenador',coalesce(cfg.padrao_coordenador,''));
      END IF;
      base := base || jsonb_build_object('modelo_chave', CASE
        WHEN coalesce(dados->>'curso','') ~* 'nutri' THEN 'nutricao'
        WHEN coalesce(dados->>'curso','') ~* 'psico' THEN 'psicologia'
        WHEN p_destino='oficios' THEN 'padrao'
        WHEN coalesce(dados->>'curso','') ~* 'fisio' THEN 'fisioterapia' ELSE 'enfermagem' END);
    END IF;
    dados := base || dados;
    SELECT string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') INTO colunas,selecao FROM jsonb_object_keys(dados) k;
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING id',p_destino,colunas,selecao,p_destino) INTO registro USING dados;
    INSERT INTO public.importacao_itens(destino,fingerprint,registro_id,importacao_id,created_by) VALUES(p_destino,chave,registro,p_chave,auth.uid());
    criados := criados+1;
  END LOOP;
  UPDATE public.importacoes SET inseridos=criados,ignorados=repetidos WHERE id=p_chave;
  RETURN jsonb_build_object('inseridos',criados,'ignorados',repetidos);
END $function$;

-- Modelos oficiais de Preceptoria. Os elementos de imagem ficam no Storage privado.
update public.modelos_declaracao
set modelo_html=replace($modelo$<style>.pagina-a4:has(.preceptoria-a4){padding:0!important}.preceptoria-a4 img{margin:0!important;display:block!important}</style>
<div class="preceptoria-a4" style="position:relative;width:100%;height:840pt;color:#000;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.35;">
<div aria-hidden="true" style="position:absolute;top:0;right:0;bottom:0;width:39pt;background:linear-gradient(to bottom,#ffde59 81%,#88181d 81%);"></div>
<img src="https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/public/oficios/conteudo/preceptoria-modelo-20261111-facesf.png" alt="FACESF" style="position:absolute;left:30pt;top:26pt;width:112pt;height:61pt;object-fit:contain;">
<img src="https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/public/oficios/conteudo/preceptoria-modelo-20261111-__NUCLEO__.png" alt="Marca do núcleo" style="position:absolute;left:431pt;top:26pt;width:122pt;height:61pt;object-fit:contain;">
<div style="position:absolute;top:96pt;left:25pt;width:514pt;text-align:center;font-size:6pt;line-height:7.5pt;letter-spacing:.55pt;font-weight:700;">
MISSÃO: CONTRIBUIR PARA O DESENVOLVIMENTO HUMANO E SOCIOECONÔMICO DA REGIÃO DO SEMI-ÁRIDO NORDESTINO, ATRAVÉS DA FORMAÇÃO DE PROFISSIONAIS APTOS AO PERMANENTE AUTODESENVOLVIMENTO TÉCNICO, INTELECTUAL E ÉTICO.
</div>
<div style="position:absolute;top:122pt;left:30pt;width:507pt;text-align:center;font-size:5pt;line-height:7.5pt;letter-spacing:.65pt;font-weight:700;">
<div>FACULDADE DE CIÊNCIAS HUMANAS E EXATAS DO SERTÃO DO SÃO FRANCISCO - FACESF</div>
<div>{{departamento}}</div>
<div>NÚCLEO DE PRÁTICAS E ESTUDOS EM SAÚDE - NUPES</div>
<div>NÚCLEO DE PRÁTICAS E ESTUDOS EM PSICOLOGIA - NUPEP</div>
<div style="letter-spacing:.2pt;">RUA CEL. TRAPIÁ, 201, CENTRO - BELÉM DO SÃO FRANCISCO/PE CEP.: 56440-000 CNPJ: 09.801.291/01-91 - TEL.: (87) 3876-1460 - WWW.FACESF.COM.BR</div>
</div>
<div aria-hidden="true" style="position:absolute;top:169.5pt;left:41pt;width:480pt;border-top:1px solid #000;"></div>
<div style="position:absolute;top:258pt;left:10pt;width:561pt;text-align:center;font-size:14pt;letter-spacing:1.1pt;font-weight:700;">DECLARAÇÃO</div>
<div style="position:absolute;top:331.5pt;left:11pt;width:520pt;max-height:137pt;overflow:visible;text-align:justify;font-size:12pt;line-height:16.5pt;overflow-wrap:anywhere;">
Declaramos que <strong>{{nome}} – {{conselho}} {{coren}}</strong> desenvolveu, no período de {{data_inicio}} a {{data_fim}}, atividades de Supervisão no campo do estágio obrigatório em {{curso}}, perfazendo {{carga_horaria}} horas de preceptoria junto a <strong>{{alunos}}</strong>.
</div>
<div style="position:absolute;top:474pt;left:11pt;width:495pt;text-align:right;font-size:12pt;">{{cidade}} - PE, {{data_emissao}}.</div>
<img src="https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/public/oficios/conteudo/preceptoria-modelo-20261111-assinatura-nathaly.png" alt="Assinatura de Nathaly Ferraz Queiroz Silva" style="position:absolute;left:81pt;top:591pt;width:89pt;height:37pt;object-fit:contain;">
<img src="https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/public/oficios/conteudo/preceptoria-modelo-20261111-assinatura-anna.png" alt="Assinatura de Anna Paula Rodrigues M. Silva" style="position:absolute;left:363pt;top:604pt;width:145pt;height:28pt;object-fit:contain;">
<div style="position:absolute;top:633pt;left:36pt;width:177pt;text-align:center;font-size:10.5pt;line-height:12.7pt;font-style:italic;">
Nathaly Ferraz Queiroz Silva<br>Coordenadora<br>NUPES/NUPEP
</div>
<div style="position:absolute;top:633pt;left:351pt;width:169pt;text-align:center;font-size:10.5pt;line-height:12.7pt;font-style:italic;">
Anna Paula Rodrigues M. Silva<br>Coordenadora de Estágio
</div>
<div aria-hidden="true" style="position:absolute;top:783.5pt;left:44pt;width:480pt;border-top:1px solid #000;"></div>
<div style="position:absolute;top:790pt;left:44pt;width:480pt;text-align:center;font-size:7pt;line-height:9pt;font-style:italic;">
Credenciada pela Portaria Min. Nº 664, de 06/07/2007 – Pub. no D.O.U. de 09/07/2007<br>
Curso de Psicologia autorizado pela Portaria Min. Nº 583 de 17/08/2015 – Pub. No D.O.U. de 18/08/2015 Rua Cel. Trapiá, 201, Centro - Belém do São Francisco/PE CEP.:56440-000<br>
CNPJ: 09.801.291/0001-91 - Tel.:(87) 3876-1460 - <u>www.facesf.com.br</u>
</div>
</div>$modelo$,'__NUCLEO__',case when chave='psicologia' then 'nupep' else 'nupes' end)
where chave in('enfermagem','fisioterapia','nutricao','psicologia');
