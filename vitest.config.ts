import { getViteConfig } from 'astro/config'
import { defineConfig, type UserConfig } from 'vite'

/**
 * Dois projetos, separados por natureza do que testam:
 *
 *   api — lógica de servidor pura (validação, senha, slug, formatação) e rotas
 *         Hono com bindings falsos. Roda em Node, sem DOM.
 *   ui  — componentes Astro pela Container API, a ilha React e o script do
 *         carrossel. Roda em jsdom.
 *
 * `getViteConfig` reaproveita a configuração do Astro, o que dá suporte a
 * renderizar `.astro` e a compilar `.tsx` nos testes.
 */
const base = getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'api', environment: 'node', include: ['tests/api/**/*.test.ts'] },
      },
      {
        extends: true,
        /*
         * Node por padrão: a Container API do Astro não renderiza `.astro`
         * sob jsdom. Os arquivos que precisam de DOM (React e o script do
         * carrossel) pedem jsdom no topo com `@vitest-environment jsdom`.
         */
        test: { name: 'ui', environment: 'node', include: ['tests/ui/**/*.test.{ts,tsx}'] },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Só o que tem lógica própria. Páginas e layouts são composição e
      // seriam melhor cobertos por teste de ponta a ponta.
      // Constantes puras (dados de contato) não têm o que testar.
      exclude: ['src/lib/site.ts'],
      include: [
        'src/lib/**/*.ts',
        'src/scripts/**/*.ts',
        'src/server/services/**/*.ts',
        'src/server/validation/**/*.ts',
        'src/server/api/**/*.ts',
        'src/components/**/*.tsx',
      ],
    },
  },
})

/**
 * O `@cloudflare/vite-plugin` instala um runner que executa tudo dentro do
 * workerd, e isso quebra o Vitest com "module is not defined". Nos testes
 * queremos Node e jsdom, então só ele sai.
 *
 * O filtro é por prefixo exato de propósito: os plugins `@astrojs/cloudflare:*`
 * precisam FICAR, porque são eles que resolvem os imports de
 * `cloudflare:workers` usados pelo código do projeto. Remover tudo que tinha
 * "cloudflare" no nome deixava os componentes `.astro` sem conseguir compilar.
 * Passar `adapter: undefined` não ajuda: a configuração é lida do disco.
 */
export default defineConfig(async (env) => {
  const resolvido = (await (base as unknown as (e: typeof env) => Promise<UserConfig>)(env)) ?? {}
  const plugins = (resolvido.plugins ?? []).flat(Infinity) as { name?: string }[]

  return {
    ...resolvido,
    plugins: plugins.filter((p) => !p?.name?.startsWith('vite-plugin-cloudflare')),
  }
})
