/// <reference types="astro/client" />

// `Env` é gerado por `npm run generate-types` a partir do wrangler.jsonc.
// Os bindings em si vêm de `import { env } from 'cloudflare:workers'`;
// o que sobra em `Astro.locals` é o ExecutionContext e o usuário da sessão.
type CloudflareRuntime = import('@astrojs/cloudflare').Runtime

declare namespace App {
  interface Locals extends CloudflareRuntime {
    /** Preenchido pelo middleware. `null` no site público e em visitante anônimo. */
    user: import('./server/db/schema').User | null
  }
}
