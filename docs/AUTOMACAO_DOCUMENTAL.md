# Automação documental FACESF

## Fluxo e limites
Google Formulário → Apps Script do próprio formulário → função Supabase `formularios` → registro e recibo idempotente na mesma transação da tarefa → consumidor de servidor → PDF privado validado → envio da avaliação ao orientador.

Três destinos: Ofícios, Declarações de Preceptoria e Declarações de Resposta da Avaliação de Supervisor de Campo. Não existe fluxo de pacientes nesta automação. São preservados os onze modelos originais. A avaliação aceita Enfermagem/Fisioterapia/Psicologia 9º ou10º e Nutrição7º ou8º.

A aplicação pode estar fechada. O Apps Script faz novas tentativas de entrega; o cron chama o consumidor a cada minuto. Cada chamada recebe uma capacidade curta e de uso único; no máximo duas tarefas ficam ativas. Uma versão editada invalida a anterior.

## Configuração operacional
1. Os Apps Scripts estão em [apps-script](../apps-script/README.md). Use somente um por formulário e mantenha FACESF_TOKEN nas Propriedades do script. Não coloque senha ou service_role no script.
2. O dono vincula o recebimento à conta institucional ativa, em Acessos e integrações.
3. Em Configurações, confira campos padrão, módulos/cargas, modelos e imagens. Curso desconhecido, período contraditório e módulo sem carga não recebem valores inventados.
4. Os quatro e-mails de orientadores e os links de avaliação continuam pendentes de cadastro, conforme adiamento solicitado. Um e-mail ausente bloqueia somente o envio; o PDF pode ficar pronto.
5. O consumidor inicia desabilitado. Não ligar antes de verificar o renderizador e a hospedagem do bridge.

### Cloudflare Browser Run
Na conta Cloudflare correta, copie o Account ID. Em My Profile → API Tokens, crie um token personalizado restrito à conta, com Browser Run – Edit.
No [Supabase forms-to-docs](https://supabase.com/dashboard/project/auxsyadqijcjngmujagx/functions), abra Edge Functions → Secrets e adicione:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_BROWSER_TOKEN

Os valores são secretos e permanecem no ambiente Supabase. Não enviar no chat, repositório ou Apps Script. Não contratar plano adicional automaticamente. Se a conta exigir contratação, a ativação permanece pendente.

O diagnóstico de serviço usa uma capacidade `verificar` emitida por RPC de service_role, gera somente um PDF técnico em memória e não cria documento público nem envia mensagem. A resposta informa apenas configuração presente e validação A4. Após diagnóstico e conferência dos modelos, o operador pode habilitar `private.automacao_config`; essa tabela não é acessível ao navegador.

### Gmail e hospedagem
O Gmail conectado continua na hospedagem Lovable. As variáveis LOVABLE_API_KEY e GOOGLE_MAIL_API_KEY não são copiadas para o Supabase.
O endpoint `/api/internal/documentos-email` aceita somente uma capacidade de uso único, lê o envelope canônico do servidor, verifica PDF/hash e confirma novamente conta, versão e destinatário antes de chamar o Gmail.

## Andamento e retomada
As três listas exibem andamento. PDF concluído e e-mail concluído são estados separados. Downloads e impressão usam o PDF arquivado da versão atual; o modo de geração local serve como alternativa sem sobrescrever o arquivo da automação.

Falhas transitórias têm até sete tentativas. Configuração ausente aparece com motivo e pode ser retomada. Uma falha que pode ter ocorrido depois de o Gmail aceitar a mensagem gera **Envio a confirmar**. Confira entrada/spam do destinatário antes de confirmar recebimento ou autorizar nova tentativa; a aplicação não reenvia esse caso sozinha.

O histórico `lovable_migracao` nunca é enviado automaticamente. Um envio manual explícito de avaliação entra na mesma fila. Uma página antiga é instruída a recarregar, evitando confirmação antecipada.

A instituição pode editar a configuração documental. Cadastro de usuários, planos e suspensão permanecem exclusivos do dono verificado juniorprcarvalho1@gmail.com.

## Verificação e evidência
O CI executa testes Bun/PGlite, build, TypeScript, impressão real em Chromium e verificação Deno do consumidor.
Os testes de impressão cobrem A4, imagem ausente/incompleta e recorte em CSS, além dos onze modelos originais nos dezesseis perfis de curso/período. Os fixtures contêm apenas nomes técnicos fictícios; o layout usa o logo público institucional. Essa verificação não substitui o teste do Storage e Cloudflare reais.
Nenhum e-mail real é enviado pelos testes. A confirmação de publicação, migração e diagnóstico de produção deve ser registrada no ledger do plano; uma compilação verde não comprova credenciais externas.

### Envio de Preceptoria

Novas declarações do Google Forms são enviadas após a geração do PDF. O e-mail usa o remetente clinicasaudeintegrada.facesf@gmail.com e o endereço informado no campo de e-mail do preceptor. O semestre é calculado pela data de início do estágio ou pela data de emissão quando o início está ausente. O Gmail institucional precisa estar conectado na Lovable. Registros anteriores à ativação seguem disponíveis para o envio manual.
