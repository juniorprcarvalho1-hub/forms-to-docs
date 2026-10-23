# Sincronização Lovable–Supabase Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Sincronizar dados operacionais e arquivos nos dois sentidos, com conflitos e falhas controlados.
**Architecture:** Outbox transacional e relógios vetoriais por registro em ambos os bancos; coordenador Edge externo agendado a cada minuto; transporte HMAC e painel exclusivo do dono.
**Tech Stack:** PostgreSQL17, pgcrypto, Vault, pg_cron/pg_net, Deno, Supabase-js2.112.3, React19, Bun/PGlite.
**Spec:** docs/superpowers/specs/2026-10-23-sincronizacao-bancos-design.md

## Global Constraints
- Pausado até conferir dados/arquivos e testes reais nos dois sentidos.
- Preservar IDs, duas versões de conflitos, tombstones recuperáveis por30dias, RLS e bucket privado.
- Não replicar contas/senhas/permissões/planos ou segredos; dono verificado obrigatório no painel.
- Nenhum segredo em Git/log/cliente; evitar SQL arbitrária e ciclos.
- Fonte atual GitHub main; preservar branch local antiga.

## Review Focus
- Relógios concorrentes e eventos antigos jamais sobrescrevem edição nova (Task2).
- Eventos confirmados remotamente mas com ACK perdido são repetíveis (Task2/3).
- Upload parcial não publica referência a arquivo ausente (Task4).
- Referências sem usuário confirmado correspondente não atribuem permissões (Task1/3).
- Assinatura inválida, replay e limites de lote falham fechados (Task3).

### Task1: Inventário e pré-requisitos
**Files:** docs/superpowers/plans/2026-10-23-sincronizacao-bancos.md; docs/SINCRONIZACAO.md.
**Interfaces:** inventário de colunas/chaves/referências; lista explícita de tabelas/colunas; prova de Storage e agendamento.
- [ ] Inventariar ambos esquemas e Storage sem expor dados clínicos.
- [ ] Provar acesso privado a bytes e provisionamento de segredo dedicado sem usar senhas pessoais.
- [ ] Gerar migrações com CLI; se ferramenta indisponível registrar alternativa antes de escrever.
Expected: duas origens identificadas, limitações registradas e nenhum acesso público novo.

### Task2: Motor transacional e testes PostgreSQL
**Files:** supabase/sync/engine.sql; src/lib/sincronizacao.db.test.ts.
**Interfaces:** sync_private.capture trigger; sync_private.apply_event(jsonb)->jsonb; outbox, records e conflicts; relógio {cloud,external}.
- [ ] Escrever testes que falham sem engine: CRUD bidirecional, duplicação, eventos antigos, concorrência, resolução e tombstone.
- [ ] Rodar Bun test e observar RED.
- [ ] Implementar allowlist, vetor causal, trava por registro, inbox idempotente, outbox, ACK e retenção privada.
- [ ] Rodar testes até GREEN e versionar.
Expected: fila e dados atômicos; aplicação remota sem reemitir eventos.

### Task3: Transporte, coordenador e agendamento pausado
**Files:** supabase/sync/transport.sql; supabase/functions/sincronizar-bancos.ts; supabase/functions/sync-core.ts; src/lib/sincronizacao.test.ts; migrações de cada origem.
**Interfaces:** RPC sync_exchange(body,timestamp,nonce,signature); serviço exclusivo externo; assinaturas do corpo exato, nonce descartável e janela60s; ações pull/apply/ack/status.
- [ ] Escrever testes de assinatura, replay, lote/timeout, ACK perdido e refs a usuários; observar RED.
- [ ] Implementar HMAC com segredos privados, validação, lotes10, lease e repetição progressiva.
- [ ] Provisionar segredo dedicado, RPCs e Edge; criar cron a cada minuto mas iniciar pausado.
- [ ] Negar anon/autenticado comum nos controles, executar testes e versionar.
Expected: falha não perde fila nem bloqueia CRUD; chamadas não autenticadas negadas.

### Task4: Storage e carga inicial
**Files:** supabase/functions/sync-storage.ts; src/lib/sincronizacao.storage.test.ts; scripts/sync-bootstrap.ts.
**Interfaces:** copiar bytes por API, SHA256 e tamanho; registro só publicado após confirmação; mesma chave/bytes divergentes vira conflito.
- [ ] Testar upload interrompido, retomada, conflito e referência bloqueada até arquivo confirmado; RED.
- [ ] Implementar acesso técnico mínimo ao bucket privado, sem replicar identidades de usuários.
- [ ] Instalar alinhamento de esquema e triggers; importar ausentes, registrar divergências sem sobrescrever.
- [ ] Conferir contagens e checksums; GREEN e versionar.
Expected: arquivos privados equivalentes e histórico preservado.

### Task5: Painel master
**Files:** src/components/SincronizacaoBancos.tsx; src/routes/_authenticated/controle.tsx; RPCs owner-only.
**Interfaces:** status, conflitos, repetir e resolver; validação server/database de dono confirmado.
- [ ] Testar negação a usuário comum e resolução gerando revisão causal; RED.
- [ ] Exibir pausa/últimaexecução/pendências/falhas, comparar versões e confirmar escolha.
- [ ] GREEN, TypeScript, build e versionar.
Expected: dono acompanha e resolve sem expor dados a terceiros.

### Task6: Revisão e ativação
**Files:** docs/SINCRONIZACAO.md; ledger de execução.
- [ ] Revisão independente da implementação completa e correções com teste.
- [ ] Executar suíte, TypeScript/build e verificações de segurança.
- [ ] Fazer CRUD de teste em ambos sentidos e testar recuperação.
- [ ] Ativar somente após resolver divergências da carga; verificar cron real.
- [ ] Publicar GitHub/Lovable, conferir domínio, documentar rollback e estado efetivo.
Expected: declarar ativo só com evidência de ambas as direções e arquivos.
