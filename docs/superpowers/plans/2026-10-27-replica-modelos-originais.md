# Replicar os modelos originais da Lovable — 27/10/2026

Referência autorizada: projeto Ofício Fácil, banco original da Lovable. Preservar aparência, textos, campos e comportamento dos três fluxos: Ofícios, Preceptoria e declaração de preenchimento da avaliação do supervisor de campo.

## Evidência da comparação

A origem tem três modelos de Ofícios, quatro de Preceptoria, quatro de Avaliação, quatro orientadores, uma declaração de Preceptoria, quatro declarações de Avaliação e quatorze arquivos privados. Os modelos externos de Preceptoria estão vazios; os demais são versões genéricas diferentes da origem. A origem não contém Pacientes.

## Execução

1. Manter a implementação na ramificação isolada, sem alterar o checkout local anterior.
2. Transferir os quatorze arquivos com acesso autenticado de servidor, conferir tamanho e SHA256. PDFs ficam no prefixo privado da conta institucional; as imagens continuam privadas.
3. Copiar os onze modelos e configurações reais, orientadores e cinco documentos. Preservar tokens, contas, planos e controles de acesso atuais. Atualizar somente referências técnicas de imagens e caminhos dos arquivos.
4. Revalidar imagens institucionais no editor e no PDF, evitando URLs antigas vencidas. O assinador autenticado aceita somente imagens da pasta institucional e exige conta ativa.
5. Corrigir o pacote para três integrações. Fornecer perfis de Avaliação para Enfermagem9/10, Fisioterapia9/10, Nutrição7/8 e Psicologia9/10; respostas existentes prevalecem sobre padrões do script. Retirar Pacientes da navegação e da importação documental, sem apagar dados.
6. Conferir os modelos importados por hash normalizado, arquivos por hash binário, documentos e propriedade, testes automatizados e publicação. Encerrar o acesso temporário de transferência.

## Verificação

- Regressões para URLs de imagens vencidas, preservação de estilo/tags e recusa de destinos externos.
- Assinatura de imagens: sem sessão, token inválido, suspensão e tentativa de acessar PDF privado.
- Leitura temporária: travessia de caminho e destinos fora do bucket.
- Oito perfis de curso/período e preservação das respostas originais.
- Dados e arquivos reais: contagens, hashes e vínculos; nenhuma credencial ou registro pessoal será versionado.
