export type LegacyEntry={name:string;id:string|null};
export async function inspectLegacyFiles(deps:{
 list:(prefix:string,offset:number)=>Promise<LegacyEntry[]>;
 download:(path:string)=>Promise<void>;
}):Promise<{files:number;readable:boolean}> {
 const folders=[{path:"",depth:0}];let files=0,entries=0;
 while(folders.length){
  const folder=folders.shift()!;
  if(folder.depth>8) throw Error("Limite de profundidade");
  for(let offset=0;;offset+=100){
   const page=await deps.list(folder.path,offset);
   entries+=page.length;if(entries>2000)throw Error("Limite de inventário");
   for(const entry of page){
    if(!entry.name || entry.name.includes("/") || entry.name==="." || entry.name==="..")throw Error("Caminho inválido");
    const path=folder.path?folder.path+"/"+entry.name:entry.name;
    if(entry.id){await deps.download(path);files++;}
    else folders.push({path,depth:folder.depth+1});
   }
   if(page.length<100)break;
  }
 }
 return {files,readable:files>0};
}
