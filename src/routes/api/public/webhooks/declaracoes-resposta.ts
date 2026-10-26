import {createFileRoute} from "@tanstack/react-router";
export const Route=createFileRoute("/api/public/webhooks/declaracoes-resposta")({
 server:{handlers:{POST:async({request})=>{
  const {encaminharFormulario}=await import("@/lib/forms-proxy.server");
  return encaminharFormulario(request,"declaracoes-resposta");
 }}}
});
