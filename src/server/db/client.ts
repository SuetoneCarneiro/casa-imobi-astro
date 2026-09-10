import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

/**
 * Cria a instância do Drizzle a partir do binding D1.
 *
 * Recebe o binding por parâmetro — não importa `cloudflare:workers` nem nada do
 * Astro. Quem passa é a página (`env.DB`) ou a rota Hono (`c.env.DB`).
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof createDb>
