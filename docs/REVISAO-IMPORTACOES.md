# Revisão do sistema e melhorias

Implementado localmente: cadastro administrativo de pacientes restrito a administradores, importação revisada de CSV/TSV/TXT/XLSX/JSON para pacientes e três tipos de documentos, validação e seleção de linhas, deduplicação, transações e conector de novas respostas do Google Forms. O formulário real ainda não foi fornecido; seu mapeamento precisa ser conferido antes da ativação.

Corrigidos nesta alteração: campos de documentos agora escapam HTML; a interface autenticada bloqueia conteúdo enquanto verifica acesso e quando essa verificação falha. Modelos de documentos e edições manuais foram preservados.

## Prioridades restantes

1. Revisar as políticas antigas de documentos: as migrações existentes permitem acesso amplo a usuários autenticados e há criação de contas na tela de autenticação. Definir quem pode cadastrar contas e quais registros cada papel pode consultar. A nova área de pacientes exige administrador.
2. Restringir o acesso ao token dos webhooks antigos em configurações. O novo conector guarda somente hash e permite revogação; a mesma abordagem pode ser aplicada aos conectores legados.
3. Aplicar a migração em ambiente de teste e validar login, funções e permissões no Supabase real. Depois publicar o código na Cloudflare e testar uma resposta fictícia do Forms. Não há validação ponta a ponta de produção nesta entrega.
4. Conferir os logotipos publicados, observados anteriormente com falha de carregamento. Manter os arquivos institucionais e oferecer textos alternativos.
5. Definir retenção, exclusão e trilha de auditoria para cadastros administrativos antes de ampliar a área para informações clínicas. Prontuários e diagnósticos ficam fora do importador atual.

## Design e referências

Foram instaladas as skills [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) e [Apple Design](https://github.com/tzzs/apple-design-skill). A implementação mantém a identidade existente e usa etapas claras, revisão antes de salvar, erros legíveis e tabelas com rolagem interna em telas pequenas.

O [Apple Dev MCP](https://github.com/tmaasen/apple-dev-mcp) é uma opção de consulta a documentação e diretrizes Apple. Não foi instalado: não é necessário para implementar esta interface web e não fornece controle do Windows.

O conector usa o [gatilho instalável de envio de formulário pela planilha](https://developers.google.com/apps-script/guides/triggers/events), com `namedValues`; exige autorização da conta Google que mantém a planilha. Consulte também [gatilhos instaláveis](https://developers.google.com/apps-script/guides/triggers/installable).

## Evidências

26 testes automatizados passaram, TypeScript sem erros, lint dos arquivos novos sem erros e build de produção concluído. Migração exercitada em PostgreSQL local via PGlite com quatro destinos, rollback, repetição, numeração, permissões e revogação. Prévia visual testada em desktop e celular, com dados fictícios e Excel de duas abas. Esses resultados não confirmam publicação em produção.

Consulte IMPORTACOES.md para formatos, limites e ativação.
