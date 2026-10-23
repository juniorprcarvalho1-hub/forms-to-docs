# Controle de usuários

Somente a conta autenticada e com e-mail confirmado juniorprcarvalho1@gmail.com pode abrir o painel e executar as operações. O papel admin da instituição não concede essa permissão.

## Operação

O cadastro solicita nome, e-mail, senha inicial (mínimo 8 caracteres), plano e vencimento. A conta é criada com o e-mail confirmado pelo proprietário. Entregue a senha inicial ao usuário por um canal seguro. Os planos mantêm os valores existentes: mensal R$ 250, semestral R$ 1.500 e anual R$ 3.000.

Cada conta tem seu próprio plano, vencimento e suspensão. O vencimento inclui o dia informado, usando America/Fortaleza. Salvar um plano preserva a suspensão e não gera cobrança nem registra pagamento. A conta do proprietário não pode ser suspensa ou ter seu plano alterado por essas operações.

Suspender bloqueia o acesso aos dados pelo banco, inclusive com uma sessão já emitida. O servidor também bloqueia novos logins pelo Auth. Se essa segunda etapa falhar, o painel mostra um aviso; o bloqueio dos dados permanece. Reativar não renova um plano vencido.

## Ativação

1. Aplicar as migrações anteriores do projeto e depois 20261022220859_controle_usuarios_proprietario.sql no Supabase correto.
2. Publicar a Edge Function controle-master no projeto auxsyadqijcjngmujagx. Ela valida o usuário atual e usa a chave de serviço automática somente dentro do Supabase. A aplicação não precisa de chave de serviço para o painel master.
3. Publicar o código e validar com a conta confirmada do proprietário e uma conta de teste comum.

A migração copia o plano institucional existente para contas previamente aprovadas ou administradores existentes. Contas pendentes continuam sem acesso até receber um plano. Confira os vencimentos copiados antes de liberar o uso. Os pagamentos históricos permanecem disponíveis para consulta; o antigo bloqueio global e a renovação global foram substituídos pelo gerenciamento individual no painel.

A verificação do proprietário não depende da chave de serviço. Usuários comuns consultam uma função restrita no banco; a falta da migração bloqueia a verificação de acesso em vez de liberar dados.

## Verificação local

Executar bun install --frozen-lockfile, bun test e bun run build. Os testes SQL usam PGlite com dados fictícios e não acessam produção. Eles cobrem isolamento do proprietário, proteção da própria conta, plano vencido, suspensão de sessão existente, documentos e PDFs e tentativas de alteração direta por usuários comuns.

O novo projeto auxsyadqijcjngmujagx foi inicializado a partir das migrações do repositório. Registros e arquivos do banco antigo não fazem parte do GitHub e não foram transferidos. O proprietário precisa ter uma conta com e-mail confirmado nesse novo projeto. Credenciais não são gravadas em arquivos.


A configuração pública do backend fica em src/lib/supabase-config.ts para impedir que variáveis antigas do Lovable redirecionem a aplicação ao projeto anterior. A inicialização de um banco vazio usa supabase/bootstrap/base.sql e depois as migrações em ordem; qualificar gen_random_bytes e digest com o esquema extensions, conforme a instalação do pgcrypto.

A conta master pode trocar sua própria senha no final do Painel de Controle. Senhas temporárias de provisionamento são entregues separadamente, sem inclusão em arquivos ou commits.
