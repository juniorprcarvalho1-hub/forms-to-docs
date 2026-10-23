-- Execute após as migrações de importações e acessos descritas em docs/IMPORTACOES.md.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated,service_role;
CREATE TABLE public.assinaturas_usuarios(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 nome text NOT NULL DEFAULT '' CHECK(length(nome)<=120),
 plano text NOT NULL CHECK(plano IN ('mensal','semestral','anual')),
 vencimento date NOT NULL,
 suspenso boolean NOT NULL DEFAULT false,
 criado_por uuid REFERENCES auth.users(id),
 atualizado_por uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assinaturas_usuarios ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.assinaturas_usuarios TO authenticated;
GRANT ALL ON public.assinaturas_usuarios TO service_role;

CREATE FUNCTION private.controle_dono(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id
  AND lower(u.email)='juniorprcarvalho1@gmail.com' AND u.email_confirmed_at IS NOT NULL)
$$;

-- Preserva os acessos já aprovados, copiando o plano institucional; não aprova contas pendentes.
INSERT INTO public.assinaturas_usuarios(user_id,nome,plano,vencimento,suspenso)
SELECT u.id,left(coalesce(u.raw_user_meta_data->>'name',''),120),
 CASE WHEN a.plano IN ('mensal','semestral','anual') THEN a.plano ELSE 'mensal' END,
 coalesce(a.vencimento,(now() AT TIME ZONE 'America/Fortaleza')::date),coalesce(a.status='bloqueada',false)
FROM auth.users u LEFT JOIN public.assinatura a ON a.id=true
WHERE NOT private.controle_dono(u.id) AND (
 EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin') OR
 EXISTS(SELECT 1 FROM public.acessos_autorizados aa WHERE aa.user_id=u.id AND aa.ativo)
);

CREATE FUNCTION private.controle_conta_ativa(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.controle_dono(p_user_id) OR EXISTS(
  SELECT 1 FROM public.assinaturas_usuarios s WHERE s.user_id=p_user_id AND NOT s.suspenso
  AND s.vencimento >= (now() AT TIME ZONE 'America/Fortaleza')::date)
$$;
CREATE FUNCTION private.controle_tem_papel(p_user_id uuid,p_role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.controle_conta_ativa(p_user_id) AND (
  (p_role='admin' AND private.controle_dono(p_user_id)) OR
  EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_user_id AND r.role=p_role))
$$;
-- Os RPCs legados que verificam has_role também deixam de autorizar administradores suspensos.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.controle_tem_papel(_user_id,_role) $$;
CREATE OR REPLACE FUNCTION public.acesso_documentos_aprovado() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.controle_conta_ativa(auth.uid()) $$;
CREATE POLICY "Proprio plano ou dono" ON public.assinaturas_usuarios FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR private.controle_dono(auth.uid()));

CREATE FUNCTION private.controle_exigir_dono() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.controle_dono(auth.uid()) THEN
  RAISE EXCEPTION 'Acesso exclusivo do proprietário do sistema.' USING ERRCODE='42501';
 END IF;
END $$;
CREATE FUNCTION private.controle_listar(p_pagina integer,p_busca text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE resultado jsonb; quantidade bigint;
BEGIN
 PERFORM private.controle_exigir_dono();
 IF p_pagina IS NULL OR p_pagina<1 OR p_pagina>10000 OR p_busca IS NULL OR length(p_busca)>200 THEN RAISE EXCEPTION 'Consulta inválida.'; END IF;
 SELECT count(*) INTO quantidade FROM auth.users u LEFT JOIN public.assinaturas_usuarios s ON s.user_id=u.id
 WHERE u.id<>auth.uid() AND (p_busca='' OR coalesce(u.email,'') ILIKE '%'||p_busca||'%' OR coalesce(s.nome,u.raw_user_meta_data->>'name','') ILIKE '%'||p_busca||'%');
 SELECT coalesce(jsonb_agg(t.item ORDER BY t.criado DESC,t.id),'[]'::jsonb) INTO resultado FROM (
  SELECT u.id,u.created_at AS criado,jsonb_build_object('userId',u.id,'nome',coalesce(s.nome,u.raw_user_meta_data->>'name',''),
   'email',coalesce(u.email,''),'plano',s.plano,'vencimento',s.vencimento,'suspenso',coalesce(s.suspenso,false),'createdAt',u.created_at) AS item
  FROM auth.users u LEFT JOIN public.assinaturas_usuarios s ON s.user_id=u.id
  WHERE u.id<>auth.uid() AND (p_busca='' OR coalesce(u.email,'') ILIKE '%'||p_busca||'%' OR coalesce(s.nome,u.raw_user_meta_data->>'name','') ILIKE '%'||p_busca||'%')
  ORDER BY u.created_at DESC,u.id LIMIT 20 OFFSET (p_pagina-1)*20
 ) t;
 RETURN jsonb_build_object('usuarios',resultado,'total',quantidade,'pagina',p_pagina);
END $$;
CREATE FUNCTION public.listar_usuarios_controle(p_pagina integer DEFAULT 1,p_busca text DEFAULT '') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.controle_listar(p_pagina,p_busca) $$;

CREATE FUNCTION private.controle_salvar_plano(p_user_id uuid,p_plano text,p_vencimento date,p_nome text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.controle_exigir_dono();
 IF p_user_id IS NULL OR private.controle_dono(p_user_id) THEN RAISE EXCEPTION 'A conta do proprietário não pode ser alterada.'; END IF;
 IF p_plano IS NULL OR p_plano NOT IN ('mensal','semestral','anual') OR p_vencimento IS NULL OR NOT isfinite(p_vencimento) OR (p_nome IS NOT NULL AND length(trim(p_nome))>120) THEN RAISE EXCEPTION 'Plano ou vencimento inválido.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Conta não encontrada.'; END IF;
 INSERT INTO public.assinaturas_usuarios(user_id,nome,plano,vencimento,criado_por,atualizado_por)
 VALUES(p_user_id,coalesce(trim(p_nome),''),p_plano,p_vencimento,auth.uid(),auth.uid())
 ON CONFLICT(user_id) DO UPDATE SET plano=EXCLUDED.plano,vencimento=EXCLUDED.vencimento,
  nome=CASE WHEN p_nome IS NULL THEN assinaturas_usuarios.nome ELSE trim(p_nome) END,
  updated_at=now(),atualizado_por=auth.uid();
END $$;
CREATE FUNCTION public.salvar_plano_usuario(p_user_id uuid,p_plano text,p_vencimento date,p_nome text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.controle_salvar_plano(p_user_id,p_plano,p_vencimento,p_nome) $$;
CREATE FUNCTION private.controle_suspender(p_user_id uuid,p_suspenso boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.controle_exigir_dono();
 IF p_user_id IS NULL OR private.controle_dono(p_user_id) OR p_suspenso IS NULL THEN RAISE EXCEPTION 'Operação inválida para a conta do proprietário.'; END IF;
 UPDATE public.assinaturas_usuarios SET suspenso=p_suspenso,atualizado_por=auth.uid(),updated_at=now() WHERE user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastre o plano antes de alterar a suspensão.'; END IF;
END $$;
CREATE FUNCTION public.suspender_usuario_controle(p_user_id uuid,p_suspenso boolean) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.controle_suspender(p_user_id,p_suspenso) $$;

-- Compatibilidade: o antigo RPC de aprovação também fica exclusivo do dono e não cria plano implícito.
CREATE FUNCTION private.controle_autorizar_legado(p_email text,p_ativo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE usuario uuid;
BEGIN
 PERFORM private.controle_exigir_dono();
 SELECT id INTO usuario FROM auth.users WHERE lower(email)=lower(trim(p_email));
 IF usuario IS NULL THEN RAISE EXCEPTION 'Conta não encontrada.'; END IF;
 PERFORM private.controle_suspender(usuario,NOT p_ativo);
END $$;
CREATE OR REPLACE FUNCTION public.autorizar_usuario_documentos(p_email text,p_ativo boolean) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.controle_autorizar_legado(p_email,p_ativo) $$;

CREATE FUNCTION private.controle_status(p_ip text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE assinatura public.assinaturas_usuarios%ROWTYPE; bloqueado boolean:=false; motivo text; papel boolean:=false;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão necessária.' USING ERRCODE='42501'; END IF;
 IF private.controle_dono(auth.uid()) THEN RETURN jsonb_build_object('liberado',true,'admin',true,'motivo',NULL); END IF;
 SELECT * INTO assinatura FROM public.assinaturas_usuarios WHERE user_id=auth.uid();
 IF NOT FOUND THEN motivo:='Seu acesso ainda não foi autorizado. Entre em contato com o responsável pelo sistema.';
 ELSIF assinatura.suspenso THEN motivo:='Seu acesso está suspenso. Entre em contato com o responsável pelo sistema.';
 ELSIF assinatura.vencimento<(now() AT TIME ZONE 'America/Fortaleza')::date THEN motivo:='Seu plano venceu. Entre em contato com o responsável para renovar.';
 END IF;
 IF motivo IS NULL AND to_regclass('public.ips_bloqueados') IS NOT NULL THEN
  SELECT EXISTS(SELECT 1 FROM public.ips_bloqueados WHERE ip=p_ip) INTO bloqueado;
  IF bloqueado THEN motivo:='Acesso bloqueado para este endereço de rede.'; END IF;
 END IF;
 IF motivo IS NULL THEN papel:=private.controle_tem_papel(auth.uid(),'admin'); END IF;
 RETURN jsonb_build_object('liberado',motivo IS NULL,'admin',papel,'motivo',motivo);
END $$;
CREATE FUNCTION public.status_acesso_usuario(p_ip text DEFAULT '') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.controle_status(p_ip) $$;

-- Políticas restritivas prevalecem mesmo sobre políticas antigas que liberem administradores.
DO $$ DECLARE tabela text; BEGIN
 FOREACH tabela IN ARRAY ARRAY['oficios','declaracoes','declaracoes_resposta','configuracoes','modelos_oficio','modelos_declaracao','modelos_declaracao_resposta','cursos','professores','pacientes','modulos_estagio','orientadores','importacoes','importacao_itens','integracoes_pacientes','acessos_autorizados'] LOOP
  IF to_regclass('public.'||tabela) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tabela);
   EXECUTE format('CREATE POLICY "Conta ativa obrigatoria" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.controle_conta_ativa(auth.uid())) WITH CHECK (private.controle_conta_ativa(auth.uid()))',tabela);
  END IF;
 END LOOP;
 FOREACH tabela IN ARRAY ARRAY['user_roles','assinatura','pagamentos','ips_bloqueados'] LOOP
  IF to_regclass('public.'||tabela) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tabela);
   EXECUTE format('CREATE POLICY "Gestao exclusiva do dono" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.controle_dono(auth.uid())) WITH CHECK (private.controle_dono(auth.uid()))',tabela);
  END IF;
 END LOOP;
END $$;
CREATE POLICY "Conta ativa nos arquivos institucionais" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
 USING(bucket_id<>'oficios' OR private.controle_conta_ativa(auth.uid()))
 WITH CHECK(bucket_id<>'oficios' OR private.controle_conta_ativa(auth.uid()));

REVOKE ALL ON FUNCTION private.controle_dono(uuid),private.controle_conta_ativa(uuid),private.controle_tem_papel(uuid,public.app_role),private.controle_exigir_dono(),private.controle_listar(integer,text),private.controle_salvar_plano(uuid,text,date,text),private.controle_suspender(uuid,boolean),private.controle_autorizar_legado(text,boolean),private.controle_status(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.controle_dono(uuid),private.controle_conta_ativa(uuid),private.controle_tem_papel(uuid,public.app_role),private.controle_exigir_dono(),private.controle_listar(integer,text),private.controle_salvar_plano(uuid,text,date,text),private.controle_suspender(uuid,boolean),private.controle_autorizar_legado(text,boolean),private.controle_status(text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.listar_usuarios_controle(integer,text),public.salvar_plano_usuario(uuid,text,date,text),public.suspender_usuario_controle(uuid,boolean),public.status_acesso_usuario(text),public.has_role(uuid,public.app_role),public.acesso_documentos_aprovado(),public.autorizar_usuario_documentos(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_controle(integer,text),public.salvar_plano_usuario(uuid,text,date,text),public.suspender_usuario_controle(uuid,boolean),public.status_acesso_usuario(text),public.has_role(uuid,public.app_role),public.acesso_documentos_aprovado(),public.autorizar_usuario_documentos(text,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.proximo_numero_oficio(p_ano integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.controle_conta_ativa(auth.uid()) THEN
  RAISE EXCEPTION 'Sua conta não tem acesso ativo.' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('facesf-importacao-oficios',0));
 RETURN (SELECT coalesce(max(numero),0)+1 FROM public.oficios WHERE ano=p_ano);
END $$;
REVOKE ALL ON FUNCTION public.proximo_numero_oficio(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proximo_numero_oficio(integer) TO authenticated,service_role;
COMMIT;
