# Integrações documentais FACESF

O sistema tem três fluxos. Os modelos e campos seguem o projeto original da Lovable.

| Fluxo | Arquivo |
| --- | --- |
| Ofícios de estágio | [oficios.gs](./oficios.gs) |
| Declaração de Preceptoria | [declaracoes.gs](./declaracoes.gs) |
| Declaração de preenchimento da Avaliação de Supervisor de Campo | [declaracoes-resposta.gs](./declaracoes-resposta.gs) |

São três modelos de Ofícios (Enfermagem/Fisioterapia, Nutrição e Psicologia), quatro modelos de Preceptoria e quatro de Avaliação, um por curso. O período da Avaliação é preenchido com a resposta original.

## Avaliação: arquivos já configurados por curso e período

| Curso | Período | Script |
| --- | --- | --- |
| Enfermagem | 9º | [enfermagem-9.gs](./avaliacao/enfermagem-9.gs) |
| Enfermagem | 10º | [enfermagem-10.gs](./avaliacao/enfermagem-10.gs) |
| Fisioterapia | 9º | [fisioterapia-9.gs](./avaliacao/fisioterapia-9.gs) |
| Fisioterapia | 10º | [fisioterapia-10.gs](./avaliacao/fisioterapia-10.gs) |
| Nutrição | 7º | [nutricao-7.gs](./avaliacao/nutricao-7.gs) |
| Nutrição | 8º | [nutricao-8.gs](./avaliacao/nutricao-8.gs) |
| Psicologia | 9º | [psicologia-9.gs](./avaliacao/psicologia-9.gs) |
| Psicologia | 10º | [psicologia-10.gs](./avaliacao/psicologia-10.gs) |

Os arquivos da pasta avaliacao são alternativas ao script genérico de Avaliação. Use apenas um script em cada formulário. Eles enviam curso/período como padrão quando o formulário não contém essas perguntas. Uma resposta existente tem prioridade: não renomeie nem exclua as perguntas originais.

## Instalação em cada Google Formulário

1. Abra o Apps Script vinculado ao próprio formulário, não à planilha.
2. Substitua Code.gs pelo conteúdo do arquivo correspondente.
3. Em Configurações do projeto → Propriedades do script, cadastre FACESF_TOKEN.
4. Use o token de documentos de Configurações → Acessos e integrações. Os três fluxos usam o mesmo token. Se já tem um token válido, reutilize-o; Trocar token invalida o anterior.
5. No script genérico de Avaliação, configure FACESF_CURSO e FACESF_PERIODO quando o formulário não pergunta esses dados. Nos oito arquivos específicos, esses padrões já estão preenchidos.
6. Execute instalarIntegracao() e conclua a autorização do Google com a conta administradora do formulário.
7. Envie uma resposta fictícia e confira o registro no fluxo correto do sistema.

O acesso de servidor aos documentos deve estar vinculado à conta institucional ativa pelo dono do sistema. Os scripts nunca contêm senha nem chave administrativa do Supabase.

## Envio e recuperação

O envio vai diretamente para o Supabase forms-to-docs, função formularios. O servidor identifica o modelo pela resposta do curso, preserva os campos originais e registra o documento no destino correto. O PDF é gerado no sistema com o modelo original; o e-mail de Preceptoria é destinado ao preceptor, e o de Avaliação ao orientador do curso.

O identificador combina formulário, resposta e destino, mantendo o mesmo valor no reenvio. Respostas com múltipla seleção são preservadas. A fila guarda somente referências às respostas, sem copiar nomes ou respostas completas nas propriedades do script.

- instalarIntegracao(): cria um gatilho do formulário e um de recuperação a cada cinco minutos, substituindo os gatilhos conhecidos antigos.
- processarPendentesFACESF(): tenta novamente falhas temporárias.
- reenviarPendentesFACESF(): libera pendências após corrigir token ou configuração.
- reenviarUltimasRespostasFACESF(): enfileira as vinte respostas mais recentes; a chave estável evita duplicação das já registradas.
- verPendenciasFACESF(): informa contagens, sem registrar respostas.
- testarConfiguracao(): verifica disponibilidade da função; a validação do token ocorre no envio fictício.

A fila tem limite de duzentas referências. Falhas de rede,429 e5xx são recuperadas automaticamente. Erros de campos, autenticação ou conflito ficam bloqueados até correção manual. Confira as pendências após a primeira resposta.

## Histórico e dados originais

A migração preserva os modelos, configurações, orientadores e documentos históricos do projeto original. Referências antigas de imagens são atualizadas para os recursos do projeto atual, com acesso autenticado às imagens privadas. Registros históricos são identificados como migrados e não disparam reenvio automático de e-mails. Novas avaliações mantêm o envio automático ao orientador quando o fluxo correspondente está aberto, como no projeto original.

Não existe integração de Pacientes neste pacote.
