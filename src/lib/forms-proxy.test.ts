import {expect,test} from "bun:test";
import {encaminharFormulario} from "./forms-proxy.server";
test("proxy mantém token e identificador sem encaminhar cookies ou autorização",async()=>{
 let sent:any;
 const r=await encaminharFormulario(new Request("https://site/api",{method:"POST",headers:{"content-type":"application/json","x-webhook-token":"private-token","x-facesf-id":"a".repeat(64),"cookie":"private-session","authorization":"Bearer user"},body:'{"Nome":"Teste"}'}),"oficios",async(url,init)=>{sent={url,init};return Response.json({ok:true})});
 expect(r.status).toBe(200);expect(sent.url).toContain("auxsyadqijcjngmujagx.supabase.co/functions/v1/formularios/oficios");
 const headers=new Headers(sent.init.headers);expect(headers.get("x-webhook-token")).toBe("private-token");expect(headers.get("x-facesf-id")).toBe("a".repeat(64));expect(headers.has("cookie")).toBe(false);expect(headers.has("authorization")).toBe(false);
});
test("timeout ou resposta não JSON preserva falha para reenvio",async()=>{
 const req=()=>new Request("https://site/api",{method:"POST",headers:{"x-webhook-token":"token"},body:"{}"});
 const r=await encaminharFormulario(req(),"declaracoes",async()=>new Response("<html>error</html>",{status:200}));expect(r.status).toBe(503);
 const e=await encaminharFormulario(req(),"declaracoes",async()=>{throw Error("secret")});expect(e.status).toBe(503);expect(await e.text()).not.toContain("secret");
});
