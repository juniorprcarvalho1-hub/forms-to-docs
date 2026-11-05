import {expect,test} from "bun:test";
import {executarBridgeEmail} from "./automacao-email-bridge.adapter.server";
const req=()=>new Request("https://forms-to-docs.lovable.app/api/internal/documentos-email",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ticket:"0".repeat(64)})});
test("bridge trata rejeição do ticket como não autorizado e registra somente status técnico",async()=>{
 const response=await executarBridgeEmail(req(),{lovableKey:"test",gmailKey:"test",request:async(url:any,init?:any)=>{expect(String(url)).toContain("auxsyadqijcjngmujagx.supabase.co/functions/v1/documentos-worker/email");expect(JSON.parse(init.body)).toMatchObject({etapa:"envelope"});return Response.json({erro:"ticket_invalido"},{status:401});}});
 expect(response.status).toBe(401);expect(response.headers.get("x-facesf-upstream-status")).toBe("401");
 expect(await response.json()).toMatchObject({codigo:"ticket_invalido",incerto:false});
});
test("falha externa não expõe corpo nem credenciais",async()=>{
 const response=await executarBridgeEmail(req(),{lovableKey:"test",gmailKey:"test",request:async()=>Response.json({message:"private-value"},{status:403})});
 expect(response.status).toBe(503);expect(response.headers.get("x-facesf-upstream-status")).toBe("403");expect(await response.text()).not.toContain("private-value");
});
