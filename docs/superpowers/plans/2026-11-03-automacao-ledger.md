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

Task3/4 core: GREEN CI41910402294 (head a290e69):212pass/0fail, tipos/build success. Corrigida montagem literal da migração antes de aplicar; nenhuma alteração de banco em produção foi realizada.
Hardening: RED CI41913616392:212pass/5fail — limite de retries, retomada antes do cron, confirmação com consumidor pausado, curso editado/modelo divergente e GIF.
Integração pendente: worker HTTP/cron, bridge real hospedado, UI de andamento/configuração e implantação. Cloudflare secrets não confirmadas; usuário aprovou continuidade, pediu passo a passo ou configuração por nós. Controle CUA indisponível (timeout/transport closed); guia oficial enviado, sem criar token ou contratar serviço.
Testes nativos: pacote Puppeteer-core24.26.1 isolado em tests/renderizador, lock16.800bytes gerado por CI. Nenhum dado real nos fixtures.

Task4/5: GREEN CI41934855529:235pass, build/tipos e impressão Chromium (imagem, excesso de página e CSS de impressão) verdes. Consumidor HTTP, bridge real, fila no servidor e configuração documental implementados.
Revisão independente de branch inteira (review_automacao_whole_branch) encontrou 3Important, semCritical: falha de persistência após Gmail, cliente antigo manual confirmando antes de enviar, download divergente do arquivo imutável. Correções cobertas por RED CI41938627981 e implementadas em uma passagem.
Ruling: endpoint legado de avaliação deve rejeitar e pedir recarga, em vez de resolver apenas ao enfileirar — cliente antigo ignora retorno e marca enviado — custo: usuário com página antiga recarrega uma vez.
Ruling: downloads/impressão usam PDF privado da versão concluída; fallback local não sobrescreve arquivo — preservar snapshot/anexo — custo: consulta de andamento antes de baixar.
Verificação de formulários originais via páginas públicas: ofício tinha títulos Professor(a) orientador(a) e Qual seu estagio?; preceptoria tinha Nome completo do preceptor e Nome(s) do(s) aluno(s). Testes reais desses títulos observaram RED antes dos aliases explícitos.
Deno: CI41937724872 revelou tipagem Window do linkedom; corrigido contrato estrutural do DOM para não depender de document global do navegador.
Ruling: criação de extensão pg_cron somente se disponível, cron com consumidor inicialmente desabilitado — projeto tinha pg_net mas não pg_cron habilitado — sem tráfego de documentos antes da ativação.
Task6 em andamento: fixtures dos onze modelos originais com dados técnicos e16perfis adicionados. Sem e-mails reais de teste, sem exposição de secrets. Migração/publicação/diagnóstico de produção ainda não executados.

Task6 validação GREEN CI41942231314:240pass/0fail, build/tipos/Deno verdes, Chromium validou16perfis dos11modelos originais e3casos de integridade. Fixtures usam logo público como asset de teste; Storage/Cloudflare reais dependem do diagnóstico externo.
Preflight de políticas reais encontrou a antiga política permissiva Autenticados gerenciam modulos. RED CI41942502812:240pass/1fail reproduz acesso indevido; removida essa política ao instalar a permissão documental restrita.

Migração automacao_documental aplicada com sucesso no Supabase externo em05/11UTC, inicialmente desabilitada. Histórico não foi reenfileirado. A instalação ativa apenas agendamento e infraestrutura; falta diagnóstico de secrets para ativar processamento.
GREEN CI41943548322:241pass/0fail, build/tipos,16perfis+3casos Chromium e Deno tanto no consumidor quanto no receptor formularios. Lockfile Deno gerado pelo runtime, persistido e etapa final usa --frozen.
