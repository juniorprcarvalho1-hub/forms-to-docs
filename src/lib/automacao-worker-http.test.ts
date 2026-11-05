import {expect,test} from "bun:test";
import {handleWorkerRequest} from "../../supabase/functions/automacao-worker-http";
function fixture(){
 const calls:string[]=[];let ticket:any={modo:"processar",job:{id:"job"}};
 const ports:any={consumir:async()=>{calls.push("ticket");return ticket;},processar:async(job:any)=>{expect(job.id).toBe("job");calls.push("job");return "concluido";},diagnosticar:async()=>{calls.push("diagnostico");return {pdf_a4:true};},envelope:async()=>{calls.push("envelope");return {to:"canonical@example.com"};},autorizarEmail:async()=>{calls.push("autorizar");return true;}};
 const req=(body:any={ticket:"a".repeat(64)},path="")=>new Request("https://x/functions/v1/documentos-worker"+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 return{calls,ports,req,setTicket:(value:any)=>ticket=value};
}
test("worker rejeita ausência de ticket antes de consultar banco",async()=>{const f=fixture();expect((await handleWorkerRequest(f.req({}),f.ports)).status).toBe(400);expect(f.calls).toEqual([]);});
test("ticket inválido ou já consumido não processa tarefa",async()=>{const f=fixture();f.setTicket(null);expect((await handleWorkerRequest(f.req(),f.ports)).status).toBe(401);expect(f.calls).toEqual(["ticket"]);});
test("ticket de processamento só executa a tarefa recebida atomicamente",async()=>{const f=fixture();const r=await handleWorkerRequest(f.req(),f.ports);expect(await r.json()).toMatchObject({processados:1,resultado:"concluido"});expect(f.calls).toEqual(["ticket","job"]);});
test("fila vazia não chama renderer",async()=>{const f=fixture();f.setTicket({modo:"processar",job:null});expect(await (await handleWorkerRequest(f.req(),f.ports)).json()).toMatchObject({processados:0});expect(f.calls).toEqual(["ticket"]);});
test("chamador não altera modo ou escolhe documento no body",async()=>{const f=fixture();expect((await handleWorkerRequest(f.req({ticket:"a".repeat(64),modo:"auditar"}),f.ports)).status).toBe(400);expect(f.calls).toEqual([]);});
test("diagnóstico exige escopo emitido no banco",async()=>{const f=fixture();f.setTicket({modo:"verificar",indice:0});expect(await (await handleWorkerRequest(f.req(),f.ports)).json()).toEqual({pdf_a4:true});expect(f.calls).toEqual(["ticket","diagnostico"]);});
test("endpoint de email só devolve envelope e autorização, sem chamar processador",async()=>{const f=fixture();const r=await handleWorkerRequest(f.req({ticket:"a".repeat(64),etapa:"envelope"},"/email"),f.ports);expect(await r.json()).toMatchObject({to:"canonical@example.com"});expect(f.calls).toEqual(["envelope"]);});
test("autorização final de email é separada e não retorna dados",async()=>{const f=fixture();const r=await handleWorkerRequest(f.req({ticket:"a".repeat(64),etapa:"enviar"},"/email"),f.ports);expect(await r.json()).toEqual({autorizado:true});expect(f.calls).toEqual(["autorizar"]);});
test("payload excessivo não chega ao banco",async()=>{const f=fixture();expect((await handleWorkerRequest(f.req({ticket:"a".repeat(10000)}),f.ports)).status).toBe(413);expect(f.calls).toEqual([]);});
test("health não expõe configuração nem documentos",async()=>{const f=fixture();const r=await handleWorkerRequest(new Request("https://x/documentos-worker/health"),f.ports);expect(await r.json()).toEqual({ok:true,service:"documentos-worker"});expect(f.calls).toEqual([]);});
