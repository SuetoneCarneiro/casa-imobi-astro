import { eq, lt } from 'drizzle-orm'
import type { Db } from '../client'
import { sessions, users } from '../schema'

/** Sete dias. Curto o bastante para limitar estrago, longo o bastante para não irritar. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function createSession(db: Db, userId: number) {
  // 32 bytes aleatórios em hex. É o valor que vai no cookie.
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const expiresAt = Date.now() + SESSION_TTL_MS

  await db.insert(sessions).values({ id, userId, expiresAt })
  return { id, expiresAt }
}

/**
 * Resolve o cookie para o usuário. Sessão vencida é apagada na hora, então a
 * tabela se limpa sozinha conforme o uso.
 */
export async function findSessionUser(db: Db, sessionId: string) {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1)

  if (!row) return null

  if (row.session.expiresAt < Date.now()) {
    await deleteSession(db, sessionId)
    return null
  }

  // Usuário desativado perde o acesso mesmo com sessão válida.
  if (!row.user.active) return null

  return row.user
}

export async function deleteSession(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

export async function deleteExpiredSessions(db: Db) {
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()))
}
