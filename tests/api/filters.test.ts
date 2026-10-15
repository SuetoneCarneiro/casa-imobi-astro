import { describe, expect, it } from 'vitest'
import { hasAnyFilter, pageUrl, parseFilters } from '../../src/lib/filters'

const url = (qs: string) => new URL(`https://casaimobi.com.br/imoveis${qs}`)

describe('parseFilters', () => {
  it('lê os filtros válidos', () => {
    const f = parseFilters(url('?tipo=house&bairro=Centro&quartos=3&preco_max=50000000&pagina=2'))
    expect(f).toMatchObject({
      type: 'house',
      neighborhood: 'Centro',
      minBedrooms: 3,
      maxPrice: 50000000,
      page: 2,
    })
  })

  // Tudo que vem da URL é texto de origem desconhecida: inválido é descartado,
  // não derruba a página.
  it.each([
    ['?tipo=foguete', 'type'],
    ['?quartos=abc', 'minBedrooms'],
    ['?quartos=-5', 'minBedrooms'],
    ['?preco_max=0', 'maxPrice'],
  ])('descarta valor inválido em %s', (qs, campo) => {
    expect(parseFilters(url(qs))[campo as 'type']).toBeUndefined()
  })

  it('cai na página 1 quando a paginação é inválida', () => {
    expect(parseFilters(url('?pagina=0')).page).toBe(1)
    expect(parseFilters(url('?pagina=abc')).page).toBe(1)
  })
})

describe('pageUrl', () => {
  it('preserva os filtros ao trocar de página', () => {
    expect(pageUrl(url('?tipo=house&bairro=Centro'), 3)).toBe(
      '/imoveis?tipo=house&bairro=Centro&pagina=3',
    )
  })

  it('omite o parâmetro na primeira página', () => {
    expect(pageUrl(url('?tipo=house&pagina=4'), 1)).toBe('/imoveis?tipo=house')
  })
})

describe('hasAnyFilter', () => {
  it('distingue listagem filtrada de listagem cheia', () => {
    expect(hasAnyFilter(parseFilters(url('')))).toBe(false)
    expect(hasAnyFilter(parseFilters(url('?bairro=Centro')))).toBe(true)
  })
})
