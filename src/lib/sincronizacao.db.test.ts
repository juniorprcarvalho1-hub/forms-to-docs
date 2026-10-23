import {beforeAll,afterAll,beforeEach,expect,test} from "bun:test";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
let a:PGlite,b:PGlite;
const id="00000000-0000-4000-8000-000000000099";
async function fixture(site:"cloud"|"external"){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table public.cursos(id uuid primary key,nome text not null);
 create table public.configuracoes(id boolean primary key,modelo text,webhook_token text default 'local-secret');
 grant select,insert,update,delete on public.cursos to authenticated;`);
 await db.exec(readFileSync(new URL("../../supabase/sync/engine.sql",import.meta.url),"utf8"));
 await db.query("insert into sync_private.settings(id,site) values(true,$1)",[site]);
 await db.exec(`insert into sync_private.tables(name,key_columns,columns) values('cursos',array['id'],array['id','nome']),('configuracoes',array['id'],array['id','modelo']);
 create trigger sync_capture after insert or update or delete on public.cursos for each row execute function sync_private.capture();
 create trigger sync_capture after insert or update or delete on public.configuracoes for each row execute function sync_private.capture();`);
 return db;
}
async function events(db:PGlite){return (await db.query<any>("select event from sync_private.outbox where ack_at is null order by seq")).rows.map(r=>r.event)}
async function deliver(from:PGlite,to:PGlite){
 const results=[];
 for(const e of await events(from)){
  const r=(await to.query<any>("select sync_private.receive_event($1::jsonb) as result",[JSON.stringify(e)])).rows[0].result;
  await from.query("select sync_private.ack_event($1::uuid,$2::jsonb)",[e.id,JSON.stringify(r)]);
  results.push(r);
 }
 return results;
}
beforeEach(async()=>{await a?.close();await b?.close();a=await fixture("cloud");b=await fixture("external")},30000);
afterAll(async()=>{await a?.close();await b?.close()});
test("INSERT/UPDATE/DELETE convergem nos dois sentidos sem ciclos",async()=>{
 await a.query("insert into cursos values($1,'Curso A')",[id]);await deliver(a,b);
 expect((await b.query<any>("select nome from cursos")).rows[0].nome).toBe("Curso A");expect(await events(b)).toHaveLength(0);
 await b.query("update cursos set nome='Curso B' where id=$1",[id]);await deliver(b,a);
 expect((await a.query<any>("select nome from cursos")).rows[0].nome).toBe("Curso B");
 await a.query("delete from cursos where id=$1",[id]);await deliver(a,b);
 expect((await b.query("select * from cursos")).rows).toHaveLength(0);
 expect((await b.query<any>("select deleted,payload from sync_private.records")).rows[0]).toMatchObject({deleted:true,payload:{nome:"Curso B"}});
},30000);
test("evento repetido e ACK perdido não duplicam nem reemitem",async()=>{
 await a.query("insert into cursos values($1,'A')",[id]);const [e]=await events(a);
 for(let i=0;i<2;i++)await b.query("select sync_private.receive_event($1::jsonb)",[JSON.stringify(e)]);
 expect((await b.query("select * from cursos")).rows).toHaveLength(1);expect(await events(b)).toHaveLength(0);
});
test("evento antigo não sobrescreve edição recente",async()=>{
 await a.query("insert into cursos values($1,'A')",[id]);const [old]=await events(a);await deliver(a,b);
 await b.query("update cursos set nome='B'");await deliver(b,a);
 old.id=crypto.randomUUID();
 const r=await b.query<any>("select sync_private.receive_event($1::jsonb) as result",[JSON.stringify(old)]);
 expect(r.rows[0].result.status).toBe("stale");expect((await b.query<any>("select nome from cursos")).rows[0].nome).toBe("B");
});
test("concorrência preserva versões e resolução converge",async()=>{
 await a.query("insert into cursos values($1,'Inicial')",[id]);await deliver(a,b);
 await a.query("update cursos set nome='Cloud'");await b.query("update cursos set nome='Externo'");
 const results=await deliver(a,b);expect(results[0].status).toBe("conflict");await deliver(b,a);
 expect((await b.query<any>("select nome from cursos")).rows[0].nome).toBe("Externo");
 const c=(await b.query<any>("select id from sync_private.conflicts where resolved_at is null limit 1")).rows[0];
 await b.query("select sync_private.resolve_conflict($1::uuid,'incoming')",[c.id]);
 await deliver(b,a);await deliver(a,b);
 expect((await a.query<any>("select nome from cursos")).rows[0].nome).toBe("Cloud");
 expect((await b.query<any>("select nome from cursos")).rows[0].nome).toBe("Cloud");
});
test("segredo não entra no evento nem é sobrescrito no destino",async()=>{
 await a.exec("insert into configuracoes values(true,'Modelo','cloud-secret')");
 await b.exec("insert into configuracoes values(true,'Modelo','external-secret')");
 const e=await events(a);expect(JSON.stringify(e)).not.toContain("secret");
 await deliver(a,b);expect((await b.query<any>("select webhook_token from configuracoes")).rows[0].webhook_token).toBe("external-secret");
});
test("clientes comuns não acessam filas ou aplicam eventos",async()=>{
 await a.exec("set role authenticated");
 await expect(a.query("select * from sync_private.outbox")).rejects.toThrow();
 await expect(a.query("select sync_private.receive_event('{}'::jsonb)")).rejects.toThrow();
 await a.exec("reset role");
});
test("tabela fora da allowlist e chave incompatível são recusadas",async()=>{
 await a.query("insert into cursos values($1,'A')",[id]);const [e]=await events(a);
 await expect(b.query("select sync_private.receive_event($1::jsonb)",[JSON.stringify({...e,table:"user_roles"})])).rejects.toThrow();
 await expect(b.query("select sync_private.receive_event($1::jsonb)",[JSON.stringify({...e,key:{id:"different"}})])).rejects.toThrow();
});
