import {expect,test} from "bun:test";
import {referenciaEstudantes,formatarNomesEstudantes,montarDeclaracaoHtml,type Declaracao,type ConfiguracoesDeclaracao} from "./declaracoes";
for(const [lista,referencia] of [
 ["Pessoa Um","ao(à) aluno(a)"],
 ["Pessoa Um; Pessoa Dois; Pessoa Três","aos(às) alunos(as)"],
 ["Pessoa Um\nPessoa Dois","aos(às) alunos(as)"],
 ["Pessoa Um, Pessoa Dois","aos(às) alunos(as)"],
 ["Pessoa Um; ","ao(à) aluno(a)"],
] as const)test("concordância de "+JSON.stringify(lista),()=>expect(referenciaEstudantes(lista)).toBe(referencia));
test("declaração usa o período e o plural no modelo existente",()=>{
 const d={nome:"Preceptor Teste",curso:"Fisioterapia",modelo_chave:"fisioterapia",data_inicio:"2026-11-12",data_fim:"2026-11-30",data_emissao:"2026-11-26",alunos:"Pessoa Um; Pessoa Dois",coren:"123",conteudo_html:null} as Declaracao;
 const modelo='<div class="preceptoria-a4">no período de {{data_inicio}} a {{data_fim}}, junto a <strong>{{alunos}}</strong>.</div>';
 const html=montarDeclaracaoHtml(d,{cidade:"Cidade"} as ConfiguracoesDeclaracao,[{chave:"fisioterapia",modelo_html:modelo} as any]);
 expect(html).toContain("12/11/2026 a 30/11/2026");
 expect(html).toContain("junto aos(às) alunos(as) <strong>Pessoa Um e Pessoa Dois</strong>");
});
test("edição manual continua sendo preservada",()=>{
 const d={conteudo_html:"<p>Texto editado</p>"} as Declaracao;
 expect(montarDeclaracaoHtml(d,{} as ConfiguracoesDeclaracao)).toBe("<p>Texto editado</p>");
});
test("tag de referência não aceita HTML dos nomes",()=>{
 const d={nome:"Teste",curso:"Fisioterapia",modelo_chave:"fisioterapia",data_emissao:"2026-11-26",alunos:"<script>x</script>; Pessoa",coren:"123"} as Declaracao;
 const html=montarDeclaracaoHtml(d,{} as ConfiguracoesDeclaracao,[{chave:"fisioterapia",modelo_html:"junto {{referencia_alunos}} {{alunos}}"} as any]);
 expect(html).toContain("junto aos(às) alunos(as)");expect(html).not.toContain("<script>");
});

for(const [nomes,esperado] of [
 ["Pessoa Um","Pessoa Um"],
 ["Pessoa Um; Pessoa Dois","Pessoa Um e Pessoa Dois"],
 ["Pessoa Um; Pessoa Dois; Pessoa Três","Pessoa Um, Pessoa Dois e Pessoa Três"],
 [" Pessoa Um;\n Pessoa Dois; ","Pessoa Um e Pessoa Dois"],
] as const)test("lista de nomes em texto corrido: "+JSON.stringify(nomes),()=>expect(formatarNomesEstudantes(nomes)).toBe(esperado));

for(const [curso,chave,conselho] of [
 ["Enfermagem","enfermagem","COREN"],["Fisioterapia","fisioterapia","CREFITO"],
 ["Nutrição","nutricao","CRN"],["Psicologia","psicologia","CRP"],
] as const)test("texto de referência da preceptoria: "+curso,()=>{
 const d={nome:"Preceptora Exemplo",curso,modelo_chave:chave,data_inicio:"2026-03-02",data_fim:"2026-06-11",data_emissao:"2026-11-26",alunos:"Pessoa Um; Pessoa Dois",coren:"12345",carga_horaria:"356h",conteudo_html:null} as Declaracao;
 const modelo='<div class="preceptoria-a4">Declaramos que <strong>{{nome}} – {{conselho}} {{coren}}</strong> desenvolveu, no período de {{data_inicio}} a {{data_fim}}, atividades de Supervisão no campo do estágio obrigatório em {{curso}}, perfazendo {{carga_horaria}} horas de preceptoria junto a <strong>{{alunos}}</strong>.</div>';
 const html=montarDeclaracaoHtml(d,{} as ConfiguracoesDeclaracao,[{chave,modelo_html:modelo} as any]);
 expect(html).toBe('<div class="preceptoria-a4">Declaramos que <strong>Preceptora Exemplo – '+conselho+' 12345</strong> desenvolveu, no período de 02/03/2026 a 11/06/2026, atividades de Supervisão no campo do estágio obrigatório em '+curso+', perfazendo 356 horas de preceptoria junto aos(às) alunos(as) <strong>Pessoa Um e Pessoa Dois</strong>.</div>');
});
