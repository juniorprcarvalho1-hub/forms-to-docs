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
 const f=fixture();await handleRespostas(f.request({"Nome do supervisor":"Supervisor Exemplo","Nome do estagiário":"Aluno Exemplo",Curso:"Enfermagem",Período:"7º","Tipo de avaliação":"Final"}),f.db,"token");
 expect(f.saved.p_dados).toMatchObject({supervisor:"Supervisor Exemplo",estagiario:"Aluno Exemplo",periodo:"7",tipo_avaliacao:"AVALIAÇÃO FINAL"});
});
