import {expect,test} from "bun:test";
import {referenciaEstudantes,montarDeclaracaoHtml,type Declaracao,type ConfiguracoesDeclaracao} from "./declaracoes";
for(const [lista,referencia] of [
 ["Pessoa Um","a estudante"],
 ["Pessoa Um; Pessoa Dois; Pessoa Três","a estudantes"],
 ["Pessoa Um\nPessoa Dois","a estudantes"],
 ["Pessoa Um, Pessoa Dois","a estudantes"],
 ["Pessoa Um; ","a estudante"],
] as const)test("concordância de "+JSON.stringify(lista),()=>expect(referenciaEstudantes(lista)).toBe(referencia));
test("declaração usa o período e o plural no modelo existente",()=>{
 const d={nome:"Preceptor Teste",curso:"Fisioterapia",modelo_chave:"fisioterapia",data_inicio:"2026-11-12",data_fim:"2026-11-30",data_emissao:"2026-11-26",alunos:"Pessoa Um; Pessoa Dois",coren:"123",conteudo_html:null} as Declaracao;
 const modelo='<div class="preceptoria-a4">no período de {{data_inicio}} a {{data_fim}}, junto a <strong>{{alunos}}</strong>.</div>';
 const html=montarDeclaracaoHtml(d,{cidade:"Cidade"} as ConfiguracoesDeclaracao,[{chave:"fisioterapia",modelo_html:modelo} as any]);
 expect(html).toContain("12/11/2026 a 30/11/2026");
 expect(html).toContain("junto a estudantes <strong>Pessoa Um; Pessoa Dois</strong>");
});
test("edição manual continua sendo preservada",()=>{
 const d={conteudo_html:"<p>Texto editado</p>"} as Declaracao;
 expect(montarDeclaracaoHtml(d,{} as ConfiguracoesDeclaracao)).toBe("<p>Texto editado</p>");
});
test("tag de referência não aceita HTML dos nomes",()=>{
 const d={nome:"Teste",curso:"Fisioterapia",modelo_chave:"fisioterapia",data_emissao:"2026-11-26",alunos:"<script>x</script>; Pessoa",coren:"123"} as Declaracao;
 const html=montarDeclaracaoHtml(d,{} as ConfiguracoesDeclaracao,[{chave:"fisioterapia",modelo_html:"junto {{referencia_alunos}} {{alunos}}"} as any]);
 expect(html).toContain("junto a estudantes");expect(html).not.toContain("<script>");
});
