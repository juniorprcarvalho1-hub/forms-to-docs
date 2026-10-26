import {expect,test} from "bun:test";
import {handleFormsRequest} from "../../supabase/functions/forms-http";
function ports(){let calls=0;return{documents:async()=>{calls++;return Response.json({ok:true})},patients:async()=>{calls++;return Response.json({ok:true})},calls:()=>calls}}
test("recusa token ausente e corpo desproporcional antes do receptor",async()=>{
 const p=ports();let r=await handleFormsRequest(new Request("https://x/formularios/oficios",{method:"POST",body:"{}"}),p);expect(r.status).toBe(401);expect(p.calls()).toBe(0);
 r=await handleFormsRequest(new Request("https://x/formularios/oficios",{method:"POST",headers:{"x-webhook-token":"token","x-facesf-id":"a".repeat(64),"content-type":"application/json"},body:JSON.stringify({Nome:"x".repeat(65000)})}),p);expect(r.status).toBe(413);expect(p.calls()).toBe(0);
});
test("encaminha os quatro destinos e recusa JSON inválido",async()=>{
 for(const destino of ["oficios","declaracoes","declaracoes-resposta","pacientes"]){const p=ports();const r=await handleFormsRequest(new Request("https://x/formularios/"+destino,{method:"POST",headers:{"x-webhook-token":"token","x-facesf-id":"a".repeat(64),"content-type":"application/json"},body:JSON.stringify({Nome:"Teste"})}),p);expect(r.status).toBe(200);expect(p.calls()).toBe(1);}
 const p=ports();const r=await handleFormsRequest(new Request("https://x/formularios/oficios",{method:"POST",headers:{"x-webhook-token":"token","x-facesf-id":"a".repeat(64),"content-type":"application/json"},body:"[]"}),p);expect(r.status).toBe(400);
});
test("erros internos não vazam detalhes do provedor",async()=>{
 const r=await handleFormsRequest(new Request("https://x/formularios/oficios",{method:"POST",headers:{"x-webhook-token":"token","x-facesf-id":"a".repeat(64),"content-type":"application/json"},body:'{"Nome":"Teste"}'}),{documents:async()=>{throw Error("secret-key")},patients:async()=>Response.json({ok:true})});expect(r.status).toBe(503);expect(await r.text()).not.toContain("secret-key");
});
