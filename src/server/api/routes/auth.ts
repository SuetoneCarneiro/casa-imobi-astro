import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { ApiEnv } from '../index'
import { createDb } from '../../db/client'
import { findUserByEmail } from '../../db/queries/users'
import { createSession, deleteSession } from '../../db/queries/sessions'
import { verifyPassword } from '../../services/password'
import { SESSION_COOKIE, sessionCookieOptions } from '../../services/session'

export const auth = new Hono<ApiEnv>()

/**
 * Login por formulário HTML, sem JavaScript no cliente.
 * Responde com redirecionamento em vez de JSON justamente por isso.
 */
auth.post('/login', async (c) => {
  const url = new URL(c.req.url)
  const form = await c.req.parseBody()
  const email = String(form.email ?? '').trim()
  const senha = String(form.senha ?? '')
  const destino = String(form.destino ?? '/admin')

  const falhar = () => c.redirect('/login?erro=1', 303)

  if (!email || !senha) return falhar()

  const db = createDb(c.env.DB)
  const user = await findUserByEmail(db, email)

  // Mesmo sem usuário, roda a verificação contra um hash inválido. Assim o
  // tempo de resposta não denuncia se o e-mail existe ou não.
  const hash = user?.passwordHash ?? 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  const senhaConfere = await verifyPassword(senha, hash)

  if (!user || !user.active || !senhaConfere) return falhar()

  const { id } = await createSession(db, user.id)
  setCookie(c, SESSION_COOKIE, id, sessionCookieOptions(url))

  // Só aceita destino interno, para não virar redirecionamento aberto.
  const seguro = destino.startsWith('/') && !destino.startsWith('//') ? destino : '/admin'
  return c.redirect(seguro, 303)
})

auth.post('/logout', async (c) => {
  const url = new URL(c.req.url)
  const sessionId = getCookie(c, SESSION_COOKIE)

  if (sessionId) {
    await deleteSession(createDb(c.env.DB), sessionId)
  }

  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: url.protocol === 'https:' })
  return c.redirect('/login', 303)
})
