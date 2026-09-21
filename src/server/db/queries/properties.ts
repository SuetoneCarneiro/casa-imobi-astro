import { and, desc, eq, gte, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../client'
import { properties, type Property } from '../schema'

/**
 * Consultas de imóveis.
 *
 * São chamadas DIRETO pelas páginas Astro no SSR, sem passar por HTTP. A API
 * Hono usa as mesmas funções para o painel. Uma fonte de verdade, dois consumidores.
 */

export type PropertyFilters = {
  type?: Property['type']
  neighborhood?: string
  minBedrooms?: number
  /** Em centavos, como no banco. */
  maxPrice?: number
}

export const PER_PAGE = 9

/** `status = 'inactive'` é o soft delete: nada apagado, só fora do ar. */
const onlyActive = eq(properties.status, 'active')

function buildWhere(filters: PropertyFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [onlyActive]

  if (filters.type) parts.push(eq(properties.type, filters.type))
  if (filters.neighborhood) parts.push(eq(properties.addressNeighborhood, filters.neighborhood))
  if (filters.minBedrooms) parts.push(gte(properties.bedrooms, filters.minBedrooms))
  if (filters.maxPrice) parts.push(lte(properties.price, filters.maxPrice))

  return and(...parts)
}

export async function listActiveProperties(db: Db, limit = 12) {
  return db.select().from(properties).where(onlyActive).orderBy(desc(properties.createdAt)).limit(limit)
}

export async function countActiveProperties(db: Db) {
  const [row] = await db.select({ total: sql<number>`count(*)` }).from(properties).where(onlyActive)
  return row?.total ?? 0
}

export async function findPropertyBySlug(db: Db, slug: string) {
  const [row] = await db
    .select()
    .from(properties)
    .where(and(onlyActive, eq(properties.slug, slug)))
    .limit(1)
  return row ?? null
}

/** Busca paginada da listagem pública. Devolve os itens e o total para a paginação. */
export async function searchProperties(db: Db, filters: PropertyFilters, page = 1) {
  const where = buildWhere(filters)
  const safePage = Math.max(1, page)

  const [items, [counted]] = await Promise.all([
    db
      .select()
      .from(properties)
      .where(where)
      .orderBy(desc(properties.createdAt))
      .limit(PER_PAGE)
      .offset((safePage - 1) * PER_PAGE),
    db.select({ total: sql<number>`count(*)` }).from(properties).where(where),
  ])

  const total = counted?.total ?? 0

  return {
    items,
    total,
    page: safePage,
    perPage: PER_PAGE,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  }
}

/**
 * Bairros que realmente têm imóvel ativo.
 * Preenche o filtro a partir do acervo, em vez de uma lista fixa que envelhece.
 */
export async function listNeighborhoods(db: Db) {
  const rows = await db
    .selectDistinct({ name: properties.addressNeighborhood })
    .from(properties)
    .where(and(onlyActive, isNotNull(properties.addressNeighborhood)))
    .orderBy(properties.addressNeighborhood)

  return rows.map((r) => r.name).filter((n): n is string => Boolean(n))
}

/** Sugestões no fim da página de detalhe: mesmo bairro ou mesmo tipo. */
export async function listRelatedProperties(db: Db, property: Property, limit = 3) {
  return db
    .select()
    .from(properties)
    .where(
      and(
        onlyActive,
        ne(properties.id, property.id),
        or(
          eq(properties.addressNeighborhood, property.addressNeighborhood ?? ''),
          eq(properties.type, property.type),
        ),
      ),
    )
    .orderBy(desc(properties.createdAt))
    .limit(limit)
}

/** Quantos imóveis ativos por tipo, para os cartões de categoria da home. */
export async function countByType(db: Db) {
  const rows = await db
    .select({ type: properties.type, total: sql<number>`count(*)` })
    .from(properties)
    .where(onlyActive)
    .groupBy(properties.type)

  return Object.fromEntries(rows.map((r) => [r.type, r.total])) as Partial<
    Record<Property['type'], number>
  >
}
