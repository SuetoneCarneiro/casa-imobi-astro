import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { ApiEnv } from '../index'
import { createDb } from '../../db/client'
import { findUserByEmail } from '../../db/queries/users'
import { createSession, deleteExpiredSessions, deleteSession } from '../../db/queries/sessions'
import { verifyPassword } from '../../services/password'
import { SESSION_COOKIE, sessionCookieOptions } from '../../services/session'
import { destinoSeguro } from '../../../lib/retorno'

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

  // Mesma checagem da página de bairros, para as duas não divergirem.
  return c.redirect(destinoSeguro(destino) ?? '/admin', 303)
})

auth.post('/logout', async (c) => {
  const url = new URL(c.req.url)
  const sessionId = getCookie(c, SESSION_COOKIE)
  const db = createDb(c.env.DB)

  if (sessionId) {
    await deleteSession(db, sessionId)
  }

  /*
   * Aproveita a saída para varrer as sessões vencidas.
   *
   * `findSessionUser` já apaga a sessão vencida que alguém tenta reusar, mas a
   * abandonada ninguém toca de novo e ela fica. Um Cron Trigger seria o lugar
   * natural, só que o adapter do Astro não expõe o handler `scheduled`, e nesta
   * escala a tabela cresce algumas centenas de linhas por ano.
   *
   * Vai na saída, e não na entrada, de propósito: o login já gasta quase todo o
   * orçamento de CPU com o PBKDF2, e aqui não há cálculo nenhum disputando.
   * `waitUntil` deixa a limpeza acontecer depois da resposta ir embora.
   */
  try {
    c.executionCtx.waitUntil(deleteExpiredSessions(db))
  } catch {
    // Fora do Worker não há ExecutionContext. A limpeza é oportunista, então
    // não sair do lugar aqui é melhor que falhar a saída de alguém.
  }

  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: url.protocol === 'https:' })
  return c.redirect('/login', 303)
})
