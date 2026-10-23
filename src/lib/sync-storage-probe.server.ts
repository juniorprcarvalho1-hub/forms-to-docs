type Inspection = { files: number; readable: boolean };
type Dependencies = { authorize: (key: string) => Promise<boolean>; inspect: () => Promise<Inspection> };
export async function probeLegacyStorage(key: string, deps: Dependencies): Promise<{status:number;body:Record<string, unknown>}> {
  if (!key || key.length > 8192) return {status:401,body:{error:"Credencial de servidor necessária."}};
  try { if (!(await deps.authorize(key))) return {status:403,body:{error:"Acesso restrito ao sincronizador."}}; }
  catch { return {status:403,body:{error:"Acesso restrito ao sincronizador."}}; }
  try { const result=await deps.inspect(); return {status:200,body:{ok:true,files:result.files,readable:result.readable}}; }
  catch { return {status:503,body:{error:"Storage legado indisponível. Sincronização permanece pausada."}}; }
}
