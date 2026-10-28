import {expect,test} from "bun:test";
import {respostasParaEnvioAutomatico} from "./declaracoes-resposta";
test("histórico migrado não dispara novos emails",()=>{const old={id:"old",origem:"lovable_migracao",email_enviado_em:null};expect(respostasParaEnvioAutomatico([old],new Set())).toEqual([]);});
test("nova resposta continua disponível para envio automático",()=>{const fresh={id:"new",origem:"google_forms",email_enviado_em:null};expect(respostasParaEnvioAutomatico([fresh],new Set())).toEqual([fresh]);});
test("envio concluído ou já processado não se repete",()=>{expect(respostasParaEnvioAutomatico([{id:"sent",origem:"google_forms",email_enviado_em:"2026-01-01"},{id:"processing",origem:"google_forms",email_enviado_em:null}],new Set(["processing"]))).toEqual([]);});
