import type { Config } from 'drizzle-kit'

/**
 * Só gera o SQL das migrations. Quem aplica é o wrangler:
 *   npm run db:migrate      (local, .wrangler/state)
 *   npm run db:migrate:prod (remoto, exige o banco criado na Cloudflare)
 *
 * Por isso não há credencial nenhuma aqui — drizzle-kit nunca fala com o D1.
 */
export default {
  schema: './src/server/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
} satisfies Config
