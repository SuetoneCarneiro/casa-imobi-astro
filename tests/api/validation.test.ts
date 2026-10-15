import { describe, expect, it } from 'vitest'
import {
  parseBRLToCents,
  parsePropertyForm,
  toFieldErrors,
} from '../../src/server/validation/property'

/** Monta um FormData com os campos mínimos válidos. */
function formValido(over: Record<string, string> = {}) {
  const f = new FormData()
  const base = {
    title: 'Casa com 3 quartos no Centro',
    price: '450.000,00',
    type: 'house',
    addressCity: 'Caruaru',
    addressState: 'PE',
    ...over,
  }
  for (const [k, v] of Object.entries(base)) f.append(k, v)
  return f
}

describe('parseBRLToCents', () => {
  it.each([
    ['450.000,00', 45000000],
    ['450000', 45000000],
    ['389.900,00', 38990000],
    ['1.234,56', 123456],
    ['R$ 250.000,00', 25000000],
  ])('converte %s em %i centavos', (entrada, esperado) => {
    expect(parseBRLToCents(entrada)).toBe(esperado)
  })

  it('devolve zero para lixo', () => expect(parseBRLToCents('abc')).toBe(0))
})

describe('parsePropertyForm', () => {
  it('aceita um formulário válido', () => {
    const r = parsePropertyForm(formValido())
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.price).toBe(45000000)
      expect(r.data.type).toBe('house')
      expect(r.data.status).toBe('active')
      expect(r.data.purpose).toBe('sale')
    }
  })

  // Checkbox não marcada simplesmente não chega no FormData.
  it('trata ausência de checkbox como false', () => {
    const r = parsePropertyForm(formValido())
    expect(r.success && r.data.isCondo).toBe(false)
    expect(r.success && r.data.hideAddressNumber).toBe(false)
  })

  it('trata checkbox presente como true', () => {
    const r = parsePropertyForm(formValido({ isCondo: 'on', hideAddressNumber: 'on' }))
    expect(r.success && r.data.isCondo).toBe(true)
    expect(r.success && r.data.hideAddressNumber).toBe(true)
  })

  it('converte área com vírgula e trata vazio como null', () => {
    expect(parsePropertyForm(formValido({ usableArea: '142,5' })).data?.usableArea).toBe(142.5)
    expect(parsePropertyForm(formValido({ usableArea: '' })).data?.usableArea).toBeNull()
  })

  it('normaliza a UF em maiúsculas', () => {
    expect(parsePropertyForm(formValido({ addressState: 'pe' })).data?.addressState).toBe('PE')
  })

  it('recusa título curto, preço zero e tipo ausente', () => {
    const r = parsePropertyForm(formValido({ title: 'Ab', price: '0', type: '' }))
    expect(r.success).toBe(false)
    if (!r.success) {
      const erros = toFieldErrors(r.error)
      expect(erros.title).toMatch(/5 caracteres/)
      expect(erros.price).toMatch(/maior que zero/)
      expect(erros.type).toMatch(/tipo/)
    }
  })

  it('recusa URL de vídeo inválida mas aceita vazia', () => {
    expect(parsePropertyForm(formValido({ videoUrl: 'nao-e-url' })).success).toBe(false)
    expect(parsePropertyForm(formValido({ videoUrl: '' })).success).toBe(true)
  })
})
