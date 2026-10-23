import {beforeAll,afterAll,expect,test} from "bun:test";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {signEnvelope} from "../../supabase/functions/sync-core";
let db:PGlite;const secret="c".repeat(64);
const owner="00000000-0000-4000-8000-000000000001",user="00000000-0000-4000-8000-000000000002";
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema vault;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
 create table storage.objects(id uuid,name text,bucket_id text,metadata jsonb,updated_at timestamptz,version text);
 grant usage on schema public to anon,authenticated;
 `);
 await db.exec(readFileSync(new URL("../../supabase/sync/engine.sql",import.meta.url),"utf8"));
 await db.exec(readFileSync(new URL("../../supabase/sync/transport.sql",import.meta.url),"utf8"));
 await db.query("insert into sync_private.settings(id,site) values(true,'external')");
 await db.query("insert into vault.decrypted_secrets values('forms_sync_hmac',$1)",[secret]);
 await db.query("insert into auth.users values($1,'juniorprcarvalho1@gmail.com',now()),($2,'other@example.com',now())",[owner,user]);
},30000);
afterAll(async()=>{await db?.close()});
async function call(body:string,nonce=crypto.randomUUID(),timestamp=Math.floor(Date.now()/1000),signature?:string){
 signature??=await signEnvelope(secret,body,timestamp,nonce);
 return db.query<any>("select public.sync_exchange($1,$2::bigint,$3::uuid,$4) as result",[body,timestamp,nonce,signature]);
}
test("HMAC SQL é compatível com WebCrypto e rejeita replay",async()=>{
 const body=JSON.stringify({action:"status",payload:{}}),nonce=crypto.randomUUID();
 await db.exec("set role anon");
 expect((await call(body,nonce)).rows[0].result.paused).toBe(true);
 await expect(call(body,nonce)).rejects.toThrow("SYNC_UNAUTHORIZED");
 await db.exec("reset role");
});
test("assinatura inválida e timestamp expirado negam acesso",async()=>{
 const body=JSON.stringify({action:"status",payload:{}});
 await expect(call(body,crypto.randomUUID(),Math.floor(Date.now()/1000),"0".repeat(64))).rejects.toThrow("SYNC_UNAUTHORIZED");
 await expect(call(body,crypto.randomUUID(),Math.floor(Date.now()/1000)-120)).rejects.toThrow("SYNC_UNAUTHORIZED");
});
test("dono confirmado controla status e pausa; usuário comum não",async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec("set role authenticated");
 await expect(db.query("select public.sync_admin('status','{}'::jsonb)")).rejects.toThrow("SYNC_OWNER_REQUIRED");
 await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec("set role authenticated");
 expect((await db.query<any>("select public.sync_admin('status','{}'::jsonb) as r")).rows[0].r.paused).toBe(true);
 await expect(db.query("select public.sync_admin('apply','{}'::jsonb)")).rejects.toThrow();
 await db.exec("reset role");
});
test("usuário comum não provisiona segredo nem chama porta administrativa",async()=>{
 await db.exec("set role authenticated");
 await expect(db.query("select public.sync_configure($1)",["x".repeat(64)])).rejects.toThrow();
 await expect(db.query("select public.sync_server_exchange('status','{}'::jsonb)")).rejects.toThrow();
 await db.exec("reset role");
});
test("SQL arbitrária e arquivos fora do bucket/caminho permitido são recusados",async()=>{
 await expect(call(JSON.stringify({action:"sql",payload:{query:"select * from auth.users"}}))).rejects.toThrow("SYNC_ACTION_DENIED");
 await expect(call(JSON.stringify({action:"authorize_file",payload:{operation:"download",path:"../private"}}))).rejects.toThrow("SYNC_PATH_INVALID");
});
