import { defineMiddleware } from 'astro:middleware'
import { env } from 'cloudflare:workers'
import { createDb } from './server/db/client'
import { findSessionUser } from './server/db/queries/sessions'
import { SESSION_COOKIE } from './server/services/session'
import type { Papel } from './server/services/permissions'

/**
 * Trechos do painel restritos por papel. Mantidos aqui, e não espalhados pelas
 * páginas, para que a regra de acesso de uma rota não divirja da outra.
 */
const ROTAS_RESTRITAS: { prefixo: string; papeis: Papel[] }[] = [
  { prefixo: '/admin/usuarios', papeis: ['admin'] },
  { prefixo: '/admin/styleguide', papeis: ['admin'] },
]

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

  const restricao = ROTAS_RESTRITAS.find((r) => pathname.startsWith(r.prefixo))
  if (restricao && context.locals.user && !restricao.papeis.includes(context.locals.user.role)) {
    return context.redirect('/admin?sem-permissao=1', 302)
  }

  return next()
})
