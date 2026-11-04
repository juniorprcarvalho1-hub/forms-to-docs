import {expect,test} from "bun:test";
import {projetarAndamento} from "./automacao-client";
test("arquivo pronto e email pendente são estados separados",()=>{
 const r=projetarAndamento({habilitada:true,pdf:{estado:"concluido"},email:{estado:"bloqueado_configuracao",erro_codigo:"orientador_ausente"}});
 expect(r.pdf).toBe("PDF pronto");expect(r.email).toContain("orientador");expect(r.enviado).toBe(false);
});
test("envio incerto pede confirmação e não oferece reenvio direto",()=>{const r=projetarAndamento({habilitada:true,email:{estado:"envio_a_confirmar"}});expect(r.confirmar).toBe(true);expect(r.retomarEmail).toBe(false);});
test("sem tarefa não afirma que PDF está pronto",()=>{expect(projetarAndamento({habilitada:false}).pdf).toBe("Automação aguardando ativação");});
test("somente conclusão de email afirma envio",()=>{expect(projetarAndamento({habilitada:true,email:{estado:"concluido"}}).enviado).toBe(true);expect(projetarAndamento({habilitada:true,email:{estado:"processando"}}).enviado).toBe(false);});
