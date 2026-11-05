import {expect,test} from "bun:test";
import {projetarAndamento} from "./automacao-client";
test("arquivo pronto e email pendente são estados separados",()=>{
 const r=projetarAndamento({habilitada:true,pdf:{estado:"concluido"},email:{estado:"bloqueado_configuracao",erro_codigo:"orientador_ausente"}});
 expect(r.pdf).toBe("PDF pronto");expect(r.email).toContain("orientador");expect(r.enviado).toBe(false);
});
test("envio incerto pede confirmação e não oferece reenvio direto",()=>{const r=projetarAndamento({habilitada:true,email:{estado:"envio_a_confirmar"}});expect(r.confirmar).toBe(true);expect(r.retomarEmail).toBe(false);});
test("sem tarefa não afirma que PDF está pronto",()=>{expect(projetarAndamento({habilitada:false}).pdf).toBe("Automação aguardando ativação");});
test("somente conclusão de email afirma envio",()=>{expect(projetarAndamento({habilitada:true,email:{estado:"concluido"}}).enviado).toBe(true);expect(projetarAndamento({habilitada:true,email:{estado:"processando"}}).enviado).toBe(false);});

import {selecionarPdfArquivado} from "./automacao-client";
test("somente PDF concluído da versão atual fornece arquivo para baixar",()=>{
 const path="00000000-0000-4000-8000-000000000001/automacao/00000000-0000-4000-8000-000000000002/v2.pdf";
 expect(selecionarPdfArquivado({habilitada:true,versao:2,pdf:{estado:"concluido",path}})).toBe(path);
 expect(selecionarPdfArquivado({habilitada:true,versao:3,pdf:{estado:"concluido",path}})).toBeNull();
 expect(selecionarPdfArquivado({habilitada:true,versao:2,pdf:{estado:"pendente",path}})).toBeNull();
});
