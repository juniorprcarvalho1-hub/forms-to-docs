import {expect,test} from "bun:test";
import {caminhoImagemInstitucionalPermitido,identificarImagemInstitucional,normalizarReferenciasLegadas,resolverFontesImagens} from "./imagens-institucionais";
const origin="https://auxsyadqijcjngmujagx.supabase.co";
const legacy="https://qwhvceqqubofxpdxnhtz.supabase.co/storage/v1/object/sign/oficios/conteudo/logo.png?token=expired";
test("identifica imagem institucional antiga sem reutilizar token vencido",()=>{expect(identificarImagemInstitucional(legacy,origin)).toEqual({kind:"storage",path:"conteudo/logo.png"});});
test("não interpreta imagens externas nem documentos privados como logos",()=>{
 for(const src of ["https://example.invalid/conteudo/logo.png",origin+"/storage/v1/object/sign/oficios/declaracoes/a.pdf",origin+"/storage/v1/object/sign/oficios/conteudo/%2e%2e%2fprivate.png"])expect(identificarImagemInstitucional(src,origin)).toBeNull();
 expect(caminhoImagemInstitucionalPermitido("conteudo/logo.png")).toBe(true);
 expect(caminhoImagemInstitucionalPermitido("conteudo/../private.png")).toBe(false);
});
test("substitui somente referências de imagem preservando texto, tags e estilo",()=>{
 const html='<p style="font-family:Georgia">{{nome}}<img style="width:200px" src="'+legacy+'"></p>';
 expect(normalizarReferenciasLegadas(html,origin)).toBe('<p style="font-family:Georgia">{{nome}}<img style="width:200px" src="'+origin+'/storage/v1/object/public/oficios/conteudo/logo.png"></p>');
});
test("usa a marca original já versionada para o endereço interno da Lovable",()=>{
 expect(normalizarReferenciasLegadas('<img src="/__l5e/assets-v1/16f1a583-6782-48a0-947f-09226a225692/facesf.png">',origin)).toBe('<img src="/brand/facesf.png">');
});
test("revalida imagem privada para o PDF e compartilha assinatura dentro do documento",async()=>{
 let calls=0;const signed=origin+"/storage/v1/object/sign/oficios/conteudo/logo.png?token=fresh";
 const actual=await resolverFontesImagens([legacy,legacy,"https://example.invalid/other.png"],origin,async()=>{calls++;return signed});
 expect(actual).toEqual([signed,signed,"https://example.invalid/other.png"]);expect(calls).toBe(1);
});
test("não envia o navegador para URL de assinatura de outro projeto",async()=>{
 await expect(resolverFontesImagens([legacy],origin,async()=>"https://example.invalid/logo.png")).rejects.toThrow();
});
