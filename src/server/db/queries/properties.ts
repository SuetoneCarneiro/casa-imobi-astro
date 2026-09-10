import { desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { properties } from '../schema'

/**
 * Consultas de imóveis.
 *
 * São chamadas DIRETO pelas páginas Astro no SSR — sem passar por HTTP. A API
 * Hono usa as mesmas funções para o painel. Uma fonte de verdade, dois consumidores.
 */

/** Só imóveis ativos: `status = 'inactive'` é o soft delete. */
export async function listActiveProperties(db: Db, limit = 12) {
  return db
    .select()
    .from(properties)
    .where(eq(properties.status, 'active'))
    .orderBy(desc(properties.createdAt))
    .limit(limit)
}

export async function countActiveProperties(db: Db) {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(properties)
    .where(eq(properties.status, 'active'))
  return row?.total ?? 0
}

export async function findPropertyBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(properties).where(eq(properties.slug, slug)).limit(1)
  return row ?? null
}
