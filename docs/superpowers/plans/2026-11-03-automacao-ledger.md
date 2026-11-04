# SDD ledger — plan: docs/superpowers/plans/2026-11-03-automacao-documental.md

Design aprovado pelo usuário. Execução inline autorizada pela instrução de implementação, sem novas confirmações de método.
Base: fd1eabf5d5cb6e5053cf5188e710936d3a089265; branch proposta-automacao-documental, PR11.
Baseline: CI41746941012 success (código anterior).
Ruling: branch GitHub+CI substitui worktree local — EPERM persistiu após request_permissions — custo: ciclos remotos de verificação, sem risco aos arquivos locais anteriores.
Pre-flight: T1 produz dados validados consumidos por T2; T2 produz jobs/leases consumidos por T3/T4; T3 produz PDF privado consumido por T4; T5 usa projeção limitada de T2; T6 só ativa configurações conferidas.
Task1: em andamento; demais pendentes.
