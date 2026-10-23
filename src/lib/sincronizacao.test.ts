import {expect,test} from "bun:test";
import {signEnvelope,verifyEnvelope,deliverBatch} from "../../supabase/functions/sync-core";
const secret="a".repeat(64),ts=1792790000,nonce="00000000-0000-4000-8000-000000000001";
test("HMAC protege corpo exato, janela de tempo e identificador",async()=>{
 const body='{"action":"pull"}';const signature=await signEnvelope(secret,body,ts,nonce);
 expect(await verifyEnvelope(secret,body,{timestamp:ts,nonce,signature},ts)).toBe(true);
 expect(await verifyEnvelope(secret,body+" ",{timestamp:ts,nonce,signature},ts)).toBe(false);
 expect(await verifyEnvelope(secret,body,{timestamp:ts,nonce,signature},ts+61)).toBe(false);
 expect(await verifyEnvelope(secret,body,{timestamp:ts,nonce:"invalid",signature},ts)).toBe(false);
 expect(await verifyEnvelope("b".repeat(64),body,{timestamp:ts,nonce,signature},ts)).toBe(false);
});
test("falha remota mantém evento pendente e registra somente código",async()=>{
 const nacks:unknown[]=[];let acked=false;
 const stats=await deliverBatch({
 pull:async()=>[{id:nonce,payload:{nome:"private"}}],
 apply:async()=>{throw Error("patient name secret")},
 ack:async()=>{acked=true},nack:async(id,code)=>{nacks.push([id,code])}
 });
 expect(acked).toBe(false);expect(nacks).toEqual([[nonce,"REMOTE_UNAVAILABLE"]]);expect(JSON.stringify(stats)).not.toContain("private");
});
test("ACK perdido repete envio sem perder evento",async()=>{
 let pending=true,insertions=0,attempts=0;const inbox=new Map<string,unknown>();
 const ports={
 pull:async()=>pending?[{id:nonce}]:[],
 apply:async(e:{id:string})=>{if(!inbox.has(e.id)){inbox.set(e.id,{status:"applied"});insertions++}return inbox.get(e.id)},
 ack:async()=>{attempts++;if(attempts===1)throw Error("network");pending=false},
 nack:async()=>{}
 };
 await deliverBatch(ports);expect(pending).toBe(true);await deliverBatch(ports);
 expect(pending).toBe(false);expect(insertions).toBe(1);
});
