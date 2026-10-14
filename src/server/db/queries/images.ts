import { and, asc, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { propertyImages, type PropertyImage } from '../schema'

export async function listPropertyImages(db: Db, propertyId: number) {
  return db
    .select()
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, propertyId))
    .orderBy(asc(propertyImages.position), asc(propertyImages.id))
}

export async function findImage(db: Db, id: number) {
  const [row] = await db.select().from(propertyImages).where(eq(propertyImages.id, id)).limit(1)
  return row ?? null
}

/** Capa de vários imóveis de uma vez, para a listagem não fazer N consultas. */
export async function findCovers(db: Db, propertyIds: number[]) {
  if (propertyIds.length === 0) return new Map<number, PropertyImage>()

  const rows = await db
    .select()
    .from(propertyImages)
    .where(
      and(
        eq(propertyImages.isCover, true),
        sql`${propertyImages.propertyId} in ${propertyIds}`,
      ),
    )

  return new Map(rows.map((r) => [r.propertyId, r]))
}

export async function insertImage(
  db: Db,
  values: {
    propertyId: number
    storageKey: string
    format: 'webp' | 'jpg' | 'png'
    width: number
    height: number
    alt?: string | null
  },
) {
  const existentes = await listPropertyImages(db, values.propertyId)

  const [row] = await db
    .insert(propertyImages)
    .values({
      ...values,
      position: existentes.length,
      // A primeira foto do imóvel vira capa sozinha.
      isCover: existentes.length === 0,
    })
    .returning()

  return row!
}

/**
 * Troca a capa. Precisa limpar a antiga ANTES de marcar a nova, senão o índice
 * único parcial rejeita o segundo registro com is_cover = 1.
 */
export async function setCover(db: Db, propertyId: number, imageId: number) {
  await db
    .update(propertyImages)
    .set({ isCover: false })
    .where(and(eq(propertyImages.propertyId, propertyId), ne(propertyImages.id, imageId)))

  await db
    .update(propertyImages)
    .set({ isCover: true })
    .where(and(eq(propertyImages.id, imageId), eq(propertyImages.propertyId, propertyId)))
}

export async function reorderImages(db: Db, propertyId: number, orderedIds: number[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(propertyImages)
        .set({ position: index })
        .where(and(eq(propertyImages.id, id), eq(propertyImages.propertyId, propertyId))),
    ),
  )
}

export async function deleteImage(db: Db, id: number) {
  await db.delete(propertyImages).where(eq(propertyImages.id, id))
}

/** Depois de apagar a capa, promove a primeira foto restante. */
export async function ensureCover(db: Db, propertyId: number) {
  const restantes = await listPropertyImages(db, propertyId)
  if (restantes.length === 0) return
  if (restantes.some((i) => i.isCover)) return
  await setCover(db, propertyId, restantes[0]!.id)
}
