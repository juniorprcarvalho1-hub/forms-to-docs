import {beforeAll,afterAll,beforeEach,expect,test} from "bun:test";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync,existsSync} from "node:fs";
import {join} from "node:path";
let db:PGlite;
const owner="00000000-0000-4000-8000-000000000001",user="00000000-0000-4000-8000-000000000002",other="00000000-0000-4000-8000-000000000003";
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema private;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,active boolean default true);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function private.controle_conta_ativa(u uuid) returns boolean language sql stable as $$select coalesce((select active from auth.users where id=u),false)$$;
 create function public.validar_webhook_legado(p_token text) returns boolean language sql as $$select p_token='test-token'$$;
 create table public.configuracoes(id boolean primary key,formato_numeracao text default 'Ofício {{seq}}/{{ano}}',digitos int default 3,webhook_token text default 'never-copy-token',cidade text default 'Cidade');
 insert into configuracoes(id) values(true);
 create table public.oficios(id uuid primary key default gen_random_uuid(),numero int not null,ano int not null,numero_formatado text not null,data date not null,nome text,curso text default 'Enfermagem',modelo_chave text default 'padrao',conteudo_html text,pdf_path text,created_by uuid,origem text,created_at timestamptz default now(),updated_at timestamptz default now(),unique(numero,ano));
 create table public.declaracoes(id uuid primary key default gen_random_uuid(),nome text,curso text default 'Enfermagem',modelo_chave text default 'enfermagem',conteudo_html text,pdf_path text,email_enviado_em timestamptz,created_by uuid,origem text,created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.declaracoes_resposta(id uuid primary key default gen_random_uuid(),supervisor text,estagiario text,curso text default 'Enfermagem',modelo_chave text default 'enfermagem',periodo text default '9',data_emissao date default current_date,conteudo_html text,pdf_path text,email_enviado_em timestamptz,email_destino text default '',created_by uuid,origem text,created_at timestamptz default now(),updated_at timestamptz default now());
 create table modelos_oficio(chave text primary key,modelo_html text);
 create table modelos_declaracao(chave text primary key,modelo_html text);
 create table modelos_declaracao_resposta(chave text primary key,modelo_html text);
 insert into modelos_oficio values('padrao','<p>{{nome}}</p>');
 insert into modelos_declaracao values('enfermagem','<p>{{nome}}</p>');
 insert into modelos_declaracao_resposta values('enfermagem','<p>{{supervisor}} {{periodo}}</p>');
 create table orientadores(id uuid primary key default gen_random_uuid(),curso text unique,nome text,email text);
 insert into orientadores(curso,nome,email) values('enfermagem','Orientador','');
 grant usage on schema public,auth to authenticated,service_role;
 `);
 await db.query("insert into auth.users values($1,'juniorprcarvalho1@gmail.com',now(),true),($2,'clinic@example.com',now(),true),($3,'other@example.com',now(),true)",[owner,user,other]);
 const dir=join(import.meta.dir,"../../supabase/migrations");
 await db.exec(readFileSync(join(dir,"20261026220519_formularios_apps_script.sql"),"utf8"));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("select public.definir_responsavel_forms('clinic@example.com')");
 const migration=join(dir,"20261104003505_automacao_documental.sql");
 if(existsSync(migration))await db.exec(readFileSync(migration,"utf8"));
},30000);
afterAll(async()=>{await db?.close()});
beforeEach(async()=>{
 await db.exec("reset role");
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec("update auth.users set active=true;delete from oficios;delete from declaracoes;delete from declaracoes_resposta;delete from private.forms_receipts;update orientadores set email='';");
 if((await db.query<any>("select to_regclass('private.automacao_config') as t")).rows[0].t)await db.exec("update private.automacao_config set habilitada=true");
});
async function save(type="oficios",data:any={nome:"Pessoa Teste",data:"2026-12-31"}){
 const k=crypto.randomUUID().replaceAll("-","").repeat(2);
 const r=await db.query<any>("select public.registrar_documento_forms('test-token',$1,$2,$3,$4::jsonb) as r",[type,k,"a".repeat(64),JSON.stringify(data)]);
 return {id:r.rows[0].r.id,key:k};
}
async function jobs(){
 if(!(await db.query<any>("select to_regclass('private.documento_jobs') as t")).rows[0].t)return[];
 return (await db.query<any>("select * from private.documento_jobs order by created_at,id")).rows;
}
async function claim(){return(await db.query<any>("select public.automacao_claim() as r")).rows[0].r;}
async function finish(j:any){return(await db.query<any>("select public.automacao_pdf_concluir($1,$2,$3,$4) as r",[j.id,j.lease_token,user+"/automacao/"+j.documento_id+"/v"+j.versao+".pdf","<p>Documento</p>"])).rows[0].r;}
test("recebimento cria PDF job atômico sem copiar token",async()=>{
 const d=await save();const all=await jobs();expect(all).toHaveLength(1);expect(all[0]).toMatchObject({documento_id:d.id,usuario_id:user,tipo:"oficios",etapa:"pdf",estado:"pendente",versao:1});
 expect(JSON.stringify(all[0].snapshot)).not.toContain("never-copy-token");
 const again=await db.query<any>("select public.registrar_documento_forms('test-token','oficios',$1,$2,$3::jsonb) as r",[d.key,"a".repeat(64),JSON.stringify({nome:"Pessoa Teste",data:"2026-12-31"})]);
 expect(again.rows[0].r.duplicado).toBe(true);expect(await jobs()).toHaveLength(1);
});
test("falha no enqueue desfaz documento e recibo na mesma transação",async()=>{
 await db.exec("alter table private.documento_jobs add constraint test_reject_job check(false) not valid");
 await expect(save()).rejects.toThrow();await db.exec("alter table private.documento_jobs drop constraint test_reject_job");
 expect((await db.query<any>("select count(*)::int as n from oficios")).rows[0].n).toBe(0);
 expect((await db.query<any>("select count(*)::int as n from private.forms_receipts")).rows[0].n).toBe(0);
});
test("claim não entrega mesma tarefa duas vezes e lease vencido muda token",async()=>{
 await save();const a=await claim();expect(a?.etapa).toBe("pdf");expect(await claim()).toBeNull();
 await db.query("update private.documento_jobs set lease_ate=now()-interval '1 second' where id=$1",[a.id]);
 const b=await claim();expect(b.id).toBe(a.id);expect(b.lease_token).not.toBe(a.lease_token);expect(await finish(a)).toBe(false);expect(await finish(b)).toBe(true);
});
test("edição invalida versão em andamento e exclusão remove tarefas",async()=>{
 const d=await save();const a=await claim();
 await db.query("update oficios set conteudo_html='<p>Edição</p>' where id=$1",[d.id]);
 expect(await finish(a)).toBe(false);const b=await claim();expect(b.versao).toBe(2);expect(b.snapshot.documento.conteudo_html).toBe("<p>Edição</p>");
 await db.query("delete from oficios where id=$1",[d.id]);expect(await finish(b)).toBe(false);expect(await jobs()).toHaveLength(0);
});
test("conta suspensa não recebe trabalho",async()=>{
 await save();await db.query("update auth.users set active=false where id=$1",[user]);expect(await claim()).toBeNull();
});
test("histórico migrado não entra em automação espontânea",async()=>{
 await db.query("insert into declaracoes_resposta(supervisor,estagiario,origem,created_by) values('Supervisor','Aluno','lovable_migracao',$1)",[user]);expect(await jobs()).toHaveLength(0);
});
test("PDF só cria envio depois de concluído; orientador ausente bloqueia só email",async()=>{
 await save("declaracoes-resposta",{supervisor:"Supervisor",estagiario:"Aluno"});expect((await jobs()).map(j=>j.etapa)).toEqual(["pdf"]);
 const pdf=await claim();expect(await finish(pdf)).toBe(true);const email=await claim();expect(email.etapa).toBe("email");
 const r=await db.query<any>("select public.automacao_email_iniciar($1,$2) as r",[email.id,email.lease_token]);expect(r.rows[0].r).toBeNull();
 const all=await jobs();expect(all.find(j=>j.etapa==="pdf").estado).toBe("concluido");expect(all.find(j=>j.etapa==="email")).toMatchObject({estado:"bloqueado_configuracao",erro_codigo:"orientador_ausente"});
});
test("envio iniciado com lease vencido exige confirmação e não é reentregue",async()=>{
 await save("declaracoes-resposta",{supervisor:"Supervisor",estagiario:"Aluno"});const pdf=await claim();await finish(pdf);
 await db.exec("update orientadores set email='orientador@example.com'");const email=await claim();
 const r=await db.query<any>("select public.automacao_email_iniciar($1,$2) as r",[email.id,email.lease_token]);expect(r.rows[0].r.to).toBe("orientador@example.com");
 await db.query("update private.documento_jobs set lease_ate=now()-interval '1 second' where id=$1",[email.id]);expect(await claim()).toBeNull();
 expect((await jobs()).find(j=>j.id===email.id).estado).toBe("envio_a_confirmar");
 await expect(db.query("select public.automacao_retomar('declaracoes_resposta',$1,'email')",[email.documento_id])).rejects.toThrow("ENVIO_PRECISA_CONFIRMACAO");
});
test("clientes só consultam próprios status e não executam consumidor",async()=>{
 const d=await save();await db.exec("set role authenticated");
 expect((await db.query<any>("select public.automacao_status('oficios',$1) as r",[d.id])).rows[0].r.pdf.estado).toBe("pendente");
 await expect(db.query("select * from private.documento_jobs")).rejects.toThrow();
 await expect(db.query("select public.automacao_claim()")).rejects.toThrow();
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
 expect((await db.query<any>("select public.automacao_status('oficios',$1) as r",[d.id])).rows[0].r).toBeNull();
 await expect(db.query("select public.automacao_retomar('oficios',$1,'pdf')",[d.id])).rejects.toThrow();
 await db.exec("reset role");
});
test("numeração continua anual no recebimento e não reinicia após reenvio",async()=>{
 const a=await save("oficios",{nome:"Pessoa Teste",data:"2026-12-31"});const b=await save("oficios",{nome:"Pessoa Teste",data:"2027-01-01"});
 const rows=await db.query<any>("select ano,numero from oficios where id in($1,$2) order by ano",[a.id,b.id]);expect(rows.rows).toEqual([{ano:2026,numero:1},{ano:2027,numero:1}]);
});
