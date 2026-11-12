import { env } from 'cloudflare:workers'
import type { APIRoute } from 'astro'
import { createDb } from '../server/db/client'
import { listSlugsForSitemap } from '../server/db/queries/properties'
import { site } from '../lib/site'

export const prerender = false

/** Páginas fixas. O painel e o login ficam de fora por não serem públicos. */
const ESTATICAS = ['/', '/imoveis', '/sobre', '/anuncie', '/contato']

const escapar = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Gerado a cada requisição, e não no build.
 *
 * O acervo muda pelo painel, sem novo deploy. Um sitemap congelado no build
 * mandaria o Google a imóveis que já saíram do ar e esconderia os novos.
 */
export const GET: APIRoute = async ({ request }) => {
  const base = site.url ?? new URL(request.url).origin
  const imoveis = await listSlugsForSitemap(createDb(env.DB))

  const urls = [
    ...ESTATICAS.map((caminho) => ({ loc: new URL(caminho, base).href, lastmod: null })),
    ...imoveis.map((i) => ({
      loc: new URL(`/imoveis/${i.slug}`, base).href,
      lastmod: new Date(i.updatedAt).toISOString().slice(0, 10),
    })),
  ]

  const corpo = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${escapar(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`

  return new Response(corpo, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Curto: o acervo muda pelo painel e o sitemap precisa acompanhar.
      'Cache-Control': 'public, max-age=600',
    },
  })
}
