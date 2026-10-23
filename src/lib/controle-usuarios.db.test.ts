import { beforeAll, afterAll, beforeEach, describe, expect, test } from "bun:test";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  user: "00000000-0000-4000-8000-000000000002",
  admin: "00000000-0000-4000-8000-000000000003",
  pending: "00000000-0000-4000-8000-000000000004",
  unconfirmed: "00000000-0000-4000-8000-000000000005",
};
let db: InstanceType<typeof PGlite>;
async function asUser(id: string, sql: string) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("SET ROLE authenticated");
  try {
    return await db.query(sql);
  } finally {
    await db.exec("RESET ROLE");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,public,storage TO authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
 CREATE TYPE public.app_role AS ENUM('admin','user');
 CREATE TABLE public.user_roles(id uuid DEFAULT gen_random_uuid(),user_id uuid,role public.app_role);
 CREATE TABLE public.acessos_autorizados(user_id uuid PRIMARY KEY,ativo boolean,aprovado_por uuid,created_at timestamptz DEFAULT now());
 CREATE TABLE public.assinatura(id boolean,plano text,status text,vencimento date);
 INSERT INTO public.assinatura VALUES(true,'mensal','ativa','2099-01-01');
 CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
 CREATE FUNCTION public.acesso_documentos_aprovado() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
 CREATE FUNCTION public.autorizar_usuario_documentos(p_email text,p_ativo boolean) RETURNS void LANGUAGE sql AS $$ SELECT $$;
 CREATE TABLE public.oficios(id uuid DEFAULT gen_random_uuid(),created_by uuid,nome text,numero integer,ano integer);
 ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.oficios TO authenticated;
 CREATE POLICY documentos ON public.oficios FOR SELECT TO authenticated USING(created_by=auth.uid() OR public.has_role(auth.uid(),'admin'));
 CREATE TABLE public.modulos_estagio(id int);CREATE TABLE public.orientadores(id int);CREATE TABLE public.importacoes(id int);CREATE TABLE public.importacao_itens(id int);
 DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['modulos_estagio','orientadores','importacoes','importacao_itens'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
 EXECUTE format('CREATE POLICY legado ON public.%I FOR ALL TO authenticated USING(true) WITH CHECK(true)',t);
 EXECUTE format('INSERT INTO public.%I VALUES(1)',t);
 END LOOP;END $$;
 CREATE FUNCTION public.proximo_numero_oficio(p_ano integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login necessário';END IF;RETURN 1;END $$;
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT SELECT ON storage.objects TO authenticated;
 CREATE POLICY objetos ON storage.objects FOR SELECT TO authenticated USING(true);
`);
  for (const [key, id] of Object.entries(ids)) {
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)", [
      id,
      key === "owner" || key === "unconfirmed"
        ? "juniorprcarvalho1@gmail.com"
        : key + "@example.com",
      key === "unconfirmed" ? null : "2026-01-01",
    ]);
  }
  await db.query(
    "INSERT INTO user_roles(user_id,role) VALUES($1,'admin'),($2,'user'),($3,'admin')",
    [ids.owner, ids.user, ids.admin],
  );
  await db.query(
    "INSERT INTO acessos_autorizados(user_id,ativo,aprovado_por) VALUES($1,true,$3),($2,true,$3)",
    [ids.user, ids.admin, ids.owner],
  );
  await db.query(
    "INSERT INTO oficios(created_by,nome) VALUES($1,'documento do usuário'),($2,'documento do admin')",
    [ids.user, ids.admin],
  );
  await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('oficios','teste.pdf')");
  const dir = join(import.meta.dir, "../../supabase/migrations");
  const migration = readdirSync(dir).find((f) => f.endsWith("_controle_usuarios_proprietario.sql"));
  if (!migration) throw new Error("Migração de gestão de usuários ausente.");
  await db.exec(readFileSync(join(dir, migration), "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "RESET ROLE;UPDATE public.assinaturas_usuarios SET suspenso=false,vencimento='2099-01-01'",
  );
});
describe("autorização real no PostgreSQL", () => {
  test("somente o dono confirmado lista usuários", async () => {
    const r = await asUser(ids.owner, "SELECT public.listar_usuarios_controle(1,'') AS dados");
    expect((r.rows[0] as any).dados.total).toBe(4);
    for (const id of [ids.user, ids.admin, ids.unconfirmed])
      await expect(asUser(id, "SELECT public.listar_usuarios_controle(1,'')")).rejects.toThrow();
  });
  test("administrador institucional não muda plano nem suspensão", async () => {
    await expect(
      asUser(ids.admin, `SELECT public.salvar_plano_usuario('${ids.user}','anual','2099-01-01')`),
    ).rejects.toThrow();
    await expect(
      asUser(ids.admin, `SELECT public.suspender_usuario_controle('${ids.user}',true)`),
    ).rejects.toThrow();
  });
  test("dono não pode suspender ou mudar o próprio plano", async () => {
    await expect(
      asUser(ids.owner, `SELECT public.suspender_usuario_controle('${ids.owner}',true)`),
    ).rejects.toThrow();
    await expect(
      asUser(ids.owner, `SELECT public.salvar_plano_usuario('${ids.owner}','anual','2099-01-01')`),
    ).rejects.toThrow();
  });
  test("sessão existente perde leitura de documentos e PDFs ao ser suspensa", async () => {
    expect((await asUser(ids.user, "SELECT * FROM oficios")).rows).toHaveLength(1);
    await asUser(ids.owner, `SELECT public.suspender_usuario_controle('${ids.user}',true)`);
    expect((await asUser(ids.user, "SELECT * FROM oficios")).rows).toHaveLength(0);
    expect((await asUser(ids.user, "SELECT * FROM storage.objects")).rows).toHaveLength(0);
    const s = await asUser(ids.user, "SELECT public.status_acesso_usuario('teste') AS dados");
    expect((s.rows[0] as any).dados.liberado).toBe(false);
  });
  test("admin suspenso não contorna bloqueio por papel nem RPC antiga", async () => {
    await asUser(ids.owner, `SELECT public.suspender_usuario_controle('${ids.admin}',true)`);
    expect((await asUser(ids.admin, "SELECT * FROM oficios")).rows).toHaveLength(0);
    const r = await asUser(ids.admin, `SELECT public.has_role('${ids.admin}','admin') AS admin`);
    expect((r.rows[0] as any).admin).toBe(false);
    await expect(
      asUser(ids.admin, "SELECT public.autorizar_usuario_documentos('pending@example.com',true)"),
    ).rejects.toThrow();
  });
  test("plano vencido bloqueia leitura com a mesma sessão", async () => {
    await asUser(
      ids.owner,
      `SELECT public.salvar_plano_usuario('${ids.user}','mensal','2000-01-01')`,
    );
    expect((await asUser(ids.user, "SELECT * FROM oficios")).rows).toHaveLength(0);
  });
  test("usuário não consegue reativar nem alterar plano diretamente", async () => {
    await expect(
      asUser(
        ids.user,
        "UPDATE public.assinaturas_usuarios SET suspenso=false,vencimento='2099-12-31'",
      ),
    ).rejects.toThrow();
    await expect(
      asUser(ids.user, `SELECT public.salvar_plano_usuario('${ids.user}','anual','2099-01-01')`),
    ).rejects.toThrow();
  });
  test("conta pendente não acessa os dados e ganha plano somente por ação do dono", async () => {
    expect((await asUser(ids.pending, "SELECT * FROM oficios")).rows).toHaveLength(0);
    await asUser(
      ids.owner,
      `SELECT public.salvar_plano_usuario('${ids.pending}','semestral','2099-01-01','Pessoa pendente')`,
    );
    const r = await asUser(ids.pending, "SELECT public.status_acesso_usuario('teste') AS dados");
    expect((r.rows[0] as any).dados.liberado).toBe(true);
  });
  test("suspensão bloqueia tabelas auxiliares e registros antigos de importação", async () => {
    await asUser(
      ids.owner,
      "SELECT public.suspender_usuario_controle('00000000-0000-4000-8000-000000000002',true)",
    );
    for (const table of ["modulos_estagio", "orientadores", "importacoes", "importacao_itens"]) {
      expect((await asUser(ids.user, "SELECT * FROM " + table)).rows).toHaveLength(0);
      await expect(asUser(ids.user, "INSERT INTO " + table + " VALUES(2)")).rejects.toThrow();
    }
  });
  test("numeração de ofícios rejeita sessão suspensa ou vencida", async () => {
    expect((await asUser(ids.user, "SELECT public.proximo_numero_oficio(2026)")).rows).toHaveLength(
      1,
    );
    await asUser(
      ids.owner,
      "SELECT public.suspender_usuario_controle('00000000-0000-4000-8000-000000000002',true)",
    );
    await expect(asUser(ids.user, "SELECT public.proximo_numero_oficio(2026)")).rejects.toThrow();
    await asUser(
      ids.owner,
      "SELECT public.suspender_usuario_controle('00000000-0000-4000-8000-000000000002',false)",
    );
    await asUser(
      ids.owner,
      "SELECT public.salvar_plano_usuario('00000000-0000-4000-8000-000000000002','mensal','2000-01-01')",
    );
    await expect(asUser(ids.user, "SELECT public.proximo_numero_oficio(2026)")).rejects.toThrow();
  });
  test("trocar plano preserva suspensão até reativação explícita", async () => {
    await asUser(ids.owner, `SELECT public.suspender_usuario_controle('${ids.user}',true)`);
    await asUser(
      ids.owner,
      `SELECT public.salvar_plano_usuario('${ids.user}','anual','2099-01-01')`,
    );
    expect((await asUser(ids.user, "SELECT * FROM oficios")).rows).toHaveLength(0);
    await asUser(ids.owner, `SELECT public.suspender_usuario_controle('${ids.user}',false)`);
    expect((await asUser(ids.user, "SELECT * FROM oficios")).rows).toHaveLength(1);
  });
});
