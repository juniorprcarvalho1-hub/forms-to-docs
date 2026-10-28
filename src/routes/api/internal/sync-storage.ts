import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase-config";
import { inspectLegacyFiles } from "@/lib/sync-storage-files.server";
import { probeLegacyStorage } from "@/lib/sync-storage-probe.server";
import { decodeLegacyStoragePath } from "@/lib/legacy-storage-path";

async function probe(request: Request): Promise<Response> {
  const key=request.headers.get("x-sync-server-key") ?? "";
  const encoded=request.headers.get("x-legacy-file");
  const path=encoded===null?null:decodeLegacyStoragePath(encoded);
  if(encoded!==null&&!path)return Response.json({error:"Caminho inválido."},{status:400});
  let content:Blob|null=null;
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
      if(path){const {data,error}=await bucket.download(path);if(error||!data||data.size>8000000)throw Error("Unreadable");content=data;return{files:1,readable:true};}
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
  const downloaded=content as Blob|null;
  if(result.status===200&&downloaded)return new Response(await downloaded.arrayBuffer(),{status:200,headers:{"content-type":downloaded.type||"application/octet-stream","cache-control":"no-store","x-content-type-options":"nosniff"}});
  return new Response(JSON.stringify(result.body),{status:result.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
}
export const Route=createFileRoute("/api/internal/sync-storage")({
  server:{handlers:{POST:({request}:{request:Request})=>probe(request)}}
});
