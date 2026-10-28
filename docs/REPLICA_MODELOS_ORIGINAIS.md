# Réplica dos modelos originais — 28/10/2026

O aplicativo usa o Supabase `auxsyadqijcjngmujagx`. O banco original da Lovable (`qwhvceqqubofxpdxnhtz`) foi preservado como origem da migração.

## Fluxos

- Ofícios: três modelos originais (padrão para Enfermagem/Fisioterapia, Nutrição, Psicologia).
- Declarações de Preceptoria: quatro modelos originais, um por curso.
- Declarações de Avaliação de Supervisor de Campo: quatro modelos originais com período dinâmico. Perfis de formulários: Enfermagem 9/10, Fisioterapia 9/10, Nutrição 7/8, Psicologia 9/10.

Não existe integração de Pacientes nestes fluxos.

## Migração e validação

Foram copiados 11 modelos, quatro orientadores, cinco documentos históricos e 14 arquivos privados (5.792.078 bytes). Os arquivos foram conferidos por tamanho e SHA-256 após a cópia. O HTML dos modelos preserva o conteúdo e os estilos originais; apenas referências técnicas às imagens foram ajustadas à nova hospedagem.

Os cinco documentos pertencem à conta institucional e têm origem `lovable_migracao`. As quatro avaliações antigas continuam sem envio de e-mail: o envio automático é bloqueado tanto na página quanto no servidor. O envio manual continua disponível.

Uma verificação autenticada pela conta institucional confirmou leitura dos 11 modelos, quatro orientadores e cinco documentos sob RLS, acesso à imagem institucional idêntica à original, CORS e recusa de PDFs pelo endpoint de imagens. O bucket continua privado. Nenhum e-mail real foi enviado na verificação.

O recurso temporário de cópia foi encerrado com resposta HTTP 410. A rota antiga de inspeção também retorna 410 e não acessa o banco original.

## Formulários Google

Os scripts estão em `apps-script/`, com instruções no README dessa pasta. Instale somente um script por formulário; os oito arquivos de `avaliacao/` são alternativas específicas ao script genérico de avaliação. Configure o token em Propriedades do script e execute `instalarIntegracao` com a autorização do Google.

Novas respostas seguem diretamente para o Supabase externo. Esta migração não configura sincronização bidirecional entre os dois bancos. Alterações futuras do aplicativo devem usar o projeto externo acima.
