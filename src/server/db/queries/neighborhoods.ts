import { asc, eq, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { neighborhoods, properties } from '../schema'

/**
 * Consultas dos bairros.
 *
 * A lista é curta por natureza, algumas dezenas numa cidade do porte de
 * Caruaru, então pode ser carregada inteira sem paginação.
 */

/**
 * Chave de comparação para detectar nome repetido.
 *
 * O índice único do banco só pega repetição idêntica, e não resolve o caso
 * real: alguém cadastra "Maurício de Nassau" e depois "mauricio de nassau",
 * que viram dois bairros para o mesmo lugar e rachem o filtro público ao meio.
 * Comparar sem acento e sem caixa é o que junta os dois. `lower()` do SQLite
 * não serve porque ignora letra acentuada, então a conta é feita aqui.
 */
export function chaveDoNome(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

export async function listNeighborhoods(db: Db) {
  return db.select().from(neighborhoods).orderBy(asc(neighborhoods.name))
}

/** Com a contagem de imóveis, para a tela de gestão avisar o que está em uso. */
export async function listNeighborhoodsComUso(db: Db) {
  return db
    .select({
      id: neighborhoods.id,
      name: neighborhoods.name,
      imoveis: sql<number>`count(${properties.id})`,
    })
    .from(neighborhoods)
    .leftJoin(properties, eq(properties.neighborhoodId, neighborhoods.id))
    .groupBy(neighborhoods.id)
    .orderBy(asc(neighborhoods.name))
}

export async function findNeighborhoodById(db: Db, id: number) {
  const [row] = await db.select().from(neighborhoods).where(eq(neighborhoods.id, id)).limit(1)
  return row ?? null
}

export async function insertNeighborhood(db: Db, name: string) {
  const [row] = await db.insert(neighborhoods).values({ name }).returning()
  return row!
}

export async function updateNeighborhoodRow(db: Db, id: number, name: string) {
  const [row] = await db
    .update(neighborhoods)
    .set({ name, updatedAt: Date.now() })
    .where(eq(neighborhoods.id, id))
    .returning()
  return row ?? null
}

export async function deleteNeighborhood(db: Db, id: number) {
  await db.delete(neighborhoods).where(eq(neighborhoods.id, id))
}

export async function countPropertiesInNeighborhood(db: Db, id: number) {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(properties)
    .where(eq(properties.neighborhoodId, id))
  return row?.total ?? 0
}
