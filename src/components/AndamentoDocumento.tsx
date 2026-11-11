import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "@/integrations/supabase/client";
import {projetarAndamento,type Andamento} from "@/lib/automacao-client";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from "@/components/ui/alert-dialog";
const db=supabase as unknown as SupabaseClient<any>;
export function AndamentoDocumento({tipo,id}:{tipo:"oficios"|"declaracoes"|"declaracoes_resposta";id:string}){
 const cache=useQueryClient();const[busy,setBusy]=useState(false);const[confirmacao,setConfirmacao]=useState<"enviado"|"nao_enviado"|null>(null);
 const query=useQuery({queryKey:["automacao",tipo,id],queryFn:async()=>{const{data,error}=await db.rpc("automacao_status",{p_tipo:tipo,p_documento:id});if(error)throw new Error("Andamento indisponível");return data as Andamento|null;},refetchInterval:15000});
 async function acao(etapa?:"pdf"|"email",enviado?:boolean){
  setBusy(true);
  try{
   const{error}=etapa?await db.rpc("automacao_retomar",{p_tipo:tipo,p_documento:id,p_etapa:etapa}):await db.rpc("automacao_confirmar_envio",{p_tipo:tipo,p_documento:id,p_enviado:enviado});
   if(error)throw new Error("A ação não foi concluída. Atualize o andamento e tente novamente.");
   setConfirmacao(null);await cache.invalidateQueries({queryKey:["automacao"]});await cache.invalidateQueries({queryKey:[tipo]});toast.success(etapa?"Nova tentativa solicitada.":"Confirmação registrada.");
  }catch(error){toast.error(error instanceof Error?error.message:"Falha ao atualizar.");}finally{setBusy(false);}
 }
 if(query.isPending)return <p className="text-xs text-muted-foreground" role="status">Consultando andamento…</p>;
 if(query.isError)return <button type="button" onClick={()=>void query.refetch()} className="text-xs underline">Andamento indisponível. Tentar novamente</button>;
 if(!query.data)return null;
 const a=projetarAndamento(query.data);
 return <div className="mt-1 space-y-1 whitespace-normal text-xs text-muted-foreground" aria-label="Andamento do documento">
  <p>{a.pdf}</p>{a.email&&<p>{a.email}</p>}
  {a.retomarPdf&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void acao("pdf")}>Retomar PDF</Button>}
  {a.retomarEmail&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void acao("email")}>Retomar e-mail</Button>}
  {a.confirmar&&<div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={()=>setConfirmacao("enviado")}>Confirmar recebimento</Button><Button size="sm" variant="outline" onClick={()=>setConfirmacao("nao_enviado")}>Não foi recebido</Button></div>}
  <AlertDialog open={confirmacao!==null} onOpenChange={open=>{if(!open)setConfirmacao(null);}}>
   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmacao==="enviado"?"Confirmar recebimento":"Autorizar nova tentativa"}</AlertDialogTitle><AlertDialogDescription>{confirmacao==="enviado"?"Use esta opção após conferir que o destinatário recebeu a mensagem. O sistema não enviará outra cópia.":"Confira a caixa de entrada e o spam do destinatário. Se a mensagem já foi recebida, uma nova tentativa poderá duplicá-la."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void acao(undefined,confirmacao==="enviado");}}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
 </div>;
}
