import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const prerender = false

/**
 * Serve as fotos do R2.
 *
 * Fica fora de /api de propósito: é URL que aparece em `src` de imagem e vai
 * para o HTML público, então quanto mais curta melhor. A chave de uma foto
 * nunca é reaproveitada, logo o conteúdo é imutável e pode cachear para sempre.
 */
const CHAVE_VALIDA = /^imoveis\/\d+\/[a-z0-9]+\/(thumb|md|full)\.(webp|jpg|png)$/

export const GET: APIRoute = async ({ params, request }) => {
  const chave = params.path ?? ''

  if (!CHAVE_VALIDA.test(chave)) {
    return new Response('Não encontrado', { status: 404 })
  }

  const objeto = await env.BUCKET.get(chave)
  if (!objeto) return new Response('Não encontrado', { status: 404 })

  // Revalidação barata: se o navegador já tem a versão, devolve 304 sem corpo.
  if (request.headers.get('if-none-match') === objeto.httpEtag) {
    return new Response(null, { status: 304 })
  }

  return new Response(objeto.body, {
    headers: {
      // O tipo vem do que foi gravado, não da extensão da URL.
      'Content-Type': objeto.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: objeto.httpEtag,
    },
  })
}
