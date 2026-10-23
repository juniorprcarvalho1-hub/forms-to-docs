export type EnvelopeAuth={timestamp:number;nonce:string;signature:string};
const encoder=new TextEncoder();
function bytesToHex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")}
function message(body:string,timestamp:number,nonce:string){return encoder.encode(timestamp+"\n"+nonce+"\n"+body)}
async function hmacKey(secret:string){return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
export async function signEnvelope(secret:string,body:string,timestamp:number,nonce:string):Promise<string>{
 return bytesToHex(await crypto.subtle.sign("HMAC",await hmacKey(secret),message(body,timestamp,nonce)));
}
export async function verifyEnvelope(secret:string,body:string,auth:EnvelopeAuth,now=Math.floor(Date.now()/1000)):Promise<boolean>{
 if(!Number.isSafeInteger(auth.timestamp)||Math.abs(now-auth.timestamp)>60||! /^[a-f0-9-]{36}$/i.test(auth.nonce)||! /^[a-f0-9]{64}$/.test(auth.signature)||encoder.encode(body).length>1048576)return false;
 try{
 const signature=new Uint8Array(auth.signature.match(/../g)!.map(h=>parseInt(h,16)));
 return await crypto.subtle.verify("HMAC",await hmacKey(secret),signature,message(body,auth.timestamp,auth.nonce));
 }catch{return false}
}
export async function deliverBatch<E extends {id:string},R>(ports:{
 pull:()=>Promise<E[]>;apply:(event:E)=>Promise<R>;ack:(id:string,result:R)=>Promise<void>;nack:(id:string,code:string)=>Promise<void>
}):Promise<{applied:number;failed:number}>{
 const stats={applied:0,failed:0};
 for(const event of await ports.pull()){
  try{const result=await ports.apply(event);await ports.ack(event.id,result);stats.applied++}
  catch{stats.failed++;await ports.nack(event.id,"REMOTE_UNAVAILABLE")}
 }
 return stats;
}
