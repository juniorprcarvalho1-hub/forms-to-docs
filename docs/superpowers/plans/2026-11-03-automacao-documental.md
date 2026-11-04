# Automação documental Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receber os três formulários e produzir documentos corretos em servidor, sem depender de página aberta.
**Architecture:** RPC transacional registra documento, recibo e fila privada. Consumidor Supabase usa os montadores HTML existentes, imagens incorporadas e Cloudflare Browser Run PDF; verifica o PDF antes de salvar e só depois processa o envio de avaliações.
**Tech Stack:** TypeScript, React/TanStack, Postgres/Supabase Edge Functions/Cron, Cloudflare Browser Run, Bun/PGlite, Deno.
**Spec:** docs/superpowers/specs/2026-11-03-automacao-documental-design.md (aprovada em 03/11/2026).

## Global Constraints
- Preservar 11 modelos e histórico; não enviar e-mails reais como teste.
- Somente três destinos; avaliação nos oito perfis de curso/período aprovados.
- E-mails e links adiados pelo usuário. Configuração ausente vira pendência visível.
- PDF A4 de uma página sem recorte; erro explícito para conteúdo maior.
- Bucket privado, tarefas privadas, conta ativa e proprietário conferidos a cada etapa.
- Nunca contratar serviço pago automaticamente; renderer só ativo com configuração conferida.
- Execução remota em branch/CI: escrita local permaneceu EPERM apesar da concessão. Preservar checkout anterior.
- Não reescrever histórico Git publicado.

## Review Focus
- Dado numérico de uma avaliação não pode virar período.
- Dois consumidores ou um cliente antigo não podem duplicar envio.
- Timeout depois de possível aceitação no Gmail precisa de confirmação, não reenvio.
- Edição/exclusão/suspensão durante processamento invalida resultado antigo.
- Uma imagem ausente ou duas páginas não podem virar PDF pronto.

### Task 1: Validação e perfis
**Files:** supabase/functions/forms-handlers.ts; src/lib/forms-identificacao.ts; src/lib/forms-identificacao.test.ts; src/lib/forms-handlers.test.ts; apps-script/*.gs e avaliacao/*.gs; src/lib/apps-script.test.ts.
**Interfaces:** resolverCurso(texto): chave; resolverPeriodo(payload,curso): string; ValidacaoFormularioError; handlers retornam422 e não gravam quando ambíguos.
- [ ] Testar curso desconhecido/ambíguo, período ausente/nota numérica, perfis inválidos, campos conflitantes e carga420/módulo.
- [ ] Executar CI e registrar RED.
- [ ] Implementar aliases explícitos, datas ordenadas e configuração de formulário sem contradição.
- [ ] Executar bun test; bunx tsc --noEmit; bun run build. Expected: todos verdes.
- [ ] Commit e registrar resultado no ledger.

### Task 2: Fila transacional e RLS
**Files:** migração gerada pela CLI Supabase para automacao_documental; src/lib/automacao.db.test.ts.
**Interfaces:** public.automacao_status(tipo,id); public.automacao_retomar(tipo,id); RPCs de serviço automacao_claim/automacao_finish/automacao_fail. Jobs internos têm lease_token, versão e etapa.
- [ ] Testes PGlite reais: registro cria tarefa na mesma transação; recibo repetido não duplica; claims concorrentes/expirados; auth e RLS; histórico excluído; edição/exclusão; conclusão antiga negada; envio incerto sem retry automático.
- [ ] Observar RED antes da migração.
- [ ] Implementar trigger de enqueue, snapshot por versão e funções com search_path fixo e privilégios mínimos.
- [ ] Agendador chama consumidor com ticket curto/uso único; adicionar extensão/cron em migração operacional separada quando disponível.
- [ ] Rodar testes de banco completos, commit e ledger.

### Task 3: Composição e processamento PDF
**Files:** src/lib/automacao-html.ts; src/lib/automacao-processador.ts; respectivos *.test.ts; supabase/functions/documentos-worker.ts e módulos HTTP/adapter/validação; testes Deno PDF.
**Interfaces:** montarHtmlAutomacao(tipo,documento,config,modelos); processarDocumento(job,ports); renderizador(html): PDF verificado; incorporarImagens(html,loader).
- [ ] Testar três destinos/oito perfis, versões, imagem obrigatória falhando, validação PDF/tamanho/A4/página, render desconfigurado, storage falhando e retomada.
- [ ] Observar RED; reutilizar montadores originais, sem reimplementar layout.
- [ ] Incorporar imagens permitidas, bloquear rede/JS do renderer, validar saída com biblioteca PDF fixa e armazenar caminho por conta/id/versão.
- [ ] Rodar Bun e Deno, commit e ledger.

### Task 4: E-mail controlado e abandono de useEffect
**Files:** src/lib/email-documento.ts e testes; src/lib/email.functions.ts; src/routes/_authenticated/declaracoes-resposta.tsx; módulos worker de e-mail.
**Interfaces:** fila é autoridade de envio; destino/assunto/anexo são derivados no servidor; automatico antigo negado; envio manual entra na mesma fila.
- [ ] Testar histórico sem auto, cliente antigo negado, destinatário ausente bloqueia só envio, timeout envia_a_confirmar, persistência ID provedor e nenhuma repetição após confirmação.
- [ ] Observar RED e implementar adaptador Gmail apenas com segredos server-side.
- [ ] Desligar gatilho React e integrar botões à fila; validar suite, commit e ledger.

### Task 5: Andamento, correção e configuração documental
**Files:** src/components/AndamentoDocumento.tsx; src/lib/automacao-client.ts e testes; três listas documentais; configuracoes.tsx e RLS de configuração.
**Interfaces:** status RPC retorna só metadados da própria conta; reprocessamento autorizado por RPC; permissão documental separada de admin.
- [ ] Testar projeção de estados e autorização no banco; retomada não pode liberar envio incerto ou histórico automaticamente.
- [ ] Observar RED; exibir estado/motivo/retomar e permitir configuração institucional limitada.
- [ ] Validar UI, tipos e build; commit e ledger.

### Task 6: Integração, revisão e ativação controlada
**Files:** workflow CI; docs/AUTOMACAO_DOCUMENTAL.md; apps-script/README.md; ledger.
- [ ] Testes integrados isolados desde recibo até PDF, concorrência/virada do ano e falhas; testes visuais dos modelos com fixtures sem dados pessoais.
- [ ] Revisão independente da branch; corrigir bloqueios com RED→GREEN.
- [ ] Aplicar migrações e publicar endpoints com automação configurável, sem reprocessar histórico.
- [ ] Confirmar acessos reais, tarefas sem navegador e privacidade. Não declarar renderer/e-mail real validados sem a conexão.
- [ ] Atualizar Lovable, documentação e scripts; entregar evidências e pendências exatas.
