import {expect,test} from "bun:test";
import {decodeLegacyStoragePath} from "./legacy-storage-path";
test("leitura temporária preserva caminhos dos arquivos originais",()=>{expect(decodeLegacyStoragePath(encodeURIComponent("documentos/2026/exemplo.pdf"))).toBe("documentos/2026/exemplo.pdf");expect(decodeLegacyStoragePath("conteudo%2Flogo.png")).toBe("conteudo/logo.png");});
test("leitura temporária recusa travessia, outros buckets e URL externa",()=>{for(const path of ["../private.pdf","conteudo/../private.png","https://example.invalid/a.pdf","other/a.pdf","declaracoes/a.exe","/documentos/a.pdf","documentos//a.pdf","documentos/%2e%2e/a.pdf"])expect(decodeLegacyStoragePath(encodeURIComponent(path))).toBeNull();});
