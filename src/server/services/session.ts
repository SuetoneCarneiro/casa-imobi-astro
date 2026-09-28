import { SESSION_TTL_MS } from '../db/queries/sessions'

/** Nome do cookie de sessão. Astro e Hono leem daqui para não divergirem. */
export const SESSION_COOKIE = 'casaimobi_sessao'

/**
 * `HttpOnly` tira o cookie do alcance de JavaScript, o que neutraliza roubo de
 * sessão por XSS. `SameSite=Lax` bloqueia o envio em requisições vindas de
 * outros sites, exceto navegação normal. `Secure` só entra em HTTPS, senão o
 * navegador recusaria o cookie no dev em http.
 */
export function sessionCookieOptions(url: URL) {
  return {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  }
}
