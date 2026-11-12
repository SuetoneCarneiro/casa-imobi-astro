import type { APIRoute } from 'astro'
import { site } from '../lib/site'

export const prerender = false

/**
 * Enquanto o site mora num endereço provisório, fecha tudo.
 *
 * Deixar um `.workers.dev` ser indexado criaria uma cópia disputando resultado
 * de busca com o site que a imobiliária já tem no ar, e depois daria trabalho
 * para desfazer. Com o domínio definitivo em `site.url`, abre e aponta o
 * sitemap.
 */
export const GET: APIRoute = () => {
  const corpo = site.url
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /login',
        '',
        `Sitemap: ${site.url}/sitemap.xml`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n')

  return new Response(corpo, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
