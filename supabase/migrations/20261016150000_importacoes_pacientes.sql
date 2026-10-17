-- Cadastros administrativos: não armazena diagnóstico, anamnese ou prontuário.
CREATE TABLE public.pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 2 AND 200),
  cpf text NOT NULL DEFAULT '' CHECK (cpf = '' OR cpf ~ '^[0-9]{11}$'),
  email text NOT NULL DEFAULT '', telefone text NOT NULL DEFAULT '',
  data_nascimento date, responsavel text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '', curso text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_contato', 'cadastrado')),
  origem text NOT NULL DEFAULT 'importacao',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pacientes_cpf_unico ON public.pacientes(cpf) WHERE cpf <> '';
CREATE INDEX pacientes_nome_idx ON public.pacientes(lower(nome));
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.pacientes TO authenticated;
CREATE POLICY "Administradores gerenciam pacientes" ON public.pacientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER pacientes_updated_at BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.importacoes (
  id uuid PRIMARY KEY, destino text NOT NULL, origem text NOT NULL,
  total integer NOT NULL, inseridos integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0, created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.importacao_itens (
  destino text NOT NULL, fingerprint text NOT NULL,
  registro_id uuid NOT NULL, importacao_id uuid NOT NULL REFERENCES public.importacoes(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (created_by, destino, fingerprint)
);
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacao_itens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.importacoes TO authenticated;
GRANT SELECT, INSERT ON public.importacao_itens TO authenticated;
CREATE POLICY "Importacoes do usuario" ON public.importacoes FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Itens do usuario" ON public.importacao_itens FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE FUNCTION public.validar_cadastro_paciente(p jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE c text := regexp_replace(coalesce(p->>'cpf',''), '[^0-9]', '', 'g'); tamanho int; soma int; resto int;
BEGIN
  IF length(trim(coalesce(p->>'nome',''))) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION 'Nome completo inválido.'; END IF;
  IF c='' AND coalesce(p->>'telefone','')='' AND coalesce(p->>'email','')='' AND coalesce(p->>'data_nascimento','')='' THEN RAISE EXCEPTION 'Informe CPF, contato ou nascimento para identificar o paciente.'; END IF;
  IF c <> '' THEN
    IF c !~ '^[0-9]{11}$' OR c ~ '^([0-9])\1{10}$' THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
    FOR tamanho IN 9..10 LOOP
      soma := 0;
      FOR i IN 1..tamanho LOOP soma := soma + substring(c,i,1)::int * (tamanho + 2 - i); END LOOP;
      resto := (soma * 10) % 11; IF resto = 10 THEN resto := 0; END IF;
      IF resto <> substring(c,tamanho+1,1)::int THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
    END LOOP;
  END IF;
  IF coalesce(p->>'email','') <> '' AND p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;
  IF coalesce(p->>'telefone','') <> '' AND p->>'telefone' !~ '^[0-9]{10,15}$' THEN RAISE EXCEPTION 'Telefone inválido.'; END IF;
  IF coalesce(p->>'data_nascimento','') <> '' AND (p->>'data_nascimento')::date > current_date THEN RAISE EXCEPTION 'Nascimento no futuro.'; END IF;
END $$;

CREATE FUNCTION public.proximo_numero_oficio(p_ano integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('facesf-importacao-oficios',0));
 RETURN (SELECT coalesce(max(numero),0)+1 FROM public.oficios WHERE ano=p_ano);
END $$;
REVOKE ALL ON FUNCTION public.proximo_numero_oficio(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proximo_numero_oficio(integer) TO authenticated;

CREATE FUNCTION public.importar_registros(p_destino text, p_registros jsonb, p_origem text, p_chave uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  item jsonb; permitido text[]; dados jsonb; base jsonb; colunas text; selecao text;
  chave text; registro uuid; criados int := 0; repetidos int := 0; ano_doc int; numero_doc int;
  cfg public.configuracoes%ROWTYPE; anterior public.importacoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para importar.'; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.importar_registros(text,jsonb,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_registros(text,jsonb,text,uuid) TO authenticated;

CREATE TABLE public.integracoes_pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid NOT NULL REFERENCES auth.users(id),
  token_hash text NOT NULL UNIQUE, ativa boolean NOT NULL DEFAULT true,
  janela timestamptz NOT NULL DEFAULT now(), recebidos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integracoes_pacientes ENABLE ROW LEVEL SECURITY;
-- O hash e o token não são consultáveis pela API; criação/revogação somente pelas RPCs.
CREATE FUNCTION public.criar_integracao_pacientes() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE token text; ident uuid;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Acesso restrito a administradores.'; END IF;
  token := encode(gen_random_bytes(32),'hex');
  INSERT INTO public.integracoes_pacientes(created_by,token_hash) VALUES(auth.uid(),encode(digest(token,'sha256'),'hex')) RETURNING id INTO ident;
  RETURN jsonb_build_object('id',ident,'token',token);
END $$;
CREATE FUNCTION public.revogar_integracao_pacientes(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
  UPDATE public.integracoes_pacientes SET ativa=false WHERE id=p_id AND created_by=auth.uid();
END $$;
CREATE FUNCTION public.listar_integracoes_pacientes()
RETURNS TABLE(id uuid, ativa boolean, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT i.id,i.ativa,i.created_at FROM public.integracoes_pacientes i
  WHERE i.created_by=auth.uid() AND public.has_role(auth.uid(),'admin')
  ORDER BY i.created_at DESC LIMIT 30;
$$;
CREATE FUNCTION public.receber_paciente_forms(p_token text,p_dados jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE integracao public.integracoes_pacientes%ROWTYPE; ident uuid; c text;
BEGIN
  IF length(p_token) <> 64 OR octet_length(p_dados::text) > 20000 THEN RAISE EXCEPTION 'Requisição inválida.'; END IF;
  SELECT * INTO integracao FROM public.integracoes_pacientes WHERE token_hash=encode(digest(p_token,'sha256'),'hex') AND ativa FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.has_role(integracao.created_by,'admin'),false) THEN RAISE EXCEPTION 'Integração inválida ou desativada.'; END IF;
  IF integracao.janela < now()-interval '1 hour' THEN integracao.recebidos:=0; integracao.janela:=now(); END IF;
  IF integracao.recebidos >= 100 THEN RAISE EXCEPTION 'Limite de recebimentos atingido. Tente novamente mais tarde.'; END IF;
  IF jsonb_typeof(p_dados) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_each(p_dados) e WHERE jsonb_typeof(e.value) <> 'string' OR length(e.value#>>'{}')>2000) THEN RAISE EXCEPTION 'Dados inválidos.'; END IF;
  PERFORM public.validar_cadastro_paciente(p_dados);
  UPDATE public.integracoes_pacientes SET recebidos=integracao.recebidos+1,janela=integracao.janela WHERE id=integracao.id;
  c := regexp_replace(coalesce(p_dados->>'cpf',''),'[^0-9]','','g');
  PERFORM pg_advisory_xact_lock(hashtextextended('facesf-importacao-pacientes',0));
  IF (c<>'' AND EXISTS(SELECT 1 FROM public.pacientes WHERE cpf=c)) OR EXISTS(
    SELECT 1 FROM public.pacientes WHERE lower(nome)=lower(trim(p_dados->>'nome'))
    AND data_nascimento IS NOT DISTINCT FROM nullif(p_dados->>'data_nascimento','')::date
    AND telefone=coalesce(p_dados->>'telefone','') AND email=coalesce(p_dados->>'email','')
  ) THEN RETURN jsonb_build_object('ok',true,'duplicado',true); END IF;
  INSERT INTO public.pacientes(nome,cpf,email,telefone,data_nascimento,responsavel,endereco,curso,created_by,origem)
    VALUES(trim(p_dados->>'nome'),c,coalesce(p_dados->>'email',''),coalesce(p_dados->>'telefone',''),
      nullif(p_dados->>'data_nascimento','')::date,coalesce(p_dados->>'responsavel',''),coalesce(p_dados->>'endereco',''),
      coalesce(p_dados->>'curso',''),integracao.created_by,'google_forms') RETURNING id INTO ident;
  RETURN jsonb_build_object('ok',true,'duplicado',false);
END $$;
REVOKE ALL ON FUNCTION public.criar_integracao_pacientes() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.revogar_integracao_pacientes(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.listar_integracoes_pacientes() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.receber_paciente_forms(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_integracao_pacientes(), public.revogar_integracao_pacientes(uuid), public.listar_integracoes_pacientes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.receber_paciente_forms(text,jsonb) TO anon;
