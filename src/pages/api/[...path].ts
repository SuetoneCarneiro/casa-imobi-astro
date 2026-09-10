import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { api } from '../../server/api'

export const prerender = false

// única ligação entre o Astro e a API 
// aberto a extensão: no futuro facilita quando eu quiser transferir a API para um worker separado
export const ALL: APIRoute = (ctx) => api.fetch(ctx.request, env, ctx.locals.cfContext)
