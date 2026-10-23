# Sincronização bidirecional dos bancos

Status: proposta; aguarda aprovação. Nenhuma sincronização instalada.

## Objetivo e contexto

O usuário escolheu manter Lovable Cloud e Supabase externo com troca automática nos dois sentidos. O aplicativo da Lovable já usa o externo `auxsyadqijcjngmujagx`; Cloud antigo: `qwhvceqqubofxpdxnhtz`. No Cloud foram contados 1 declaração, 4 respostas, 1 pagamento e 14 arquivos (12 PDFs, 2 PNGs, cerca de 5,8 MB). Esse histórico ainda não está no externo. Há diferenças de esquema. O GitHub main sincronizado com a Lovable é a fonte atual; preservar trabalho local anterior.

## Abordagens

- Banco único externo com migração: recomendado por menor manutenção, mas não escolhido.
- Dois bancos com filas persistentes e conflitos controlados: escolhido pelo usuário.
- Sobrescrita integral periódica: descartada por risco de perder alterações e exclusões.

## Escopo proposto pelo implementador

Sincronizar dados operacionais: ofícios, declarações, respostas, pacientes, cursos, professores, módulos, orientadores, modelos, configurações não secretas, importações e itens, histórico de pagamentos, arquivos do bucket privado `oficios`. Alinhar estruturas operacionais necessárias sem substituir políticas existentes. Integrações exigem separar configuração não secreta de credenciais.

Autenticação, senhas, sessões, permissões, IPs bloqueados e planos/suspensões continuam administrados no externo. Não replicar `auth`, `user_roles`, `assinatura`, `assinaturas_usuarios`, `acessos_autorizados`, `ips_bloqueados` ou segredos. Login Google no editor Lovable não equivale a login do sistema. A sincronização não cria contas nem altera permissões no Cloud. Login independente em ambos os aplicativos exigiria uma decisão adicional sobre identidade.

## Dados, conflitos e exclusões

Preservar IDs operacionais. Mapear referências a usuários por e-mail confirmado, nunca por coincidência de UUID; ausência de correspondência fica pendente. Nenhuma atribuição automática de privilégios.

Carga inicial: importar registros ausentes nos dois lados. Mesmo ID com conteúdo divergente vira conflito com duas versões, inclusive modelos/configurações. Não sobrescrever o externo nem apagar dados por ausência na origem. IDs distintos são preservados; suspeitas de duplicidade são relatadas.

Fluxo contínuo: evento com ID único, origem, revisão e revisão-base; aplicar uma vez, em ordem por registro. Revisão-base divergente gera conflito para o dono escolher. Não decidir por relógio de cliente. Aplicação remota não reemite evento de origem. Respeitar dependências e chaves estrangeiras, serializando lotes por origem. Decisão de conflito gera nova revisão propagável.

DELETE gera tombstone; guardar conteúdo recuperável em esquema privado por 30 dias. Propagar exclusões somente após ambas as pontas conhecerem o registro e a revisão-base. Eliminação física de arquivos exige retenção e confirmação dos dois lados.

## Arquitetura

Triggers em cada banco gravam alterações em outbox na mesma transação do cadastro. Edge Function no externo coordena leitura/aplicação em lotes, agendada a cada minuto no servidor. Meta de convergência: até 60 segundos em condições normais. Falhas não bloqueiam o cadastro; filas persistem até confirmação, com espera progressiva, trava contra execução concorrente e estado de falha visível.

RPCs com lista explícita de tabelas/colunas/operações, sem SQL arbitrária. Transporte autenticado com segredo dedicado, HMAC, validade curta, proteção contra replay e comparação segura. Segredos no Vault/armazenamento privado, acessíveis somente ao sincronizador. Nenhuma chave administrativa em frontend, repositório ou logs. RLS nunca desabilitada globalmente. A implantação depende de verificar suporte real a agendamento, acesso mínimo ao Storage e provisionamento seguro dos segredos; se faltar, reportar bloqueio e não anunciar sincronização ativa.

Arquivos: copiar bytes via API com checksum/tamanho; copiar `storage.objects` sozinho é insuficiente. Só publicar referência no destino após confirmar upload. Retomar sem duplicação. Mesmo caminho com bytes diferentes vira conflito preservando versões. Bucket permanece privado; sem URLs públicas permanentes.

## Painel e acesso

Painel master mostra última execução, filas, falhas e conflitos; permite repetir e escolher versão. Restrito no frontend, servidor e banco ao dono verificado `juniorprcarvalho1@gmail.com`. Não expor senhas ou dados clínicos em logs. Auditoria registra IDs e ações; detalhes de conflitos só ao dono.

## Implantação e validação

Inventariar todas as colunas e referências antes das migrações. Criar migrações versionadas para cada banco, preservando esquema e RLS atuais. Aplicativo continua no externo. Instalar sincronizador pausado, fazer carga inicial e conferir contagens, referências e checksums. Resolver divergências antes de ativar processamento contínuo. Não apagar o banco antigo.

Testar INSERT/UPDATE/DELETE nos dois sentidos, repetição, ordem, concorrência, conflito de revisão, indisponibilidade/retomada, FKs, identidade, replay, assinatura inválida, negação a usuário comum e bytes de arquivos. Usar registros de teste identificáveis e removê-los. Executar testes existentes, TypeScript e build. Antes de declarar pronto, confirmar em produção alteração de teste em cada sentido. Rollback pausa trabalhador e mantém filas/tombstones; aplicativo permanece funcional no externo.

Não objetivos: copiar credenciais, login unificado entre dois Auth, colaboração instantânea, substituir backups ou remover banco antigo. Detalhes de índices, lotes, nomes internos e duração de travas ficam com o implementador. Mudanças de identidade, escopo e conflitos exigem nova decisão do usuário.
