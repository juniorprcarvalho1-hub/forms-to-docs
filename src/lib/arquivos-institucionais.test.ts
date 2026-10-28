import {expect,test} from "bun:test";
import {handleArquivoInstitucional} from "../../supabase/functions/arquivos-institucionais-http";
function setup(state:"active"|"inactive"|"invalid"="active"){
 let signs=0;const deps={authorize:async()=>state,sign:async(path:string)=>{signs++;return "https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/sign/oficios/"+path+"?token=fake"}};
 const req=(path="conteudo/logo.png",token="valid-token")=>new Request("https://x",{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify({path})});
 return{deps,req,get signs(){return signs}};
}
test("imagem institucional exige autenticação",async()=>{const f=setup();const r=await handleArquivoInstitucional(f.req("conteudo/logo.png",""),f.deps);expect(r.status).toBe(401);expect(f.signs).toBe(0);});
test("conta suspensa não recebe URL de imagem",async()=>{const f=setup("inactive");expect((await handleArquivoInstitucional(f.req(),f.deps)).status).toBe(403);expect(f.signs).toBe(0);});
test("token inválido não chega ao Storage",async()=>{const f=setup("invalid");expect((await handleArquivoInstitucional(f.req(),f.deps)).status).toBe(401);expect(f.signs).toBe(0);});
test("conta ativa recebe imagem institucional",async()=>{const f=setup();const r=await handleArquivoInstitucional(f.req(),f.deps);expect(r.status).toBe(200);expect((await r.json()).url).toContain("/conteudo/logo.png?");expect(f.signs).toBe(1);});
test("assinador não expõe PDF nem arquivo de outro usuário",async()=>{const f=setup();for(const path of ["declaracoes/a.pdf","other-user/conteudo/logo.png","conteudo/../private.png","https://example.invalid/logo.png"])expect((await handleArquivoInstitucional(f.req(path),f.deps)).status).toBe(404);expect(f.signs).toBe(0);});
test("erro de serviço não expõe credenciais",async()=>{const f=setup();f.deps.sign=async()=>{throw Error("private-secret")};const r=await handleArquivoInstitucional(f.req(),f.deps);expect(r.status).toBe(503);expect(await r.text()).not.toContain("private-secret");});
