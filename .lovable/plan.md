# Corrigir fidelidade dos modelos no PDF

## Objetivo
Garantir que ofícios e declarações usem o HTML mais recente confirmado no banco ao visualizar, editar, imprimir ou baixar PDF, preservando apenas edições manuais feitas no documento individual.

## Diagnóstico confirmado
- Configurações salva os corpos em `modelos_oficio.modelo_html` e `modelos_declaracao.modelo_html`; cabeçalho e rodapé dos ofícios ficam em `configuracoes`.
- A geração usa essas tabelas, mas trabalha com dados mantidos pelo cache do React Query na tela de documentos.
- A invalidação atual apenas marca consultas como antigas; uma tela já aberta pode gerar durante a janela anterior ao novo carregamento.
- `conteudo_html` de um documento individual tem precedência intencional sobre o modelo geral. Isso deve continuar apenas para documentos que foram editados individualmente.
- Não há template compilado, cache de CDN ou cache serverless no fluxo do PDF; o PDF é montado no navegador a partir do HTML recebido.

## Implementação
1. Centralizar consultas de configuração e modelos com funções que sempre possam buscar uma versão fresca do banco.
2. Ao salvar Configurações:
   - aguardar todas as gravações;
   - conferir o HTML devolvido pelo banco;
   - atualizar imediatamente o cache local com os valores confirmados;
   - refazer as consultas antes de informar sucesso;
   - manter a tela em estado de erro se qualquer modelo não for realmente persistido.
3. Antes de visualizar, abrir o editor, imprimir ou gerar PDF:
   - buscar novamente `configuracoes` e os modelos aplicáveis diretamente do banco;
   - montar o HTML somente depois dessa leitura;
   - aplicar isso a todos os modelos de ofício e aos quatro modelos de declaração.
4. Manter a precedência de `conteudo_html` somente quando o usuário editou aquele documento específico; documentos sem edição continuam refletindo o modelo geral mais recente.
5. Remover/evitar caminhos auxiliares que possam gerar ofício sem receber a lista atual de modelos.

## Validação automática
- Adicionar testes de regressão para todos os modelos de ofício e declaração usando uma marca textual única salva no modelo.
- Confirmar que o HTML entregue ao gerador contém exatamente a marca nova e não contém a versão antiga.
- Confirmar separadamente que uma edição manual em `conteudo_html` continua prevalecendo.
- Executar os testes, validar o build e fazer uma verificação autenticada no navegador do fluxo salvar → gerar/baixar PDF.
