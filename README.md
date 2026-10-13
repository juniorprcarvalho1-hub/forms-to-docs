# Ofício Fácil

Crie um sistema web moderno, simples, intuitivo e responsivo para gerenciamento e geração automática de ofícios.

O sistema NÃO terá formulário interno para cadastro. Todas as informações serão recebidas automaticamente de um Google Forms (ou Google Sheets vinculado ao Forms).

Objetivo:

Sempre que uma nova resposta for enviada no Google Forms, o sistema deverá importar automaticamente os dados e gerar um novo ofício.

Requisitos:

* Tela de Login.

* Dashboard com:

- Total de ofícios gerados.

- Quantidade gerada no mês.

- Últimos documentos.

- Campo de pesquisa.

* Tela "Ofícios":

- Lista de todos os ofícios.

- Pesquisa por número, nome, instituição ou assunto.

- Visualização em tabela.

- Botão Visualizar.

- Botão Baixar PDF.

- Botão Imprimir.

* Cada ofício deve possuir:

- Número sequencial automático.

- Exemplo:

OFÍCIO Nº 001/2026

OFÍCIO Nº 002/2026

OFÍCIO Nº 003/2026

Nunca repetir numeração.

* O texto do documento será baseado em um modelo fixo contendo campos variáveis.

Exemplo:

{{numero}}

{{data}}

{{nome}}

{{cpf}}

{{instituicao}}

{{cargo}}

{{assunto}}

Esses campos serão preenchidos automaticamente com os dados recebidos do Google Forms.

* O sistema deverá salvar:

- número

- data

- nome

- CPF

- instituição

- cargo

- assunto

- PDF gerado

* Tela "Configurações":

- Editar modelo do ofício.

- Alterar logo.

- Alterar assinatura.

- Alterar formato da numeração.

* Interface limpa, moderna e semelhante ao Google Workspace.

* Utilizar Supabase para banco de dados, autenticação e armazenamento dos PDFs.

* Preparar o sistema para integração com Google Forms via webhook ou automação (n8n, Make ou Google Apps Script), permitindo receber automaticamente novos registros sem necessidade de intervenção manual.

O foco principal é simplicidade, rapidez e facilidade de uso. O administrador deve conseguir localizar qualquer documento em poucos segundos, enquanto o estagiário apenas preenche o Google Forms, sem acesso ao sistema.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://forms-to-docs.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f79f268a-107c-4be5-8940-633eefc0e476).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
