import { defineMiddleware } from 'astro:middleware'
import { env } from 'cloudflare:workers'
import { createDb } from './server/db/client'
import { findSessionUser } from './server/db/queries/sessions'
import { SESSION_COOKIE } from './server/services/session'
import { PAPEIS_QUE_EDITAM_BAIRROS, type Papel } from './server/services/permissions'

/**
 * Trechos do painel restritos por papel. Mantidos aqui, e não espalhados pelas
 * páginas, para que a regra de acesso de uma rota não divirja da outra.
 */
const ROTAS_RESTRITAS: { prefixo: string; papeis: Papel[] }[] = [
  { prefixo: '/admin/usuarios', papeis: ['admin'] },
  { prefixo: '/admin/styleguide', papeis: ['admin'] },
  // Com a barra: `/admin/bairros` (listar e criar) fica aberta, mas
  // `/admin/bairros/<id>` (renomear e remover) não.
  { prefixo: '/admin/bairros/', papeis: PAPEIS_QUE_EDITAM_BAIRROS },
]

/**
 * Cabeçalhos aplicados a TODA resposta que sai do Worker.
 *
 * Ficam aqui, e não no `public/_headers`, porque aquele arquivo só vale para
 * os arquivos estáticos servidos pelo binding de assets. Página renderizada,
 * rota de API e leitura de foto saem do Worker e nunca passariam por ele.
 *
 * - `nosniff` importa principalmente em `/fotos`: sem ele, um arquivo enviado
 *   como imagem mas interpretado como HTML pelo navegador viraria script
 *   rodando no nosso domínio.
 * - `frame-ancestors` é o que impede o painel de ser embutido num site
 *   qualquer e receber cliques que a pessoa pensa estar dando noutro lugar.
 *   O `X-Frame-Options` acompanha para navegador que ainda não lê CSP.
 * - `Referrer-Policy` evita vazar o caminho completo da página do painel para
 *   terceiros ao seguir um link de saída.
 */
const CABECALHOS_DE_SEGURANCA: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
}

/**
 * Guarda do painel.
 *
 * Roda antes de qualquer página. Resolve a sessão SÓ nas rotas que precisam
 * dela: o site público não paga uma consulta ao D1 por visita só para descobrir
 * que ninguém está logado. As rotas de API se defendem sozinhas pelo middleware
 * do Hono, então aqui elas passam direto.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const resposta = await resolver(context, next)

  // Alguns runtimes devolvem resposta com cabeçalhos imutáveis. Nesse caso,
  // refaz a resposta em vez de deixar passar sem proteção.
  try {
    for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) {
      resposta.headers.set(nome, valor)
    }
    return resposta
  } catch {
    const cabecalhos = new Headers(resposta.headers)
    for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) {
      cabecalhos.set(nome, valor)
    }
    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers: cabecalhos,
    })
  }
})

type Contexto = Parameters<Parameters<typeof defineMiddleware>[0]>[0]
type Proximo = Parameters<Parameters<typeof defineMiddleware>[0]>[1]

async function resolver(context: Contexto, next: Proximo): Promise<Response> {
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
}
