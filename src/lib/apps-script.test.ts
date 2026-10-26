import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {Script,createContext} from "node:vm";
import {createHash} from "node:crypto";
const destinations=["oficios","declaracoes","declaracoes-resposta","pacientes"];
function app(destination="oficios"){
 const values:Record<string,string>={FACESF_TOKEN:"test-secret"};
 const calls:any[]=[];let now=1793000000000;let statuses:any[]=[];
 const answer={getId:()=>"response-1",getItemResponses:()=>[{getItem:()=>({getTitle:()=>"Nome do aluno"}),getResponse:()=>"Aluno Ficticio"},{getItem:()=>({getTitle:()=>"Alunos"}),getResponse:()=>["Um","Dois"]}],getRespondentEmail:()=>""};
 const form={getId:()=>"form-1",getResponse:()=>answer,getResponses:()=>[answer]};
 const triggers:any[]=[];
 const props={getProperty:(k:string)=>values[k]??null,setProperty:(k:string,v:string)=>{values[k]=v;return props},deleteProperty:(k:string)=>{delete values[k];return props},getProperties:()=>({...values})};
 const ctx:any=createContext({
  Date:class extends Date{static now(){return now}},
  FormApp:{getActiveForm:()=>form,openById:()=>form},
  PropertiesService:{getScriptProperties:()=>props},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  Utilities:{DigestAlgorithm:{SHA_256:"sha"},Charset:{UTF_8:"utf8"},computeDigest:(_:any,text:string)=>[...createHash("sha256").update(text).digest()].map(n=>n>127?n-256:n)},
  ScriptApp:{getProjectTriggers:()=>[...triggers],deleteTrigger:(t:any)=>{triggers.splice(triggers.indexOf(t),1)},newTrigger:(handler:string)=>{
    const b:any={forForm:()=>b,onFormSubmit:()=>b,timeBased:()=>b,everyMinutes:()=>b,create:()=>{const t={getHandlerFunction:()=>handler,getTriggerSourceId:()=>"form-1"};triggers.push(t);return t}};return b;
  }},
  UrlFetchApp:{fetch:(url:string,options:any)=>{calls.push({url,options});const r=statuses.shift()??{status:200,body:'{"ok":true}'};return{getResponseCode:()=>r.status,getContentText:()=>r.body}}},
  Logger:{log:()=>{}}
 });
 new Script(readFileSync(new URL("../../apps-script/"+destination+".gs",import.meta.url),"utf8")).runInContext(ctx);
 return{ctx,form,answer,calls,values,triggers,setStatuses:(v:any[])=>statuses=v,advance:()=>now+=3600000,event:{source:form,response:answer}};
}
for(const destination of destinations)test("script "+destination+" instala uma vez e usa endpoint correto",()=>{
 const a=app(destination);a.ctx.instalarIntegracao();a.ctx.instalarIntegracao();expect(a.triggers.length).toBe(2);
 a.ctx.enviarFACESF(a.event);
 expect(a.calls[0].url).toEndWith("/formularios/"+destination);
 expect(a.calls[0].options.headers["x-webhook-token"]).toBe("test-secret");
 expect(a.calls[0].options.headers["x-facesf-id"]).toMatch(/^[a-f0-9]{64}$/);
 expect(JSON.parse(a.calls[0].options.payload).Alunos).toEqual(["Um","Dois"]);
});
test("reenvio da mesma resposta mantém a chave e não guarda dados clínicos na fila",()=>{
 const a=app();a.ctx.instalarIntegracao();a.ctx.enviarFACESF(a.event);a.ctx.enviarFACESF(a.event);
 expect(a.calls[0].options.headers["x-facesf-id"]).toBe(a.calls[1].options.headers["x-facesf-id"]);
 expect(Object.keys(a.values).filter(k=>k.startsWith("FACESF_P_"))).toHaveLength(0);
});
test("falha temporária preserva referência e depois reenvia",()=>{
 const a=app();a.ctx.instalarIntegracao();a.setStatuses([{status:503,body:'{"error":"indisponivel"}'}]);
 expect(()=>a.ctx.enviarFACESF(a.event)).toThrow();
 const queue=Object.entries(a.values).filter(([k])=>k.startsWith("FACESF_P_"));
 expect(queue).toHaveLength(1);expect(queue[0][1]).not.toContain("Ficticio");expect(queue[0][1]).not.toContain("test-secret");
 a.advance();a.ctx.processarPendentesFACESF();expect(a.calls).toHaveLength(2);
 expect(Object.keys(a.values).filter(k=>k.startsWith("FACESF_P_"))).toHaveLength(0);
});
test("HTTP200 com HTML não é sucesso e token inválido exige reenvio manual",()=>{
 const a=app();a.ctx.instalarIntegracao();a.setStatuses([{status:200,body:"<html>login</html>"}]);expect(()=>a.ctx.enviarFACESF(a.event)).toThrow();
 a.advance();a.setStatuses([{status:401,body:'{"error":"token"}'}]);a.ctx.processarPendentesFACESF();
 a.advance();a.ctx.processarPendentesFACESF();expect(a.calls).toHaveLength(2);
 a.values.FACESF_TOKEN="new-token";a.ctx.reenviarPendentesFACESF();expect(a.calls).toHaveLength(3);
});
test("instalador exige token e contexto de formulário",()=>{
 const a=app();delete a.values.FACESF_TOKEN;expect(()=>a.ctx.instalarIntegracao()).toThrow();
});

test("pendências bloqueadas não impedem reenvio de respostas posteriores",()=>{
 const a=app();a.ctx.instalarIntegracao();
 for(let i=0;i<10;i++){
  const k=a.ctx.enfileirarFACESF_("form-1","blocked-"+i);
  const item=JSON.parse(a.values[k]!);item.blocked=true;item.createdAt=i;a.values[k]=JSON.stringify(item);
 }
 a.ctx.enfileirarFACESF_("form-1","due-response");
 a.ctx.processarPendentesFACESF();
 expect(a.calls).toHaveLength(1);
 expect(Object.keys(a.values).filter(k=>k.startsWith("FACESF_P_"))).toHaveLength(10);
});
