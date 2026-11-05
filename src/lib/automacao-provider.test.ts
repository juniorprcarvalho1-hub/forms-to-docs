import {expect,test} from "bun:test";
import {parseHTML} from "linkedom";
import {renderizarCloudflare,enviarPeloBridge} from "../../supabase/functions/automacao-providers";
test("Cloudflare recebe somente HTML isolado, papel A4 e credencial no cabeçalho",async()=>{
 let calls=0;
 const r=await renderizarCloudflare("<p>Documento</p>",{accountId:"a".repeat(32),token:"segredo-servidor"},async(url:any,init:any)=>{
  calls++;expect(String(url)).toBe("https://api.cloudflare.com/client/v4/accounts/"+ "a".repeat(32)+"/browser-run/pdf");
  expect(init.headers.Authorization).toBe("Bearer segredo-servidor");expect(init.redirect).toBe("error");
  const p=JSON.parse(init.body);expect(init.body).not.toContain("segredo-servidor");expect(p.pdfOptions).toMatchObject({format:"a4",printBackground:true,preferCSSPageSize:true});
  expect(p.pdfOptions.pageRanges).toBeUndefined();expect(p.rejectRequestPattern).toContain("^(?:https?|file|ftp|wss?):");
  const {document}=parseHTML(p.html);expect(document.querySelectorAll("script")).toHaveLength(1);
  const nonce=document.querySelector("script")!.getAttribute("nonce")!;expect(nonce).toMatch(/^[a-f0-9]{32}$/);
  expect(document.querySelector("meta[http-equiv]")!.getAttribute("content")).toContain("'nonce-"+nonce+"'");
  expect(p.waitForSelector.selector).toBe("#facesf-ready-"+nonce);
  return new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"application/pdf"}});
 });
 expect([...r]).toEqual([1,2,3]);expect(calls).toBe(1);
});
test("sem configuração Cloudflare não transmite o documento",async()=>{let calls=0;await expect(renderizarCloudflare("<p>Documento</p>",{accountId:undefined,token:undefined},async()=>{calls++;throw Error();})).rejects.toMatchObject({codigo:"renderizador_ausente"});expect(calls).toBe(0);});
test("HTML ativo é recusado antes de chegar ao navegador remoto",async()=>{let calls=0;await expect(renderizarCloudflare('<img src="data:image/png;base64,AA==" onerror="fetch(1)">',{accountId:"a".repeat(32),token:"token"},async()=>{calls++;throw Error();})).rejects.toMatchObject({codigo:"imagem_invalida"});expect(calls).toBe(0);});
test("bridge recebe ticket sem PDF ou credenciais do Gmail",async()=>{let body:any;const r=await enviarPeloBridge("a".repeat(64),async(url:any,init:any)=>{expect(String(url)).toBe("https://forms-to-docs.lovable.app/api/internal/documentos-email");body=JSON.parse(init.body);return Response.json({id:"provider123"});});expect(body).toEqual({ticket:"a".repeat(64)});expect(r.id).toBe("provider123");});
test("timeout do bridge é entrega incerta e não é repetido",async()=>{let calls=0;await expect(enviarPeloBridge("a".repeat(64),async()=>{calls++;throw Error("timeout");})).rejects.toMatchObject({codigo:"gmail_indisponivel",incerto:true});expect(calls).toBe(1);});
test("Gmail sem conexão é bloqueio de configuração e não entrega incerta",async()=>{await expect(enviarPeloBridge("a".repeat(64),async()=>Response.json({codigo:"gmail_ausente",incerto:false},{status:503}))).rejects.toMatchObject({codigo:"gmail_ausente",incerto:false});});
test("sucesso sem recibo de provedor não é considerado envio concluído",async()=>{await expect(enviarPeloBridge("a".repeat(64),async()=>Response.json({ok:true}))).rejects.toMatchObject({incerto:true});});
