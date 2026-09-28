import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { User } from '../../db/schema'
import { createDb } from '../../db/client'
import { findSessionUser } from '../../db/queries/sessions'
import { SESSION_COOKIE } from '../../services/session'
import type { ApiBindings } from '../index'

/**
 * Exige sessão válida. Usado pelas rotas de escrita do painel a partir da Fase 5.
 * Deixa o usuário em `c.var.user` para quem vier depois.
 */
export const requireAuth = createMiddleware<{
  Bindings: ApiBindings
  Variables: { user: User }
}>(async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE)
  if (!sessionId) return c.json({ error: 'Não autenticado' }, 401)

  const user = await findSessionUser(createDb(c.env.DB), sessionId)
  if (!user) return c.json({ error: 'Sessão expirada' }, 401)

  c.set('user', user)
  await next()
})
