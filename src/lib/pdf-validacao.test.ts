import {expect,test} from "bun:test";
import {PDFDocument} from "pdf-lib";
import {validarPdfA4} from "./pdf-validacao";
test("PDF válido tem exatamente uma página A4",async()=>{const p=await PDFDocument.create();p.addPage([595.28,841.89]);await expect(validarPdfA4(await p.save())).resolves.toBeUndefined();});
test("PDF de duas páginas não é aceito nem recortado",async()=>{const p=await PDFDocument.create();p.addPage([595.28,841.89]);p.addPage([595.28,841.89]);await expect(validarPdfA4(await p.save())).rejects.toMatchObject({codigo:"pdf_layout"});});
test("PDF em papel errado não é marcado pronto",async()=>{const p=await PDFDocument.create();p.addPage([612,792]);await expect(validarPdfA4(await p.save())).rejects.toMatchObject({codigo:"pdf_layout"});});
test("HTML ou bytes falsos não passam como PDF",async()=>{await expect(validarPdfA4(new TextEncoder().encode("%PDF-1.7 isto não é um arquivo PDF"))).rejects.toMatchObject({codigo:"pdf_invalido"});});
