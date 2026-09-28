import { defineMiddleware } from 'astro:middleware'
import { env } from 'cloudflare:workers'
import { createDb } from './server/db/client'
import { findSessionUser } from './server/db/queries/sessions'
import { SESSION_COOKIE } from './server/services/session'

/**
 * Guarda do painel.
 *
 * Roda antes de qualquer página. Resolve a sessão SÓ nas rotas que precisam
 * dela: o site público não paga uma consulta ao D1 por visita só para descobrir
 * que ninguém está logado. As rotas de API se defendem sozinhas pelo middleware
 * do Hono, então aqui elas passam direto.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url
  context.locals.user = null

  if (pathname.startsWith('/api/')) return next()

  const precisaSessao = pathname === '/admin' || pathname.startsWith('/admin/')
  const ehLogin = pathname === '/login'

  if (!precisaSessao && !ehLogin) return next()

  const sessionId = context.cookies.get(SESSION_COOKIE)?.value
  if (sessionId) {
    context.locals.user = await findSessionUser(createDb(env.DB), sessionId)
  }

  if (precisaSessao && !context.locals.user) {
    return context.redirect(`/login?destino=${encodeURIComponent(pathname)}`, 302)
  }

  if (ehLogin && context.locals.user) {
    return context.redirect('/admin', 302)
  }

  return next()
})
