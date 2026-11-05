# Diagnóstico: 500 em produção (deploy c524904d)

## Erro exato (logs reais do Worker publicado, última hora)
Todas as entradas de erro são idênticas, sem outro erro misturado:

```text
TypeError: Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined.
    at _libs/pdf-lib+tslib.mjs:19:7   (status 500)
```

## Causa confirmada
- O erro ocorre na **inicialização do módulo** do chunk empacotado `pdf-lib + tslib`, não dentro de um handler. Por isso todas as rotas SSR (/auth) e /api/internal/documentos-email falham; arquivos estáticos (/brand/facesf.png) não passam pelo Worker e retornam 200.
- `pdf-lib@1.17.1` (build CJS) faz `var { __extends, ... } = require("tslib")`. No bundle do Worker, o tslib foi convertido para ESM e o interop `__toESM(...).default` ficou `undefined`.
- linkedom **não** aparece nos logs; não há evidência contra ele.
- Cadeia de importação no projeto (arquivos que puxam pdf-lib fora de testes):
  - `src/routes/api/internal/documentos-email.ts`
  - `src/lib/automacao-email-bridge.adapter.server.ts` → `src/lib/automacao-email-bridge.server.ts` (linha 1: `import {PDFDocument} from "pdf-lib"`)
  - `src/lib/automacao-html.ts` (linha 2) e `src/lib/pdf-validacao.ts` (linha 1)
  - `src/lib/automacao-processador.ts`
- A linha/arquivo de origem no código do app não é exibida no stack (o Worker mostra só o chunk `_libs/pdf-lib+tslib.mjs:19:7`); a origem é o import estático de pdf-lib acima. CI passa porque Node/Vitest resolve o CJS do tslib corretamente — só o runtime Worker de produção falha.

## Correção proposta (para aplicar via GitHub, não aplicada agora)
1. Em `vite.config.ts`, apontar `tslib` para a versão ESM: `resolve.alias: { tslib: "tslib/tslib.es6.mjs" }` (sem `ssr.external`).
2. Opcional/defensivo: trocar imports estáticos de pdf-lib por `await import("pdf-lib")` dentro das funções, para que uma falha futura afete só o endpoint de e-mail e não derrube /auth.
3. Validar com build de produção + smoke test no runtime Worker (requisição a /auth e ao endpoint) antes do merge; conferir os logs pós-deploy.

Nada foi editado, nenhum e-mail enviado, nenhum secret exposto.
