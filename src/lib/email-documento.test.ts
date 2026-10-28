import {expect,test} from "bun:test";
import {enviarDocumentoAutorizado} from "./email-documento";
const reference={tipoDocumento:"declaracoes_resposta",registroId:"00000000-0000-4000-8000-000000000001",automatico:true};
function fixture(origem:string|null="google_forms"){let calls=0;const deps={carregar:async()=>origem===null?null:{origem},enviar:async()=>{calls++;return{enviado:true}}};return{deps,get calls(){return calls}};}
test("payload antigo sem referência não chama Gmail",async()=>{const f=fixture();await expect(enviarDocumentoAutorizado({to:"example@example.invalid"},f.deps)).rejects.toThrow();expect(f.calls).toBe(0);});
test("modo automático ausente não vira envio manual",async()=>{const f=fixture();const {automatico,...old}=reference;await expect(enviarDocumentoAutorizado(old,f.deps)).rejects.toThrow();expect(f.calls).toBe(0);});
test("avaliação migrada não envia email automático no servidor",async()=>{const f=fixture("lovable_migracao");await expect(enviarDocumentoAutorizado(reference,f.deps)).rejects.toThrow();expect(f.calls).toBe(0);});
test("registro ausente ou sem permissão não chama Gmail",async()=>{const f=fixture(null);await expect(enviarDocumentoAutorizado(reference,f.deps)).rejects.toThrow();expect(f.calls).toBe(0);});
test("erro na consulta não permite envio",async()=>{const f=fixture();f.deps.carregar=async()=>{throw Error("private-secret")};await expect(enviarDocumentoAutorizado(reference,f.deps)).rejects.toThrow();expect(f.calls).toBe(0);});
test("envio manual explícito do histórico permanece disponível",async()=>{const f=fixture("lovable_migracao");expect(await enviarDocumentoAutorizado({...reference,automatico:false},f.deps)).toEqual({enviado:true});expect(f.calls).toBe(1);});
test("nova resposta continua enviando automaticamente",async()=>{const f=fixture();expect(await enviarDocumentoAutorizado(reference,f.deps)).toEqual({enviado:true});expect(f.calls).toBe(1);});
