import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase-config";
import { probeLegacyStorage } from "@/lib/sync-storage-probe.server";

async function probe(request: Request): Promise<Response> {
  const key=request.headers.get("x-sync-server-key") ?? "";
  const result=await probeLegacyStorage(key,{
    authorize:async (serverKey)=>{
      const db=createClient(SUPABASE_URL,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const {error}=await db.auth.admin.listUsers({page:1,perPage:1});
      return !error;
    },
    inspect:async ()=>{
      const legacyKey=process.env["SUPABASE_SERVICE_ROLE_KEY"];
      if(!legacyKey) throw Error("not configured");
      const db=createClient("https://qwhvceqqubofxpdxnhtz.supabase.co",legacyKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const bucket=db.storage.from("oficios");
      const {data,error}=await bucket.list("",{limit:100});
      if(error) throw error;
      let readable=true;
      for(const file of data ?? []) {
        if(!file.id) continue;
        const result=await bucket.download(file.name);
        if(result.error || !result.data){readable=false;break;}
      }
      if(!readable) throw Error("unreadable");
      return {files:(data??[]).filter(f=>!!f.id).length,readable};
    }
  });
  return new Response(JSON.stringify(result.body),{status:result.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
}
export const Route=createFileRoute("/api/internal/sync-storage")({
  server:{handlers:{POST:({request}:{request:Request})=>probe(request)}}
});
