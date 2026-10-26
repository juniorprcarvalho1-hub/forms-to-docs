import {beforeAll,afterAll,expect,test} from "bun:test";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
let db:PGlite;const owner="00000000-0000-4000-8000-000000000001",user="00000000-0000-4000-8000-000000000002";
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema private;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,active boolean default true);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function private.controle_conta_ativa(u uuid) returns boolean language sql stable as $$select coalesce((select active from auth.users where id=u),false)$$;
 create function public.validar_webhook_legado(p_token text) returns boolean language sql as $$select p_token='test-token'$$;
 create table public.configuracoes(id boolean primary key,formato_numeracao text default 'Ofício {{seq}}/{{ano}}',digitos int default 2);
 insert into configuracoes(id) values(true);
 create table public.oficios(id uuid primary key default gen_random_uuid(),numero int not null,ano int not null,numero_formatado text not null,data date not null,nome text,created_by uuid,origem text,unique(numero,ano));
 create table public.declaracoes(id uuid primary key default gen_random_uuid(),nome text,created_by uuid,origem text);
 create table public.declaracoes_resposta(id uuid primary key default gen_random_uuid(),supervisor text,estagiario text,created_by uuid,origem text);
 grant usage on schema public,auth to authenticated,service_role;
 `);
 await db.query("insert into auth.users values($1,'juniorprcarvalho1@gmail.com',now(),true),($2,'clinic@example.com',now(),true)",[owner,user]);
 const dir=join(import.meta.dir,"../../supabase/migrations");const name=readdirSync(dir).find(n=>n.endsWith("_formularios_apps_script.sql"));if(!name)throw Error("Migração Forms ausente");
 await db.exec(readFileSync(join(dir,name),"utf8"));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("select public.definir_responsavel_forms('clinic@example.com')");
},30000);
afterAll(async()=>{await db?.close()});
async function save(destino:string,key:string,hash="a".repeat(64),data:any={nome:"Teste",data:"2026-10-26"},token="test-token"){
 return db.query<any>("select public.registrar_documento_forms($1,$2,$3,$4,$5::jsonb) as result",[token,destino,key,hash,JSON.stringify(data)]);
}
test("idempotência evita duplicar documento e mantém responsável",async()=>{
 const key="1".repeat(64);const a=await save("oficios",key),b=await save("oficios",key);
 expect(a.rows[0].result.id).toBe(b.rows[0].result.id);expect(b.rows[0].result.duplicado).toBe(true);
 const rows=await db.query<any>("select * from oficios");expect(rows.rows).toHaveLength(1);expect(rows.rows[0].created_by).toBe(user);
});
test("mesmo identificador com respostas diferentes não sobrescreve",async()=>{
 await expect(save("oficios","1".repeat(64),"b".repeat(64))).rejects.toThrow("FORMS_RESPONSE_CHANGED");
});
test("token inválido, conta suspensa e proprietário injetado são negados",async()=>{
 await expect(save("oficios","2".repeat(64),"a".repeat(64),{nome:"Teste",data:"2026-10-26"},"bad")).rejects.toThrow("FORMS_TOKEN_INVALID");
 await db.query("update auth.users set active=false where id=$1",[user]);await expect(save("oficios","2".repeat(64))).rejects.toThrow("FORMS_ACCOUNT_INACTIVE");
 await db.query("update auth.users set active=true where id=$1",[user]);
 await expect(save("oficios","2".repeat(64),"a".repeat(64),{nome:"Teste",data:"2026-10-26",created_by:owner})).rejects.toThrow("FORMS_FIELDS_INVALID");
});
test("declarações e respostas gravam sem campos protegidos",async()=>{
 expect((await save("declaracoes","3".repeat(64),"a".repeat(64),{nome:"Preceptor"})).rows[0].result.ok).toBe(true);
 expect((await save("declaracoes-resposta","4".repeat(64),"a".repeat(64),{supervisor:"Supervisor",estagiario:"Aluno"})).rows[0].result.ok).toBe(true);
});
test("somente dono confirmado configura responsável; clientes não inserem pela RPC",async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec("set role authenticated");
 await expect(db.query("select public.definir_responsavel_forms('clinic@example.com')")).rejects.toThrow("FORMS_OWNER_REQUIRED");
 await expect(save("oficios","5".repeat(64))).rejects.toThrow();
 await expect(db.query("select * from private.forms_receipts")).rejects.toThrow();
 await db.exec("reset role");
});
