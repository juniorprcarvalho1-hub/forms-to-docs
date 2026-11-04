# SDD ledger — plan: docs/superpowers/plans/2026-11-03-automacao-documental.md

Design aprovado pelo usuário. Execução inline autorizada pela instrução de implementação, sem novas confirmações de método.
Base: fd1eabf5d5cb6e5053cf5188e710936d3a089265; branch proposta-automacao-documental, PR11.
Baseline: CI41746941012 success (código anterior).
Ruling: branch GitHub+CI substitui worktree local — EPERM persistiu após request_permissions — custo: ciclos remotos de verificação, sem risco aos arquivos locais anteriores.
Pre-flight: T1 produz dados validados consumidos por T2; T2 produz jobs/leases consumidos por T3/T4; T3 produz PDF privado consumido por T4; T5 usa projeção limitada de T2; T6 só ativa configurações conferidas.
Task1: em andamento; demais pendentes.

Task1: complete — RED CI41748278354:139pass/15fail; GREEN CI41748637816:154pass/0fail, tsc e build success. Commits d3f47b4..0654701. CLI Supabase2.81.3 gerou 20261104003505_automacao_documental.sql.
Task2: em andamento — teste de fila e autorização PGlite antes da migração.

Task2: complete — RED CI41749302474:156pass/8fail; GREEN CI41749778517:164pass/0fail, tsc/build success. Commit4b28ecc. Fila desativada por padrão; sem migração em produção ainda.
Task3: em andamento. RED CI41879233751/41880276035: módulos HTML/PDF/processador ausentes. Dependências pdf-lib1.17.1/linkedom0.18.12 fixadas, bun.lock gerado no CI e persistido; verificação final usa frozen-lockfile.
Ruling: Chromium REST usa somente script interno com nonce aleatório para aguardar imagens/fontes e detectar overflow — HTML ativo/eventos são recusados, CSP permite só o nonce e dados locais, rede externa bloqueada — custo se errado: PDF pode ficar pendente, nunca arquivar uma saída truncada.
Ruling: Gmail continuará na Lovable; será usado bridge interno com ticket de uso único validado no Supabase — credenciais gerenciadas não podem ser copiadas para Edge ou frontend — custo: uma chamada interna adicional e configuração de bridge, sem expor chaves.
Cloudflare: nenhum plugin retornado na busca; wrangler/OAuth local não encontrado. Pedido de configuração das duas secrets está pendente de resposta. Não contratar serviço ou habilitar cobrança.
