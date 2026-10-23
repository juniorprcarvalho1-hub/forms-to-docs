import {expect,test} from "bun:test";
import { inspectLegacyFiles } from "./sync-storage-files.server";
test("percorre subpastas e lê bytes dos arquivos privados",async()=>{
 const downloaded:string[]=[];
 const result=await inspectLegacyFiles({
 list:async(prefix)=>prefix===""?[{name:"declaracoes",id:null}]:[{name:"a.pdf",id:"file"}],
 download:async path=>{downloaded.push(path)}
 });
 expect(result).toEqual({files:1,readable:true});expect(downloaded).toEqual(["declaracoes/a.pdf"]);
});
test("paginação não perde arquivos após primeira página",async()=>{
 let reads=0;
 const result=await inspectLegacyFiles({
 list:async(_prefix,offset)=>offset===0?Array.from({length:100},(_,i)=>({name:i+".pdf",id:String(i)})):[{name:"ultimo.pdf",id:"last"}],
 download:async()=>{reads++}
 });
 expect(result.files).toBe(101);expect(reads).toBe(101);
});
test("falha de download e excesso de profundidade não passam como prova",async()=>{
 await expect(inspectLegacyFiles({list:async()=>[{name:"a.pdf",id:"x"}],download:async()=>{throw Error("private")}})).rejects.toThrow();
 await expect(inspectLegacyFiles({list:async()=>[{name:"folder",id:null}],download:async()=>{}})).rejects.toThrow();
});
