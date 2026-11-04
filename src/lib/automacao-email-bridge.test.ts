import {expect,test} from "bun:test";
import {PDFDocument} from "pdf-lib";
import {handleEmailBridge, type EnvelopeEmail} from "./automacao-email-bridge.server";
import {createHash} from "node:crypto";
async function fixture(){
 const pdf=await PDFDocument.create();pdf.addPage([595.28,841.89]);const bytes=await pdf.save();
 const calls:string[]=[];let mime="";
 const envelope:EnvelopeEmail={job_id:"00000000-0000-4000-8000-000000000001",to:"orientador@example.com",message_id:"<facesf.00000000-0000-4000-8000-000000000001@sintegradocursosfacesf.com.br>",assunto:"Declaração de avaliação – José",corpo:"Documento de avaliação.",pdf_url:"https://auxsyadqijcjngmujagx.supabase.co/storage/v1/object/sign/oficios/owner/automacao/id/v1.pdf?token=signed",pdf_sha256:createHash("sha256").update(bytes).digest("hex")};
 const ports:any={configurado:true,consumir:async()=>{calls.push("envelope");return envelope;},lerPdf:async()=>{calls.push("pdf");return bytes;},autorizar:async()=>{calls.push("autorizar");return true;},enviarMime:async(raw:string)=>{calls.push("gmail");mime=Buffer.from(raw,"base64url").toString("utf8");return {id:"provider123"};}};
 const request=(body:any={ticket:"a".repeat(64)})=>new Request("https://site/api/internal/documentos-email",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 return {envelope,ports,calls,request,get mime(){return mime;}};
}
test("bridge usa envelope canônico e autoriza imediatamente antes do Gmail",async()=>{const f=await fixture();const r=await handleEmailBridge(f.request(),f.ports);expect(r.status).toBe(200);expect(await r.json()).toEqual({id:"provider123"});expect(f.calls).toEqual(["envelope","pdf","autorizar","gmail"]);expect(f.mime).toContain("To: orientador@example.com");expect(f.mime).toContain("Message-ID: <facesf.");expect(f.mime).toContain("Content-Type: application/pdf");expect(f.mime).not.toContain("signed");});
test("chamador não escolhe destinatário ou anexo pelo body",async()=>{const f=await fixture();const r=await handleEmailBridge(f.request({ticket:"a".repeat(64),to:"attacker@example.com",pdfBase64:"bad"}),f.ports);expect(r.status).toBe(400);expect(f.calls).toEqual([]);});
test("ticket inválido ou reutilizado não chega ao Gmail",async()=>{const f=await fixture();f.ports.consumir=async()=>null;const r=await handleEmailBridge(f.request(),f.ports);expect(r.status).toBe(401);expect(f.calls).not.toContain("gmail");});
test("PDF alterado após geração não é enviado",async()=>{const f=await fixture();f.envelope.pdf_sha256="0".repeat(64);const r=await handleEmailBridge(f.request(),f.ports);expect(r.status).toBe(422);expect(f.calls).not.toContain("gmail");});
test("permissão revogada durante download impede envio",async()=>{const f=await fixture();f.ports.autorizar=async()=>false;const r=await handleEmailBridge(f.request(),f.ports);expect(r.status).toBe(401);expect(f.calls).not.toContain("gmail");});
test("conta Gmail desconectada não consome ticket",async()=>{const f=await fixture();f.ports.configurado=false;const r=await handleEmailBridge(f.request(),f.ports);expect(r.status).toBe(503);expect(await r.json()).toMatchObject({codigo:"gmail_ausente",incerto:false});expect(f.calls).toEqual([]);});
test("timeout depois de autorização retorna envio incerto sem repetir",async()=>{const f=await fixture();let attempts=0;f.ports.enviarMime=async()=>{attempts++;throw Error("timeout");};const r=await handleEmailBridge(f.request(),f.ports);expect(r.status).toBe(503);expect(await r.json()).toMatchObject({incerto:true});expect(attempts).toBe(1);});
test("injeção de cabeçalho no envelope é recusada",async()=>{const f=await fixture();f.envelope.to="valid@example.com\r\nBcc: attacker@example.com";const r=await handleEmailBridge(f.request(),f.ports);expect(r.status).toBe(401);expect(f.calls).not.toContain("gmail");});
