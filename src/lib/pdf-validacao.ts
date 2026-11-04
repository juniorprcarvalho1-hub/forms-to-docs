import {PDFDocument} from "pdf-lib";
import {ErroAutomacao} from "./automacao-erros.ts";
export async function validarPdfA4(bytes:Uint8Array):Promise<void>{
 if(bytes.byteLength<8||bytes.byteLength>8000000||String.fromCharCode(...bytes.subarray(0,5))!=="%PDF-")throw new ErroAutomacao("pdf_invalido");
 let pdf:PDFDocument;
 try{pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});}catch{throw new ErroAutomacao("pdf_invalido");}
 if(pdf.getPageCount()!==1)throw new ErroAutomacao("pdf_layout");
 const page=pdf.getPage(0),size=page.getSize(),crop=page.getCropBox();
 if(Math.abs(size.width-595.28)>2||Math.abs(size.height-841.89)>2||page.getRotation().angle!==0||
    Math.abs(crop.width-size.width)>1||Math.abs(crop.height-size.height)>1||Math.abs(crop.x)>1||Math.abs(crop.y)>1)throw new ErroAutomacao("pdf_layout");
}
