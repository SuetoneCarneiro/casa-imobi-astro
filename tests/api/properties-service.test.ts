import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regras de cadastro, com a camada de banco trocada por mocks.
 *
 * O que importa aqui é a orquestração: de onde vem o código, de onde vem o
 * slug, e o que acontece ao editar. O acesso ao D1 em si é responsabilidade
 * das consultas, não deste serviço.
 */
const mocks = vi.hoisted(() => ({
  nextPropertyCode: vi.fn(),
  slugExists: vi.fn(),
  insertProperty: vi.fn(),
  updatePropertyRow: vi.fn(),
}))

vi.mock('../../src/server/db/queries/properties', () => mocks)

const { createProperty, updateProperty } = await import('../../src/server/services/properties')

const entrada = {
  title: 'Casa com suíte no Maurício de Nassau',
  price: 45000000,
  purpose: 'sale',
  type: 'house',
  category: 'residential',
  status: 'active',
  isCondo: false,
  bedrooms: 3,
  suites: 1,
  bathrooms: 2,
  parkingSpaces: 2,
  usableArea: 180,
  hideAddressNumber: false,
  addressCity: 'Caruaru',
  addressState: 'PE',
} as Parameters<typeof createProperty>[1]

const db = {} as Parameters<typeof createProperty>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.nextPropertyCode.mockResolvedValue('CI-0009')
  mocks.slugExists.mockResolvedValue(false)
  mocks.insertProperty.mockImplementation(async (_db, values) => ({ id: 1, ...values }))
  mocks.updatePropertyRow.mockImplementation(async (_db, id, values) => ({ id, ...values }))
})

describe('createProperty', () => {
  it('gera código e slug sozinho', async () => {
    const criado = await createProperty(db, entrada, 7)
    expect(criado.code).toBe('CI-0009')
    expect(criado.slug).toBe('casa-com-suite-no-mauricio-de-nassau')
  })

  it('registra quem cadastrou', async () => {
    const criado = await createProperty(db, entrada, 7)
    expect(criado.createdBy).toBe(7)
  })

  it('desvia o slug quando já existe', async () => {
    mocks.slugExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const criado = await createProperty(db, entrada, 7)
    expect(criado.slug).toBe('casa-com-suite-no-mauricio-de-nassau-2')
  })

  it('converte campo opcional vazio em null', async () => {
    const criado = await createProperty(db, { ...entrada, videoUrl: '' }, 7)
    expect(criado.videoUrl).toBeNull()
    expect(criado.description).toBeNull()
  })
})

describe('updateProperty', () => {
  /**
   * A regra que protege links já compartilhados: o slug foi para o WhatsApp e
   * para o Google. Mudar o título não pode quebrar endereço em uso.
   */
  it('NÃO regera o slug ao editar o título', async () => {
    await updateProperty(db, 42, { ...entrada, title: 'Outro título completamente diferente' })

    const [, id, values] = mocks.updatePropertyRow.mock.calls[0]!
    expect(id).toBe(42)
    expect(values).not.toHaveProperty('slug')
    expect(values.title).toBe('Outro título completamente diferente')
  })

  it('também não mexe no código', async () => {
    await updateProperty(db, 42, entrada)
    expect(mocks.updatePropertyRow.mock.calls[0]![2]).not.toHaveProperty('code')
    expect(mocks.nextPropertyCode).not.toHaveBeenCalled()
  })
})
