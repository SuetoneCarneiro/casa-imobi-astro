/// <reference types="astro/client" />

// `Env` é gerado por `npm run generate-types` a partir do wrangler.jsonc.
// Os bindings em si vêm de `import { env } from 'cloudflare:workers'`;
// o que sobra em `Astro.locals` é o ExecutionContext.
type CloudflareRuntime = import('@astrojs/cloudflare').Runtime

declare namespace App {
  interface Locals extends CloudflareRuntime {}
}
