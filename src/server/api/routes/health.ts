import { Hono } from 'hono'
import type { ApiEnv } from '../index'

export const health = new Hono<ApiEnv>()

/**
 * Confere se os bindings realmente chegaram até aqui.
 * Serve de prova de que a fiação Astro → Hono → Cloudflare está fechada.
 */
health.get('/', async (c) => {
  const [db, bucket] = await Promise.all([check(() => c.env.DB.prepare('select 1').first()), check(() => c.env.BUCKET.head('__health__'))])

  const ok = db.ok && bucket.ok
  return c.json({ ok, service: 'casaimobi-api', checks: { db, bucket } }, ok ? 200 : 503)
})

async function check(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
