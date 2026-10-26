// Cole este código no Apps Script vinculado ao próprio GOOGLE FORMULÁRIO.
// Propriedade obrigatória: FACESF_TOKEN. Opcional: FACESF_CURSO.
// Execute instalarIntegracao() uma vez na conta que administra o formulário.
const FACESF_DESTINO = "declaracoes";
const FACESF_BASE = "https://auxsyadqijcjngmujagx.supabase.co/functions/v1/formularios";
const FACESF_PUBLIC_KEY = "sb_publishable_JdbnI0QtC05QkWrgt1eqlQ_3k8VEaIu";
const FACESF_PREFIXO = "FACESF_P_";

function instalarIntegracao() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error("Abra o Apps Script a partir do formulário.");
  const props = PropertiesService.getScriptProperties();
  if (!(props.getProperty("FACESF_TOKEN") || "").trim()) throw new Error("Cadastre FACESF_TOKEN nas Propriedades do script.");
  props.setProperty("FACESF_FORM_ID", form.getId());
  const managed = ["enviarFACESF", "processarPendentesFACESF", "enviarCadastroFACESF", "onFormSubmit", "aoEnviarFormulario"];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (managed.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("enviarFACESF").forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger("processarPendentesFACESF").timeBased().everyMinutes(5).create();
  Logger.log("Integração instalada. Envie uma resposta fictícia e confira no sistema.");
}

function enviarFACESF(e) {
  if (!e || !e.response || !e.source) throw new Error("Esta função é executada pelo envio do formulário.");
  const key = enfileirarFACESF_(e.source.getId(), e.response.getId());
  if (!processarItemFACESF_(key)) throw new Error("Envio pendente. Confira token e campos; use reenviarPendentesFACESF após corrigir.");
}

function processarPendentesFACESF() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const deadline = Date.now() + 220000;
  const keys = Object.keys(props).filter(function(k) { return k.indexOf(FACESF_PREFIXO) === 0; }).sort(function(a,b) {
    return JSON.parse(props[a]).createdAt - JSON.parse(props[b]).createdAt;
  });
  for (let i=0; i<Math.min(keys.length,10) && Date.now()<deadline; i++) processarItemFACESF_(keys[i]);
}

function reenviarPendentesFACESF() {
  comLockFACESF_(function() {
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    Object.keys(all).forEach(function(k) {
      if (k.indexOf(FACESF_PREFIXO) !== 0) return;
      const item = JSON.parse(all[k]);
      if (item.leaseUntil > Date.now()) return;
      item.blocked = false; item.nextAt = 0;
      props.setProperty(k, JSON.stringify(item));
    });
  });
  processarPendentesFACESF();
}

function reenviarUltimasRespostasFACESF() {
  const props = PropertiesService.getScriptProperties();
  const form = FormApp.openById(props.getProperty("FACESF_FORM_ID"));
  const respostas = form.getResponses().slice(-20);
  respostas.forEach(function(r) { enfileirarFACESF_(form.getId(), r.getId()); });
  processarPendentesFACESF();
}

function verPendenciasFACESF() {
  const all = PropertiesService.getScriptProperties().getProperties();
  let total=0, bloqueadas=0;
  Object.keys(all).forEach(function(k) {
    if(k.indexOf(FACESF_PREFIXO)!==0)return;
    total++; if(JSON.parse(all[k]).blocked)bloqueadas++;
  });
  Logger.log("Pendências: "+total+". Aguardando correção: "+bloqueadas+".");
  return {total:total,bloqueadas:bloqueadas};
}

function testarConfiguracao() {
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty("FACESF_FORM_ID") || !props.getProperty("FACESF_TOKEN"))throw new Error("Execute instalarIntegracao após configurar o token.");
  const r=UrlFetchApp.fetch(FACESF_BASE+"/health",{headers:{apikey:FACESF_PUBLIC_KEY},muteHttpExceptions:true});
  if(r.getResponseCode()!==200)throw new Error("Serviço indisponível. HTTP "+r.getResponseCode());
  Logger.log("Serviço acessível. Confirme o token enviando uma resposta fictícia.");
}

function comLockFACESF_(fn) {
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{return fn();}finally{lock.releaseLock();}
}
function hashFACESF_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(function(b){return ("0"+((b+256)%256).toString(16)).slice(-2);}).join("");
}
function enfileirarFACESF_(formId,responseId) {
  if(!responseId)throw new Error("Resposta sem identificador.");
  const key=FACESF_PREFIXO+hashFACESF_("v1|"+FACESF_DESTINO+"|"+formId+"|"+responseId);
  return comLockFACESF_(function(){
    const props=PropertiesService.getScriptProperties();
    const configured=props.getProperty("FACESF_FORM_ID");
    if(configured!==formId)throw new Error("Execute instalarIntegracao neste formulário.");
    if(!props.getProperty(key)){
      const n=Object.keys(props.getProperties()).filter(function(k){return k.indexOf(FACESF_PREFIXO)===0;}).length;
      if(n>=200)throw new Error("Fila cheia. As respostas continuam no Google Forms; resolva as pendências e reenvie as respostas.");
      props.setProperty(key,JSON.stringify({formId:formId,responseId:responseId,createdAt:Date.now(),attempts:0,nextAt:0,leaseUntil:0,blocked:false}));
    }
    return key;
  });
}
function payloadFACESF_(response,props) {
  const payload=Object.create(null),seen=Object.create(null);
  response.getItemResponses().forEach(function(r){
    const title=r.getItem().getTitle().trim();
    const normalized=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
    if(!normalized || seen[normalized]){const e=new Error("Use títulos distintos nas perguntas.");e.facesfStatus=422;throw e;}
    seen[normalized]=true;payload[title]=r.getResponse();
  });
  const email=response.getRespondentEmail();
  if(email && !seen.email && !seen.enderecodeemail)payload["Endereço de e-mail"]=email;
  const curso=props.getProperty("FACESF_CURSO");
  const hasCourse=Object.keys(payload).some(function(k){return /curso|especialidade/i.test(k) && String(payload[k]).trim();});
  if(curso && !hasCourse)payload.Curso=curso;
  return payload;
}
function processarItemFACESF_(key) {
  const item=comLockFACESF_(function(){
    const props=PropertiesService.getScriptProperties(),raw=props.getProperty(key);
    if(!raw)return null;
    const value=JSON.parse(raw);
    if(value.blocked || value.nextAt>Date.now() || value.leaseUntil>Date.now())return null;
    value.leaseUntil=Date.now()+420000;value.attempts++;
    props.setProperty(key,JSON.stringify(value));return value;
  });
  if(!item)return true;
  let status=0,ok=false;
  try{
    const props=PropertiesService.getScriptProperties(),token=(props.getProperty("FACESF_TOKEN")||"").trim();
    if(!token){const missing=new Error("Configure o token.");missing.facesfStatus=401;throw missing;}
    const response=FormApp.openById(item.formId).getResponse(item.responseId);
    const body=JSON.stringify(payloadFACESF_(response,props));
    const r=UrlFetchApp.fetch(FACESF_BASE+"/"+FACESF_DESTINO,{method:"post",contentType:"application/json",headers:{apikey:FACESF_PUBLIC_KEY,"x-webhook-token":token,"x-facesf-id":key.slice(FACESF_PREFIXO.length)},payload:body,muteHttpExceptions:true,followRedirects:false});
    status=r.getResponseCode();
    if(status>=200 && status<300){
      try{ok=JSON.parse(r.getContentText()).ok===true;}catch(ignore){}
    }
  }catch(error){status=Number(error.facesfStatus)||0;}
  comLockFACESF_(function(){
    const props=PropertiesService.getScriptProperties();
    if(ok){props.deleteProperty(key);return;}
    item.leaseUntil=0;item.lastHttp=status;
    item.blocked=[400,401,403,409,413,415,422].indexOf(status)>=0;
    item.nextAt=Date.now()+Math.min(60,Math.pow(2,Math.min(item.attempts,6)))*60000;
    props.setProperty(key,JSON.stringify(item));
  });
  return ok;
}
