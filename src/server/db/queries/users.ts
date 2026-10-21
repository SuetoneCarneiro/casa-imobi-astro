import { and, asc, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '../client'
import { users, type NewUser } from '../schema'

export async function findUserByEmail(db: Db, email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)
  return row ?? null
}

export async function findUserById(db: Db, id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

export async function createUser(db: Db, user: NewUser) {
  const [row] = await db
    .insert(users)
    .values({ ...user, email: user.email.trim().toLowerCase() })
    .returning()
  return row!
}

export async function listUsers(db: Db) {
  return db.select().from(users).orderBy(asc(users.name))
}

export async function updateUser(
  db: Db,
  id: number,
  values: Partial<Pick<NewUser, 'name' | 'email' | 'role' | 'active' | 'passwordHash'>>,
) {
  const [row] = await db
    .update(users)
    .set({ ...values, updatedAt: Date.now() })
    .where(eq(users.id, id))
    .returning()
  return row ?? null
}

/**
 * Quantos administradores ativos existem além deste.
 * Usado para impedir que o sistema fique sem ninguém capaz de gerenciar acessos.
 */
export async function countOtherActiveAdmins(db: Db, exceptId: number) {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.active, true), ne(users.id, exceptId)))
  return row?.total ?? 0
}
