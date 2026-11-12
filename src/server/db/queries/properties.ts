import { and, asc, desc, eq, getTableColumns, gte, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../client'
import { neighborhoods, properties, type NewProperty, type Property } from '../schema'

/**
 * Imóvel com o nome do bairro já resolvido.
 *
 * O bairro mora em outra tabela, mas quem exibe um imóvel quase sempre precisa
 * do nome. Em vez de cada página fazer o próprio join e correr o risco de
 * esquecer, toda consulta de leitura devolve esta forma.
 */
export type PropertyComBairro = Property & { neighborhood: string | null }

const colunasComBairro = {
  ...getTableColumns(properties),
  neighborhood: neighborhoods.name,
}

/** `leftJoin`: imóvel sem bairro continua aparecendo, com o nome nulo. */
function selecionarComBairro(db: Db) {
  return db
    .select(colunasComBairro)
    .from(properties)
    .leftJoin(neighborhoods, eq(neighborhoods.id, properties.neighborhoodId))
}

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
  // O filtro público viaja pela URL como nome (`?bairro=Centro`), que é legível
  // e compartilhável, então a comparação é pelo nome e não pelo id.
  if (filters.neighborhood) parts.push(eq(neighborhoods.name, filters.neighborhood))
  if (filters.minBedrooms) parts.push(gte(properties.bedrooms, filters.minBedrooms))
  if (filters.maxPrice) parts.push(lte(properties.price, filters.maxPrice))

  return and(...parts)
}

export async function listActiveProperties(db: Db, limit = 12) {
  return selecionarComBairro(db)
    .where(onlyActive)
    .orderBy(desc(properties.createdAt))
    .limit(limit)
}

export async function countActiveProperties(db: Db) {
  const [row] = await db.select({ total: sql<number>`count(*)` }).from(properties).where(onlyActive)
  return row?.total ?? 0
}

export async function findPropertyBySlug(db: Db, slug: string) {
  const [row] = await selecionarComBairro(db)
    .where(and(onlyActive, eq(properties.slug, slug)))
    .limit(1)
  return row ?? null
}

/** Busca paginada da listagem pública. Devolve os itens e o total para a paginação. */
export async function searchProperties(db: Db, filters: PropertyFilters, page = 1) {
  const where = buildWhere(filters)
  const safePage = Math.max(1, page)

  // A contagem repete o join porque o filtro de bairro depende dele.
  const [items, [counted]] = await Promise.all([
    selecionarComBairro(db)
      .where(where)
      .orderBy(desc(properties.createdAt))
      .limit(PER_PAGE)
      .offset((safePage - 1) * PER_PAGE),
    db
      .select({ total: sql<number>`count(*)` })
      .from(properties)
      .leftJoin(neighborhoods, eq(neighborhoods.id, properties.neighborhoodId))
      .where(where),
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
 *
 * O filtro público mostra só estes, e não a lista inteira do painel: oferecer
 * um bairro que não devolveria resultado nenhum só frustra quem busca.
 */
export async function listNeighborhoodsComImovel(db: Db) {
  const rows = await db
    .selectDistinct({ name: neighborhoods.name })
    .from(neighborhoods)
    .innerJoin(properties, eq(properties.neighborhoodId, neighborhoods.id))
    .where(onlyActive)
    .orderBy(asc(neighborhoods.name))

  return rows.map((r) => r.name)
}

/** Sugestões no fim da página de detalhe: mesmo bairro ou mesmo tipo. */
export async function listRelatedProperties(db: Db, property: Property, limit = 3) {
  return selecionarComBairro(db)
    .where(
      and(
        onlyActive,
        ne(properties.id, property.id),
        or(
          property.neighborhoodId
            ? eq(properties.neighborhoodId, property.neighborhoodId)
            : undefined,
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

// ---------------------------------------------------------------- painel

/** O painel enxerga inativos também: soft delete não some da gestão. */
export async function findPropertyById(db: Db, id: number) {
  const [row] = await selecionarComBairro(db).where(eq(properties.id, id)).limit(1)
  return row ?? null
}

export async function slugExists(db: Db, slug: string, exceptId?: number) {
  const where = exceptId
    ? and(eq(properties.slug, slug), ne(properties.id, exceptId))
    : eq(properties.slug, slug)
  const [row] = await db.select({ id: properties.id }).from(properties).where(where).limit(1)
  return Boolean(row)
}

/** Próximo código sequencial no formato CI-0001. */
export async function nextPropertyCode(db: Db) {
  const [row] = await db
    .select({ maior: sql<string | null>`max(${properties.code})` })
    .from(properties)
  const atual = row?.maior?.match(/^CI-(\d+)$/)?.[1]
  const proximo = atual ? Number(atual) + 1 : 1
  return `CI-${String(proximo).padStart(4, '0')}`
}

export async function insertProperty(db: Db, values: NewProperty) {
  const [row] = await db.insert(properties).values(values).returning()
  return row!
}

export async function updatePropertyRow(
  db: Db,
  id: number,
  values: Partial<NewProperty>,
) {
  const [row] = await db
    .update(properties)
    .set({ ...values, updatedAt: Date.now() })
    .where(eq(properties.id, id))
    .returning()
  return row ?? null
}

export async function setPropertyStatus(db: Db, id: number, status: Property['status']) {
  return updatePropertyRow(db, id, { status })
}

export const ADMIN_PER_PAGE = 15

/** Listagem do painel: busca por título ou código, filtro por situação. */
export async function searchAdminProperties(
  db: Db,
  options: {
    q?: string
    status?: Property['status']
    page?: number
    /** Corretor enxerga apenas o que cadastrou. */
    createdBy?: number
  } = {},
) {
  const { q, status, createdBy } = options
  const page = Math.max(1, options.page ?? 1)

  const partes: (SQL | undefined)[] = []
  if (createdBy) partes.push(eq(properties.createdBy, createdBy))
  if (status) partes.push(eq(properties.status, status))
  if (q) {
    const termo = `%${q.trim().toLowerCase()}%`
    partes.push(
      or(
        sql`lower(${properties.title}) like ${termo}`,
        sql`lower(${properties.code}) like ${termo}`,
        sql`lower(coalesce(${neighborhoods.name}, '')) like ${termo}`,
      ),
    )
  }
  const where = partes.length ? and(...partes) : undefined

  const [items, [counted]] = await Promise.all([
    selecionarComBairro(db)
      .where(where)
      .orderBy(desc(properties.updatedAt))
      .limit(ADMIN_PER_PAGE)
      .offset((page - 1) * ADMIN_PER_PAGE),
    db
      .select({ total: sql<number>`count(*)` })
      .from(properties)
      .leftJoin(neighborhoods, eq(neighborhoods.id, properties.neighborhoodId))
      .where(where),
  ])

  const total = counted?.total ?? 0
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)) }
}
