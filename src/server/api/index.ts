import { Hono } from 'hono'
import { health } from './routes/health'

/**
 * Bindings do Cloudflare disponíveis para a API.
 * Vêm do wrangler.jsonc e são injetados pelo Worker em cada request.
 */
export type ApiBindings = {
  DB: D1Database
  BUCKET: R2Bucket
}

export type ApiEnv = { Bindings: ApiBindings }

/**
 * App Hono da CasaImobi.
 *
 * IMPORTANTE: este arquivo — e tudo sob `src/server/` — não pode importar nada
 * de `astro`. É o que permite extrair a API para um Worker próprio no futuro
 * sem reescrever nada. A única cola com o Astro é `src/pages/api/[...path].ts`.
 */
export const api = new Hono<ApiEnv>().basePath('/api')

api.route('/health', health)

api.notFound((c) => c.json({ error: 'Rota não encontrada' }, 404))

api.onError((err, c) => {
  console.error('[api]', err)
  return c.json({ error: 'Erro interno' }, 500)
})

export type ApiType = typeof api
