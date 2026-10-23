import { expect,test } from "bun:test";
import { probeLegacyStorage } from "./sync-storage-probe.server";
test("nega ausência de credencial antes de acessar Storage",async()=>{
 let touched=false;
 const r=await probeLegacyStorage("",{authorize:async()=>false,inspect:async()=>{touched=true;return {files:0,readable:true}}});
 expect(r.status).toBe(401);expect(touched).toBe(false);
});
test("nega usuário comum sem expor erro do provedor",async()=>{
 let touched=false;
 const r=await probeLegacyStorage("user-token",{authorize:async()=>false,inspect:async()=>{touched=true;throw Error("secret")}});
 expect(r.status).toBe(403);expect(touched).toBe(false);expect(JSON.stringify(r)).not.toContain("secret");
});
test("retorna só resultado agregado de leitura privada",async()=>{
 const r=await probeLegacyStorage("server-secret",{authorize:async()=>true,inspect:async()=>({files:14,readable:true})});
 expect(r).toEqual({status:200,body:{ok:true,files:14,readable:true}});
});
test("credencial antiga inválida mantém sincronização bloqueada",async()=>{
 const r=await probeLegacyStorage("server-secret",{authorize:async()=>true,inspect:async()=>{throw Error("old-key-secret")}});
 expect(r.status).toBe(503);expect(JSON.stringify(r)).not.toContain("old-key-secret");
});
test("erro na autorização falha fechado",async()=>{
 const r=await probeLegacyStorage("server-secret",{authorize:async()=>{throw Error("key")},inspect:async()=>({files:14,readable:true})});
 expect(r.status).toBe(403);
});

test("listagem vazia não é prova de leitura privada",async()=>{
 const r=await probeLegacyStorage("server-secret",{authorize:async()=>true,inspect:async()=>({files:0,readable:true})});
 expect(r.status).toBe(503);
});
