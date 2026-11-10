import {expect,test} from "bun:test";
import {handleOficios,handleDeclaracoes,handleRespostas} from "../../supabase/functions/forms-handlers";
function fixture(){
 let saved:any;const rows:any={configuracoes:{formato_numeracao:"{{seq}}/{{ano}}",digitos:2,padrao_carga_horaria:"420 horas"},cursos:[{nome_formulario:"Nutrição",nome_oficial:"Nutrição",area_estagio:"Nutrição Clínica"},{nome_formulario:"Psicologia",nome_oficial:"Psicologia"}],professores:[],modulos_estagio:[{curso:"Nutrição",nome_formulario:"Clínica",nome_oficial:"Nutrição Clínica",carga_horaria:"120 horas",area_estagio:"Clínica"}]};
 const db:any={from:(t:string)=>({select:()=>({maybeSingle:async()=>({data:rows[t],error:null}),then:(fn:any)=>Promise.resolve({data:rows[t],error:null}).then(fn)})}),rpc:async(name:string,args:any)=>{saved=args;return{data:{ok:true,id:"id"},error:null}}};
 const request=(body:any)=>new Request("https://x",{method:"POST",headers:{"x-webhook-token":"token","x-facesf-id":"a".repeat(64),"x-facesf-source-hash":"b".repeat(64)},body:JSON.stringify(body)});
 return{db,request,get saved(){return saved}};
}
test("ofício usa curso/módulo e normaliza data brasileira",async()=>{
 const f=fixture();const r=await handleOficios(f.request({"Aluno(a)":"Aluno Exemplo",Curso:"Nutrição",Módulo:"Clínica",Data:"26/10/2026"}),f.db,"token");
 expect(r.status).toBe(200);expect(f.saved.p_dados).toMatchObject({nome:"Aluno Exemplo",modelo_chave:"nutricao",data:"2026-10-26",carga_horaria:"120 horas"});
});
test("declaração preserva todos os alunos e distingue nome do preceptor",async()=>{
 const f=fixture();await handleDeclaracoes(f.request({"Nome do preceptor":"Preceptor Exemplo","Nome do aluno":["Aluno Um","Aluno Dois"],Curso:"Psicologia"}),f.db,"token");
 expect(f.saved.p_dados.nome).toBe("Preceptor Exemplo");expect(f.saved.p_dados.alunos).toBe("Aluno Um; Aluno Dois");expect(f.saved.p_dados.modelo_chave).toBe("psicologia");
});
test("resposta identifica supervisor, estagiário e período",async()=>{
 const f=fixture();await handleRespostas(f.request({"Nome do supervisor":"Supervisor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:"Enfermagem",Período:"9º","Tipo de avaliação":"Final"}),f.db,"token");
 expect(f.saved.p_dados).toMatchObject({supervisor:"Supervisor Exemplo",estagiario:"Aluno Exemplo",periodo:"9",tipo_avaliacao:"AVALIAÇÃO FINAL"});
});

for (const [name, handler] of [["oficios",handleOficios],["declaracoes",handleDeclaracoes],["avaliacao",handleRespostas]] as const) {
 for (const course of ["", "Odontologia", "Enfermagem / Fisioterapia"]) {
  test(name+" rejeita curso ausente, desconhecido ou ambíguo: "+course,async()=>{
   const f=fixture();const r=await handler(f.request({"Aluno(a)":"Aluno Exemplo","Nome do preceptor":"Preceptor Exemplo","Nome do supervisor":"Supervisor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:course,Período:"9"}),f.db,"token");
   expect(r.status).toBe(422);expect(f.saved).toBeUndefined();
  });
 }
}
test("nota de avaliação não vira período",async()=>{
 const f=fixture();const r=await handleRespostas(f.request({"Nome do supervisor":"Supervisor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:"Enfermagem",Nota:"9"}),f.db,"token");
 expect(r.status).toBe(422);expect(f.saved).toBeUndefined();
});
test("período incompatível com curso não grava avaliação",async()=>{
 const f=fixture();const r=await handleRespostas(f.request({"Nome do supervisor":"Supervisor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:"Enfermagem",Período:"7"}),f.db,"token");
 expect(r.status).toBe(422);expect(f.saved).toBeUndefined();
});
test("períodos contraditórios não escolhem a primeira resposta",async()=>{
 const f=fixture();const r=await handleRespostas(f.request({"Nome do supervisor":"Supervisor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:"Enfermagem",Período:"9",Semestre:"10"}),f.db,"token");
 expect(r.status).toBe(422);expect(f.saved).toBeUndefined();
});
test("nome de outra pessoa não substitui supervisor",async()=>{
 const f=fixture();const r=await handleRespostas(f.request({"Nome do orientador":"Professor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:"Enfermagem",Período:"9"}),f.db,"token");
 expect(r.status).toBe(422);expect(f.saved).toBeUndefined();
});
test("ofício padrão fixa 420 horas mesmo com valor conflitante",async()=>{
 const f=fixture();const r=await handleOficios(f.request({"Aluno(a)":"Aluno Exemplo",Curso:"Enfermagem","Carga horária":"999 horas"}),f.db,"token");
 expect(r.status).toBe(200);expect(f.saved.p_dados.carga_horaria).toBe("420 horas");
});
test("módulo sem carga horária não herda 420 horas",async()=>{
 const f=fixture();const r=await handleOficios(f.request({"Aluno(a)":"Aluno Exemplo",Curso:"Nutrição",Módulo:"Não cadastrado"}),f.db,"token");
 expect(r.status).toBe(422);expect(f.saved).toBeUndefined();
});
test("preceptoria não aceita data final anterior à inicial",async()=>{
 const f=fixture();const r=await handleDeclaracoes(f.request({"Nome do preceptor":"Preceptor Exemplo",Curso:"Enfermagem","Data de início":"20/10/2026","Data de fim":"10/10/2026"}),f.db,"token");
 expect(r.status).toBe(422);expect(f.saved).toBeUndefined();
});
for(const [curso,periodos] of [["Enfermagem",["9","10"]],["Fisioterapia",["9","10"]],["Nutrição",["7","8"]],["Psicologia",["9","10"]]] as const){
 for(const periodo of periodos)test("avaliação aceita perfil "+curso+" "+periodo,async()=>{
  const f=fixture();const r=await handleRespostas(f.request({"Nome do supervisor":"Supervisor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:curso,Período:periodo}),f.db,"token");
  expect(r.status).toBe(200);expect(f.saved.p_dados.periodo).toBe(periodo);
 });
}

test("ofício aceita títulos exatos do formulário original",async()=>{
 const f=fixture();const r=await handleOficios(f.request({"Aluno(a)":"Aluno Exemplo",Curso:"Enfermagem","MATRÍCULA":"2026001","Professor(a) orientador(a)":"Docente Técnico","Qual seu estagio?":"Enfermagem Basico 1","CPF":"00000000000"}),f.db,"token");
 expect(r.status).toBe(200);expect(f.saved.p_dados.professor_orientador).toBe("Docente Técnico");expect(f.saved.p_dados.modulo).toBe("Enfermagem Basico 1");
});
test("preceptoria aceita títulos exatos do formulário original",async()=>{
 const f=fixture();const r=await handleDeclaracoes(f.request({"Nome completo do preceptor":"Preceptor Exemplo",Curso:"Enfermagem","Registro profissional":"0000","Campo de estágio":"Campo Técnico","Data de início":"02/10/2026","Data de fim":"30/10/2026","Nome(s) do(s) aluno(s)":"Aluno Um; Aluno Dois","E-mail do preceptor":"preceptor@example.com"}),f.db,"token");
 expect(r.status).toBe(200);expect(f.saved.p_dados.nome).toBe("Preceptor Exemplo");expect(f.saved.p_dados.alunos).toBe("Aluno Um; Aluno Dois");
});

test("avaliação de Fisioterapia aceita os nomes com (a) no formulário",async()=>{
 const f=fixture();
 const resposta=await handleRespostas(f.request({
  "NOME DO SUPERVISOR(A) DE CAMPO:":"Supervisor Exemplo",
  "NOME DO(A) ESTAGIÁRIO (A):":"Estagiário Exemplo",
  "CURSO:":"Fisioterapia;",
  "ÁREA DE ESTÁGIO:":["Atenção Básica;", "Ambulatorial;"],
  "ESTÁGIO SUPERVISIONADO:":"10ᵒ;",
  "Descreva o desempenho durante o período":"Bom",
 }),f.db,"token");
 expect(resposta.status).toBe(200);
 expect(f.saved.p_dados).toMatchObject({
  supervisor:"Supervisor Exemplo",
  estagiario:"Estagiário Exemplo",
  modelo_chave:"fisioterapia",
  periodo:"10",
 });
});
