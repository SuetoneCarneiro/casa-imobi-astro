import type { PropertyFilters } from '../server/db/queries/properties'
import { PROPERTY_TYPE_LABELS } from './format'
import type { Property } from '../server/db/schema'

/**
 * Traduz a query string da URL em filtros validados.
 *
 * Tudo que vem da URL é texto de origem desconhecida, então valor inválido é
 * descartado em silêncio em vez de derrubar a página.
 */
export function parseFilters(url: URL): PropertyFilters & { page: number } {
  const p = url.searchParams

  const type = p.get('tipo')
  const bedrooms = Number(p.get('quartos'))
  const maxPrice = Number(p.get('preco_max'))
  const page = Number(p.get('pagina'))

  return {
    type: type && type in PROPERTY_TYPE_LABELS ? (type as Property['type']) : undefined,
    neighborhood: p.get('bairro') || undefined,
    minBedrooms: Number.isFinite(bedrooms) && bedrooms > 0 ? bedrooms : undefined,
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

/** Monta a URL de outra página mantendo os filtros ativos. */
export function pageUrl(url: URL, page: number) {
  const next = new URL(url)
  if (page <= 1) next.searchParams.delete('pagina')
  else next.searchParams.set('pagina', String(page))
  return next.pathname + next.search
}

export function hasAnyFilter(f: PropertyFilters) {
  return Boolean(f.type || f.neighborhood || f.minBedrooms || f.maxPrice)
}
