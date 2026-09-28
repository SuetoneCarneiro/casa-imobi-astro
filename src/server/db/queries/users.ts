import { eq } from 'drizzle-orm'
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
