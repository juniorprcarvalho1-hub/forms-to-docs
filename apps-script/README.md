# Apps Scripts FACESF — Google Forms → Supabase
Atualização: 26/10/2026. Um código completo por tipo de formulário. O aplicativo publicado na Lovable lê o mesmo Supabase externo.

| Tipo do formulário | Arquivo |
| --- | --- |
| Ofício de estágio | [oficios.gs](./oficios.gs) |
| Declaração de preceptoria | [declaracoes.gs](./declaracoes.gs) |
| Declaração de resposta / avaliação | [declaracoes-resposta.gs](./declaracoes-resposta.gs) |
| Cadastro administrativo de pacientes | [pacientes.gs](./pacientes.gs) |

Use uma cópia do arquivo correspondente em cada formulário. O mesmo tipo atende Enfermagem, Fisioterapia, Nutrição e Psicologia, conforme o campo Curso. Os campos de estágio, professores e nomes oficiais continuam vindo dos cadastros do sistema.

## Instalação em cada Google Formulário
1. Abra o formulário em modo de edição e seu **Editor de script / Apps Script**.
2. Guarde uma cópia do código antigo. Substitua o conteúdo de Code.gs pelo arquivo do tipo correto. Estes códigos usam o gatilho do próprio formulário, com e.response.
3. Em **Configurações do projeto → Propriedades do script**, cadastre **FACESF_TOKEN**.
   - Ofícios e as duas declarações: token de documentos gerado em **Configurações → Acessos e integrações → Trocar token**. Os três tipos compartilham esse token. Trocar invalida o anterior.
   - Pacientes: token próprio de **Pacientes → Google Forms**. Use **Criar conexão** e copie o valor exibido uma única vez. O token de pacientes é diferente do token de documentos.
4. Opcional: adicione **FACESF_CURSO**, por exemplo Enfermagem, Fisioterapia, Nutrição ou Psicologia, se esse formulário não pergunta o curso.
5. Salve e execute **instalarIntegracao()**. Entre com a conta que administra o formulário e conclua a autorização solicitada pelo Google.
6. Execute **testarConfiguracao()** para conferir a disponibilidade do serviço; a confirmação do token é feita no passo seguinte.
7. Envie uma resposta fictícia pelo formulário e confira o novo registro no aplicativo. O envio do formulário dispara enviarFACESF automaticamente; evite executar esse manipulador pelo botão Executar.

O instalador cria um gatilho de envio e um de reenvio a cada cinco minutos. Reexecutá-lo substitui os gatilhos conhecidos deste código. Gatilhos criados por outras contas só podem ser removidos pela conta que os criou: confira **Acionadores** para evitar um script antigo adicional. A conta instaladora deve manter acesso ao formulário.

## Perguntas esperadas
Use títulos distintos para pessoas diferentes; por exemplo Nome do supervisor e Nome do estagiário. Perguntas com títulos iguais após remover acentos/pontuação precisam ser renomeadas para evitar perda de respostas.

- **Ofícios:** Aluno(a), Curso, CPF, Matrícula, Data, Instituição, Cargo, Módulo, Professor / Professor orientador, Período e campos opcionais já aceitos no sistema. Aluno(a) é obrigatório. Data pode ser ISO (2026-10-26) ou brasileira (26/10/2026); se omitida, usa a data de recebimento.
- **Declarações:** Nome do preceptor, Curso, Registro profissional / COREN / CREFITO / CRN / CRP, Campo de estágio / Hospital, Data de início, Data de fim, Alunos e E-mail do preceptor. Nome do preceptor é obrigatório.
- **Respostas:** Nome do supervisor, Nome do estagiário, Curso, Período, Tipo de avaliação (Parcial/Final) e E-mail do supervisor. Supervisor e estagiário são obrigatórios.
- **Pacientes:** Nome completo, CPF, WhatsApp / telefone, E-mail, Data de nascimento, Responsável, Endereço e Curso / especialidade. É necessário nome e ao menos um identificador/contato válido. CPF informado é validado.

O receptor também aceita os aliases usados pelos webhooks anteriores. Dados de múltipla escolha são preservados. PDFs e envio de e-mail continuam disponíveis nas funções existentes do aplicativo; o script cadastra as respostas.

## Conta responsável e permissões
No painel do proprietário juniorprcarvalho1@gmail.com, use o e-mail da conta já cadastrada e **Definir responsável pelos formulários** em Configurações para escolher quem recebe os documentos. A instalação inicial associa os documentos à conta institucional clinicasaudeintegrada.facesf@gmail.com, se confirmada e ativa. A responsabilidade é verificada no servidor; suspensão ou vencimento dessa conta impede novos documentos por esses scripts.

Os pacientes seguem a conta da conexão criada na aba Pacientes e as permissões administrativas já existentes. Nenhuma conta, senha ou permissão é criada pelos scripts.

## Pendências e reenvio
- Falhas de rede, HTTP 429 e falhas temporárias ficam pendentes e são tentadas novamente com espera progressiva, pelo gatilho de cinco minutos.
- **verPendenciasFACESF()** mostra apenas quantidades, sem dados pessoais.
- Depois de corrigir token, conta suspensa ou campos inválidos, execute **reenviarPendentesFACESF()**.
- **reenviarUltimasRespostasFACESF()** coloca as últimas 20 respostas do Google Forms na fila. Use para recuperar envios antigos deste formulário. A mesma resposta recebe a mesma chave; documentos já recebidos não são duplicados.
- Se uma resposta já salva tiver sido alterada depois, o receptor retorna 409 e preserva o registro existente para conferência. O script não sobrescreve documentos.
- A fila guarda até 200 referências de respostas nas Propriedades do script, sem copiar nomes, CPF ou respostas. Se ficar cheia, o gatilho informa o erro; as respostas originais continuam no Google Forms. Resolva as pendências antes de reenviar mais respostas.
- Registros já salvos no antigo banco da Lovable não são transferidos por esses scripts. Essa migração é separada.

Guarde apenas o token de integração nas Propriedades do script. A chave sb_publishable presente no código é pública; nenhuma service_role ou senha é necessária. Os scripts não registram respostas ou tokens em logs.

## Referências
- [Gatilhos de envio do Google Forms](https://developers.google.com/apps-script/guides/triggers/events#google_forms_events).
- [Autorização e execução dos gatilhos instaláveis](https://developers.google.com/apps-script/guides/triggers/installable).
