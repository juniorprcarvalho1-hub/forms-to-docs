import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase-config";
import { inspectLegacyFiles } from "@/lib/sync-storage-files.server";
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
      return inspectLegacyFiles({
        list:async(prefix,offset)=>{
          const {data,error}=await bucket.list(prefix,{limit:100,offset});
          if(error) throw error;
          return data??[];
        },
        download:async(path)=>{
          const {data,error}=await bucket.download(path);
          if(error || !data) throw Error("Unreadable");
        }
      });
    }
  });
  return new Response(JSON.stringify(result.body),{status:result.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
}
export const Route=createFileRoute("/api/internal/sync-storage")({
  server:{handlers:{POST:({request}:{request:Request})=>probe(request)}}
});
