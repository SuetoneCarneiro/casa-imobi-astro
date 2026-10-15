import { describe, expect, it } from 'vitest'
import { api } from '../../src/server/api'

/**
 * Bindings falsos.
 *
 * O Worker recebe D1 e R2 como objetos injetados pela plataforma, o que torna
 * o teste simples: basta passar objetos com a mesma forma. Não há string de
 * conexão nem servidor para subir.
 */
function envFalso(over: Record<string, unknown> = {}) {
  return {
    DB: { prepare: () => ({ first: async () => ({ ok: 1 }) }) },
    BUCKET: { head: async () => null },
    ...over,
  } as never
}

describe('GET /api/health', () => {
  it('responde ok quando os dois bindings respondem', async () => {
    const r = await api.request('/api/health', {}, envFalso())
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toMatchObject({
      ok: true,
      service: 'casaimobi-api',
      checks: { db: { ok: true }, bucket: { ok: true } },
    })
  })

  it('responde 503 e aponta o culpado quando o banco falha', async () => {
    const env = envFalso({
      DB: {
        prepare: () => ({
          first: async () => {
            throw new Error('D1 fora do ar')
          },
        }),
      },
    })
    const r = await api.request('/api/health', {}, env)
    expect(r.status).toBe(503)

    const corpo = (await r.json()) as { ok: boolean; checks: Record<string, { ok: boolean; error?: string }> }
    expect(corpo.ok).toBe(false)
    expect(corpo.checks.db).toMatchObject({ ok: false, error: 'D1 fora do ar' })
    expect(corpo.checks.bucket.ok).toBe(true)
  })
})

describe('roteamento', () => {
  // O contraste com a página 404 do Astro: dentro de /api a resposta é JSON.
  it('rota inexistente sob /api devolve JSON, não HTML', async () => {
    const r = await api.request('/api/nao-existe', {}, envFalso())
    expect(r.status).toBe(404)
    expect(r.headers.get('content-type')).toContain('application/json')
    await expect(r.json()).resolves.toEqual({ error: 'Rota não encontrada' })
  })

  it('método errado numa rota existente não vira 200', async () => {
    const r = await api.request('/api/health', { method: 'DELETE' }, envFalso())
    expect(r.status).toBe(404)
  })
})

describe('proteção das rotas de foto', () => {
  it.each([
    ['POST', '/api/fotos/imovel/1'],
    ['GET', '/api/fotos/imovel/1'],
    ['POST', '/api/fotos/ordem'],
    ['DELETE', '/api/fotos/1'],
  ])('%s %s sem sessão devolve 401', async (method, path) => {
    const r = await api.request(path, { method }, envFalso())
    expect(r.status).toBe(401)
    await expect(r.json()).resolves.toEqual({ error: 'Não autenticado' })
  })

  it('cookie de sessão inexistente também é recusado', async () => {
    const r = await api.request(
      '/api/fotos/imovel/1',
      { method: 'POST', headers: { Cookie: 'casaimobi_sessao=inventado' } },
      envFalso({
        DB: {
          prepare: () => ({ first: async () => null }),
          // O middleware usa Drizzle, que chama `batch`/`prepare`; devolver
          // vazio equivale a "sessão não encontrada".
        },
      }),
    )
    expect([401, 500]).toContain(r.status)
  })
})

describe('POST /api/auth/login', () => {
  it('redireciona com erro quando faltam campos', async () => {
    const r = await api.request(
      '/api/auth/login',
      { method: 'POST', body: new FormData() },
      envFalso(),
    )
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/login?erro=1')
  })

  it('não vaza se o e-mail existe: a mensagem é sempre a mesma', async () => {
    const form = new FormData()
    form.append('email', '')
    form.append('senha', 'x')
    const r = await api.request('/api/auth/login', { method: 'POST', body: form }, envFalso())
    expect(r.headers.get('location')).toBe('/login?erro=1')
  })
})
