-- Corrige o texto institucional dos modelos de Ofício e seus fallbacks.
do $$
declare
  ajuste record;
begin
  for ajuste in select * from (values
    ($texto$semi-árido nordestino, através da formação$texto$, $texto$semiárido nordestino, por meio da formação$texto$),
    ($texto$Prezado (a) Secretário (a),$texto$, $texto$Prezado(a) Secretário(a),$texto$),
    ($texto$ – FACESF, localizada em Belém do São Francisco – PE, apresenta a Vossa Senhoria o aluno (a) {{nome}} CPF {{cpf}} regularmente matriculado (a) no curso de {{curso}} da supracitada IES, matrícula: {{matricula}}, e solicita, para o mesmo, a realização de Estágio Curricular Obrigatório.$texto$, $texto$ (FACESF), localizada em Belém do São Francisco – PE, apresenta a Vossa Senhoria o(a) estudante {{nome}} (CPF nº {{cpf}}), com matrícula nº {{matricula}} no curso de {{curso}}, e solicita autorização para a realização do Estágio Curricular Obrigatório.$texto$),
    ($texto$O estágio transcorrerá na área de {{area_estagio}}, sob a orientação do professor (a) {{professor_orientador}}, {{registro_professor}}, com carga horária de {{carga_horaria}} distribuídas entre os meses de {{periodo}}, ajustando-se ao plano de estágio concebido pelo (a) estagiário (a) sob acordos entre os profissionais responsáveis – professor orientador e supervisor de campo.$texto$, $texto$O estágio será realizado na área de {{area_estagio}}, sob a orientação de {{professor_orientador}} ({{registro_professor}}). A carga horária total será de {{carga_horaria}}, no período de {{periodo}}, conforme o plano de estágio elaborado em conjunto pelo(a) estudante, pela orientação acadêmica e pela supervisão de campo.$texto$),
    ($texto$Informamos que o aluno será encaminhado com o Termo de Compromisso, Seguro Contra Acidentes Pessoais pela Seguradora {{seguradora}}, sob a apólice Nº {{apolice}}.$texto$, $texto$Informamos que o(a) estudante será encaminhado(a) com o Termo de Compromisso de Estágio e estará coberto(a) por seguro contra acidentes pessoais contratado com a seguradora {{seguradora}}, sob a apólice nº {{apolice}}.$texto$),
    ($texto$Na ocasião, manifestamos nossos votos de estima e apreço, agradecemos o esforço em nos atender e nos colocamos à disposição para quaisquer esclarecimentos adicionais que se fizerem necessários.$texto$, $texto$Agradecemos a atenção dispensada e permanecemos à disposição para quaisquer esclarecimentos.$texto$),
    ($texto$ – FACESF, localizada em Belém do São Francisco – PE, apresenta a Vossa Senhoria o aluno (a) <strong>{{nome}}</strong> CPF <strong>{{cpf}}</strong> regularmente matriculado (a) no curso de {{curso}} da supracitada IES, matrícula: {{matricula}}, e solicita, para o mesmo, a realização de Estágio Curricular Obrigatório.$texto$, $texto$ (FACESF), localizada em Belém do São Francisco – PE, apresenta a Vossa Senhoria o(a) estudante <strong>{{nome}}</strong> (CPF nº <strong>{{cpf}}</strong>), com matrícula nº {{matricula}} no curso de {{curso}}, e solicita autorização para a realização do Estágio Curricular Obrigatório.$texto$)
  ) as alteracoes(antes, depois)
  loop
    update public.modelos_oficio
    set modelo_html = replace(modelo_html, ajuste.antes, ajuste.depois)
    where strpos(modelo_html, ajuste.antes) > 0;

    update public.configuracoes
    set modelo_html = replace(modelo_html, ajuste.antes, ajuste.depois),
        modelo = replace(modelo, ajuste.antes, ajuste.depois)
    where strpos(modelo_html, ajuste.antes) > 0 or strpos(modelo, ajuste.antes) > 0;
  end loop;

  update public.configuracoes
  set padrao_destinatario = 'À Secretaria Municipal de Saúde de Belém do São Francisco – PE'
  where padrao_destinatario = 'A Secretaria Municipal de Saúde – Belém do São Francisco – PE';
end $$;
