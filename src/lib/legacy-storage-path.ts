export function decodeLegacyStoragePath(encoded:string):string|null{
 if(!encoded||encoded.length>2048)return null;
 try{
  const path=decodeURIComponent(encoded);
  if(path.length>512||path.split("/").some(p=>!p||p==="."||p===".."))return null;
  if(!/^(conteudo|documentos|declaracoes|declaracoes-resposta)\/[a-z0-9_./-]+\.(pdf|png)$/i.test(path))return null;
  return path;
 }catch{return null;}
}
