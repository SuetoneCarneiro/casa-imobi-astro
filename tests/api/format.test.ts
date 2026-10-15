import { describe, expect, it } from 'vitest'
import { formatArea, formatBRL, publicAddress } from '../../src/lib/format'
import type { Property } from '../../src/server/db/schema'

const imovel = (over: Partial<Property> = {}) =>
  ({
    addressStreet: 'Rua Rádio Clube de Pernambuco',
    addressNumber: '212',
    hideAddressNumber: false,
    addressNeighborhood: 'Maurício de Nassau',
    ...over,
  }) as Property

describe('formatBRL', () => {
  it('converte centavos em reais', () => {
    expect(formatBRL(45000000)).toContain('450.000')
  })

  it('não inventa centavos na exibição', () => {
    expect(formatBRL(38990000)).not.toContain(',')
  })

  it('lida com zero', () => {
    expect(formatBRL(0)).toContain('0')
  })
})

describe('formatArea', () => {
  it('acrescenta a unidade', () => expect(formatArea(180)).toBe('180 m²'))
  it('devolve null quando não há área', () => expect(formatArea(null)).toBeNull())
})

describe('publicAddress', () => {
  it('mostra o número quando permitido', () => {
    expect(publicAddress(imovel())).toBe(
      'Rua Rádio Clube de Pernambuco, 212 — Maurício de Nassau',
    )
  })

  // A regra que protege o cliente: o número fica no banco, some do site.
  it('esconde o número quando hideAddressNumber está ligado', () => {
    const texto = publicAddress(imovel({ hideAddressNumber: true }))
    expect(texto).toBe('Rua Rádio Clube de Pernambuco — Maurício de Nassau')
    expect(texto).not.toContain('212')
  })

  it('não quebra sem rua', () => {
    expect(publicAddress(imovel({ addressStreet: null }))).toBe('Maurício de Nassau')
  })
})
