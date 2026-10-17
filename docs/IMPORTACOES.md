# Importação e cadastro de pacientes

## Fluxo da recepção

1. A pessoa entra em contato pelo WhatsApp.
2. A recepção envia o link do formulário da clínica.
3. O paciente preenche o Forms, conectado a uma planilha de respostas.
4. A recepção importa o CSV/XLSX ou conecta o Apps Script da aba **Pacientes → Google Forms**.
5. O novo registro aparece com situação **Novo cadastro**. Um administrador confere os dados e atualiza a situação.

O sistema não envia mensagens de WhatsApp sozinho. A tela permite copiar uma mensagem com o link do formulário para a recepção revisar e enviar.

## Ativação

Aplicar, nesta ordem, `supabase/migrations/20261016150000_importacoes_pacientes.sql` e `supabase/migrations/20261017010000_acessos_webhooks_legados.sql` no projeto Supabase já utilizado pelo sistema, em ambiente de teste antes da produção. O deploy do frontend na Cloudflare não aplica migrações do Supabase. Não foi disponibilizado acesso administrativo ao banco: a execução real permanece pendente.

A migração cria pacientes administrativos, histórico/idempotência da importação, funções de gravação e integrações com token. Pacientes e conectores exigem o papel **admin** já utilizado por `public.has_role`; criar uma conta não concede esse papel. Nenhum acesso anônimo de leitura de pacientes é criado.

A segunda migração substitui as políticas antigas de documentos: administradores têm acesso geral; usuários explicitamente aprovados em Configurações acessam somente documentos próprios. Registros legados sem proprietário ficam restritos ao administrador. Apenas retirar o cadastro da interface não desativa a API de criação de contas do Supabase: o administrador também deve desativar cadastro público nas opções de autenticação e enviar convites por seu painel. A aprovação não promove ninguém a administrador.

O token legado é convertido para hash sem invalidar o valor que os scripts já usam; o campo em configurações fica vazio. Trocar o token invalida o anterior dos três webhooks. Revogar desativa esses recebimentos. A interface não consulta mais o token em claro. Até aplicar a migração, a política antiga do banco continua existindo e os endpoints mantêm compatibilidade com o token anterior. Não confundir a publicação da interface com a ativação dessas políticas.

O Worker precisa das variáveis públicas `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` ou dos equivalentes `VITE_*` na compilação. O novo endpoint de pacientes **não usa a chave service_role**. Os webhooks antigos de documentos continuam com sua configuração existente.

Para respostas futuras, copie o script disponível na interface para **Extensões → Apps Script** da planilha de respostas. Gere o token e salve-o nas **Propriedades do script**, chave `FACESF_TOKEN`. Execute `instalarIntegracao()` na conta responsável; o Google solicita autorização. O script usa o gatilho instalável da **planilha**, que fornece `e.namedValues`; não é o gatilho direto do formulário. A conta que instala o gatilho precisa manter acesso à planilha.

Faça um envio com dados fictícios e confira a resposta no cadastro. O sistema não altera o Forms existente nem instala o gatilho automaticamente. Um link de Forms não oferece acesso às respostas; não publique planilhas de pacientes para contornar autenticação.

## Formatos e limites

- CSV, TSV, TXT tabulado, Excel **.xlsx** e JSON (lista de objetos ou `{ "respostas": [...] }`).
- Planilha: títulos únicos na primeira linha; escolher a aba quando houver mais de uma.
- Até 5 MB, 100 colunas e 500 respostas por arquivo/lote. Nenhuma linha excedente é descartada silenciosamente.
- Planilhas antigas `.xls`, PDF, imagens e Word não são interpretados. Exporte dados tabulares como CSV/XLSX. OCR de documentos pessoais não está habilitado.
- A leitura do arquivo acontece no navegador. Somente campos mapeados e linhas aprovadas são enviados ao Supabase após confirmação.
- Campos administrativos: nome, CPF, telefone, e-mail, nascimento, responsável, endereço e curso/especialidade. Não importar diagnósticos ou prontuários nesses campos.
- CPF, telefone, e-mail e datas são validados. Nome e pelo menos um identificador/contato são necessários para pacientes.
- Valores do CSV não são executados; arquivos de pendências neutralizam prefixos de fórmulas.

## Destinos e duplicados

Há destinos separados para pacientes, ofícios, declarações de preceptoria e declarações de resposta. Uma linha não cria simultaneamente paciente e declaração: revisar cada finalidade evita emitir documento por engano.

O lote usa uma transação: um erro no banco reverte o lote inteiro. Há chave de idempotência por operação e fingerprint canônico por registro importado. Pacientes existentes são comparados por CPF ou combinação de nome, nascimento e contatos. Nenhum cadastro é sobrescrito. Registros antigos criados fora da importação só são detectados automaticamente como duplicados para pacientes; documentos antigos precisam de conferência.

O conector automático aceita apenas novos pacientes, tem limite de 100 recebimentos/hora por token, ignora duplicados e não devolve cadastros. O token é mostrado uma única vez e só seu hash fica no banco. **Suas conexões** permite revogar tokens antigos após recarregar a página.

## Verificação realizada

- Testes de CSV/JSON, campos, datas, duplicados, proteção de HTML e limites HTTP.
- Migração executada em PostgreSQL local via PGlite, com papéis simulados de administrador, usuário e anônimo; verificados quatro destinos, rollback, repetição de operação, numeração, RLS, token e revogação.
- Prévia visual local com dados fictícios; revisão, confirmação e conclusão. Excel com duas abas lido e trocado no navegador.
- Esses testes não equivalem a aplicar a migração ou autenticar o Google em produção.
