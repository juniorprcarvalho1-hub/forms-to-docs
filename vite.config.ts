// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import {createRequire} from "node:module";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const requireConfig=createRequire(import.meta.url);
export default defineConfig({
  vite:{
    // Use a entrada ESM de PDF e preserve a versão de tslib de cada dependência.
    resolve:{alias:[{find:/^pdf-lib$/,replacement:requireConfig.resolve("pdf-lib/es/index.js")}]},
    ssr:{noExternal:["pdf-lib","tslib"]},
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
