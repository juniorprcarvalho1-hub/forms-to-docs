import {expect,test} from "bun:test";
import {processarDocumento} from "./automacao-processador";
import {ErroAutomacao} from "./automacao-erros";
function fixture(etapa:"pdf"|"email"="pdf"){
 const events:string[]=[];
 const job:any={id:"job",tipo:"declaracoes_resposta",documento_id:"documento",usuario_id:"conta",versao:2,etapa,lease_token:"lease",pdf_path:"conta/automacao/documento/v2.pdf",snapshot:{documento:{supervisor:"Supervisor",estagiario:"Aluno",curso:"Enfermagem",modelo_chave:"enfermagem",periodo:"9",data_emissao:"2026-01-02"},config:{},modelos:[{chave:"enfermagem",modelo_html:"<p>{{supervisor}} {{periodo}}</p>"}]}};
 let ativo=true,sendError:Error|null=null,renderError:Error|null=null,storageError:Error|null=null;
 const failures:any[]=[];
 const ports:any={
  rendererConfigurado:true,gmailConfigurado:true,
  autorizar:async()=>{events.push("autorizar");return ativo;},
  incorporar:async(html:string)=>{events.push("imagens");return html;},
  renderizar:async(html:string)=>{events.push("render");if(renderError)throw renderError;return new Uint8Array([1,2,3]);},
  validarPdf:async()=>{events.push("validar");},
  salvar:async(path:string)=>{events.push("storage:"+path);if(storageError)throw storageError;},
  concluirPdf:async(_:any,path:string,html:string)=>{events.push("pdf-concluido");expect(path).toBe("conta/automacao/documento/v2.pdf");expect(html).toBe("<p>Supervisor 9</p>");return true;},
  lerPdf:async()=>{events.push("ler-pdf");return new Uint8Array([1,2,3]);},
  iniciarEnvio:async()=>{events.push("iniciar-envio");return {to:"orientador@example.com",message_id:"<stable@example.com>"};},
  enviar:async()=>{events.push("gmail");if(sendError)throw sendError;return {id:"provider123"};},
  concluirEnvio:async(_:any,id:string)=>{events.push("email-concluido");expect(id).toBe("provider123");return true;},
  falhar:async(_:any,codigo:string,incerto:boolean)=>{failures.push({codigo,incerto});events.push("falha");},
 };
 return{job,ports,events,failures,setAtivo:(v:boolean)=>ativo=v,setSendError:(e:Error)=>sendError=e,setRenderError:(e:Error)=>renderError=e,setStorageError:(e:Error)=>storageError=e};
}
test("processamento PDF valida e armazena antes de concluir",async()=>{const f=fixture();expect(await processarDocumento(f.job,f.ports)).toBe("concluido");expect(f.events.indexOf("validar")).toBeLessThan(f.events.indexOf("storage:conta/automacao/documento/v2.pdf"));expect(f.events.indexOf("pdf-concluido")).toBeGreaterThan(f.events.indexOf("storage:conta/automacao/documento/v2.pdf"));expect(f.events).not.toContain("gmail");});
test("renderer desconfigurado preserva tarefa sem renderizar",async()=>{const f=fixture();f.ports.rendererConfigurado=false;expect(await processarDocumento(f.job,f.ports)).toBe("pendente");expect(f.failures).toEqual([{codigo:"renderizador_ausente",incerto:false}]);expect(f.events).not.toContain("render");});
test("documento obsoleto não transmite conteúdo ao renderer",async()=>{const f=fixture();f.setAtivo(false);expect(await processarDocumento(f.job,f.ports)).toBe("obsoleto");expect(f.events).toEqual(["autorizar"]);});
test("PDF inválido não é enviado ao storage",async()=>{const f=fixture();f.ports.validarPdf=async()=>{throw new ErroAutomacao("pdf_layout");};await processarDocumento(f.job,f.ports);expect(f.failures).toEqual([{codigo:"pdf_layout",incerto:false}]);expect(f.events.some(e=>e.startsWith("storage:"))).toBe(false);});
test("falha no storage não marca PDF concluído",async()=>{const f=fixture();f.setStorageError(Error("offline"));await processarDocumento(f.job,f.ports);expect(f.events).not.toContain("pdf-concluido");expect(f.failures).toEqual([{codigo:"storage_indisponivel",incerto:false}]);});
test("mudança após renderização impede arquivar versão antiga",async()=>{const f=fixture();f.ports.renderizar=async()=>{f.setAtivo(false);return new Uint8Array([1,2,3]);};expect(await processarDocumento(f.job,f.ports)).toBe("obsoleto");expect(f.events.some(e=>e.startsWith("storage:"))).toBe(false);});
test("destinatário ausente não tenta Gmail",async()=>{const f=fixture("email");f.ports.iniciarEnvio=async()=>null;expect(await processarDocumento(f.job,f.ports)).toBe("pendente");expect(f.events).not.toContain("gmail");});
test("PDF arquivado é validado antes de iniciar envio",async()=>{const f=fixture("email");await processarDocumento(f.job,f.ports);expect(f.events.indexOf("validar")).toBeLessThan(f.events.indexOf("iniciar-envio"));expect(f.events.indexOf("email-concluido")).toBeGreaterThan(f.events.indexOf("gmail"));});
test("erro indeterminado após iniciar Gmail não gera retry cego",async()=>{const f=fixture("email");f.setSendError(Error("network timeout"));await processarDocumento(f.job,f.ports);expect(f.failures).toEqual([{codigo:"gmail_indisponivel",incerto:true}]);expect(f.events).not.toContain("email-concluido");});
test("recusa explícita do Gmail não é tratada como entrega incerta",async()=>{const f=fixture("email");f.setSendError(new ErroAutomacao("gmail_recusado",false));await processarDocumento(f.job,f.ports);expect(f.failures).toEqual([{codigo:"gmail_recusado",incerto:false}]);});
test("Gmail ausente bloqueia etapa sem começar envio",async()=>{const f=fixture("email");f.ports.gmailConfigurado=false;await processarDocumento(f.job,f.ports);expect(f.failures).toEqual([{codigo:"gmail_ausente",incerto:false}]);expect(f.events).not.toContain("iniciar-envio");});
