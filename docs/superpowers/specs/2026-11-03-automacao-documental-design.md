# Automação dos três fluxos documentais FACESF
Data: 03/11/2026. Estado: proposta para aprovação; não implementada.
Base examinada: fd1eabf5d5cb6e5053cf5188e710936d3a089265.

## Resultado esperado
Cada resposta de um formulário específico deve entrar no destino correspondente, identificar os dados, escolher o modelo original e gerar um PDF A4 privado, mesmo com o site fechado. Somente a avaliação de supervisor deve seguir para envio automático ao orientador do curso. Ofícios e Preceptoria continuam com suas ações manuais de envio, impressão e edição.

Destinos: oficios; declaracoes (Preceptoria); declaracoes-resposta (avaliação).
Preservar os 11 modelos originais, documentos antigos, contas, planos e permissões.
Não introduzir Pacientes.

## Evidências da revisão
- formularios.ts chama handlers de normalização e o RPC registrar_documento_forms; não gera PDF.
- O envio automático de avaliação está em useEffect na página declaracoes-resposta.tsx e depende de abrir essa página.
- pdf.ts usa iframe, document e html2canvas; não pode simplesmente ser executado numa Edge Function.
- Cursos desconhecidos podem cair no modelo padrão/Enfermagem.
- A procura de período pode usar uma resposta numérica sem relação com o período.
- No banco examinado, os quatro orientadores não têm e-mail; cursos, módulos e professores auxiliares estão vazios; o link geral de avaliação não está preenchido.
- A pessoa responsável decidiu cadastrar os e-mails e links posteriormente. Não inventar esses dados e não bloquear a preparação da automação por isso.

## Abordagens
Manter geração no navegador preservaria o código atual, mas falha no requisito de funcionar com o site fechado.
Gerar PDF no Apps Script mudaria o motor de composição e dificultaria manter fielmente os modelos HTML e a recuperação centralizada.
A proposta é persistir a resposta e uma tarefa na mesma transação no Supabase, depois gerar o PDF no servidor por um navegador Chromium. Cloudflare Browser Rendering é o adaptador preferido, alinhado à hospedagem existente. A conexão e os limites da conta devem ser conferidos antes da ativação; não habilitar serviço pago nem mudar de fornecedor sem autorização. Não há ferramenta Cloudflare conectada nesta sessão.

## Recepção e identificação
Manter token em Propriedades do script e os identificadores estáveis de formulário/resposta/destino.
Mapear títulos originais das perguntas por destino, com aliases explícitos e verificáveis. Não confundir nome de supervisor, preceptor, aluno, professor ou destinatário.
Resolver somente cursos conhecidos ou aliases cadastrados sem ambiguidade. Curso ausente, desconhecido ou ambíguo deve produzir uma pendência identificável e nunca selecionar silenciosamente Enfermagem.
Avaliações: Enfermagem 9/10; Fisioterapia 9/10; Nutrição 7/8; Psicologia 9/10. Aceitar período de campo identificado ou configuração específica do formulário; nunca de qualquer resposta numérica.
Respostas existentes e configuração do formulário que se contradizem devem gerar pendência; não escolher uma arbitrariamente.
Enfermagem/Fisioterapia: 420h fixas no Ofício. Nutrição/Psicologia: módulo e carga horária definidos por cadastro ou dado explícito validado, sem usar 420h por falta de cadastro.
Validar nomes necessários, datas reais e ordem início/fim quando aplicável. Os demais campos obrigatórios são os placeholders necessários de cada modelo, sem criar exigências genéricas que os formulários originais não fazem.
Preservar respostas de múltipla seleção e títulos originais. Conflitos de títulos devem ser informados no diagnóstico.
Resposta malformada/autenticação inválida não cria documento. Dados insuficientes ficam preservados no Forms e na sua fila de envio, com erro específico retornado; não fabricar documento incorreto.

## Persistência e fila
Salvar documento, recibo de idempotência e tarefa PDF na mesma transação. A confirmação ao formulário significa recebimento persistido, não PDF ou e-mail já concluídos.
Guardar versão de documento/modelo, HTML composto e entradas normalizadas com acesso privado; HTML editado manualmente prevalece. Alterar modelo posteriormente não altera PDFs já concluídos sem reprocessamento explícito.
Fila privada com unicidade por tipo de documento, ID, versão e etapa; estados pendente, processando, concluido, erro_recuperavel, bloqueado_configuracao e envio_a_confirmar.
Claim atômico com lock/lease e versão de tentativa. Uma tentativa vencida não pode finalizar uma tarefa tomada por outra execução.
Inicializar pelo receptor e recuperar periodicamente pelo agendador Supabase. O agendador e o acesso de serviço devem ser habilitados por migração, sem segredos no repositório. Atualmente pg_net está habilitado e pg_cron ainda precisa ser verificado/habilitado.
Retentar falhas temporárias com atraso progressivo e limite de tentativas; erros de campo ou configuração aguardam correção. Registrar etapa e motivo técnico seguro, sem respostas pessoais nem tokens em logs.
Reenvio idêntico retorna o mesmo documento; conteúdo diferente com o mesmo identificador gera conflito explícito.
Preservar numeração anual atômica dos Ofícios e testar concorrência e virada do ano em America/Fortaleza.

## PDF no servidor
Separar montagem HTML pura do código que depende de DOM. Reutilizar os modelos originais e suas regras, sem reproduzir layout manualmente.
Resolver somente imagens institucionais autorizadas; falhas de imagem obrigatória devem impedir conclusão, em vez de remover a imagem silenciosamente.
Renderizar com Chromium, aguardar fontes e imagens, imprimir exatamente uma página A4 e verificar tamanho, assinatura PDF e número de páginas. Nunca cortar texto, rodapé ou assinatura para caber.
Se conteúdo exceder a área legível de uma página, sinalizar erro de composição para correção; não finalizar PDF truncado.
O serviço de renderização recebe somente o HTML do documento em processamento e as imagens necessárias. Proteger chamada interna por credencial no servidor ou ticket curto e de uso único vinculado ao job; bloquear navegação e requisições arbitrárias (SSRF).
Salvar arquivo em caminho privado por proprietário/documento/versão, conferir upload e só então marcar PDF concluído.
Retentativa de upload ou retomada usa o mesmo caminho/versão e não cria outro documento.
O adaptador de renderização precisa de configuração válida antes de ativar o processamento real. Enquanto indisponível, mostrar pendência de configuração e preservar tarefas.

## E-mail das avaliações
Criar etapa de envio apenas após PDF armazenado e validado.
Resolver destino pelo orientador do curso, no servidor. Sem e-mail válido, manter PDF gerado e bloquear apenas o envio, com motivo visível.
Configurar orientadores posteriormente, conforme solicitado. Após configuração, retomar os pendentes uma vez.
Não reenviar automaticamente os documentos com origem lovable_migracao nem os já enviados.
Usar identificador estável por envio e registrar ID retornado pelo provedor. Se houver timeout após possível aceitação pelo Gmail, marcar envio_a_confirmar e reconciliar antes de tentar novamente. Se a conexão não permitir consultar o envio, exigir confirmação operacional; não fazer reenvio cego.
Remover o envio automático por useEffect quando o processamento no servidor estiver ativo. Clientes antigos não podem competir com a fila: o servidor rejeita o modo automático antigo e direciona envio manual à mesma etapa controlada.
Mudança de versão, exclusão ou bloqueio da conta cancela/impede novas etapas pendentes conforme o estado atual. Conferir autorização imediatamente antes de renderizar e enviar.
Testes não enviam e-mails reais sem pedido explícito.

## Telas e permissões
Nas três abas, mostrar recebido/processando/PDF pronto/erro e ação para consultar o motivo e retomar após correção.
Na avaliação, mostrar também aguardando orientador/enviado/envio a confirmar.
A usuária institucional deve poder consultar os próprios documentos, motivos e andamento; o controle de contas e planos continua exclusivo do dono.
Especificar permissão limitada de configuração documental (modelos, orientadores, links) para a conta institucional aprovada, conforme o pedido, sem conceder controle financeiro ou gestão de usuários. Hoje a página de Configurações é restrita a administradores: separar essa permissão durante a implementação.
Não permitir leitura de documentos de outra conta nem tornar o bucket público.
Manter edição, visualização, impressão, download e exclusão. PDF editado recebe nova versão; não enviar a versão obsoleta.

## Verificação exigida
- Formulário simulado -> validação -> banco -> escolha do modelo -> HTML -> PDF privado, para os três destinos e os oito perfis de avaliação.
- Banco e provedor de renderização de teste/ambiente isolado: não inserir alunos fictícios no banco de produção.
- Testes positivos com títulos reais dos formulários disponíveis e testes de nome/curso/período ambíguos, campos ausentes, datas inválidas, múltipla seleção e módulo sem cadastro.
- Mesmo envio repetido e concorrente produz um único documento/PDF; Ofícios não repetem número.
- Worker interrompido, lease expirado, PDF/imagem indisponível, storage falhando e Gmail indisponível preservam trabalho e exibem pendência.
- E-mail ausente bloqueia só envio; resultado incerto não dispara reenvio cego.
- Histórico migrado permanece sem envio automático.
- Teste visual e de uma página A4 dos 11 modelos, com nomes longos, caracteres acentuados e imagens carregadas.
- Teste com o navegador do usuário fechado; tipos e build; RLS e controles internos.
- Acesso real aos formulários de avaliação e aos e-mails dos orientadores fica para uma etapa posterior, conforme decisão expressa. Não declarar esses casos validados antes disso.

## Ativação e reversão
Primeiro aplicar fila/permissões e publicar consumidor desativado por configuração; validar em ambiente isolado.
Habilitar renderer e e-mail somente com configuração conferida. Migrar execução automática da página para o servidor sem janela de concorrência entre os dois.
Não enfileirar o histórico por padrão. Permitir pausar o consumidor preservando documentos e tarefas.
Atualizar Apps Scripts, guia de instalação e conhecimento Lovable com a versão aprovada.
Critério de entrega: evidências dos testes acima e uma lista explícita de integrações/configurações ainda pendentes; nenhuma promessa de ausência absoluta de falhas.
