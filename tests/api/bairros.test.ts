import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regras dos bairros, com a camada de banco trocada por mocks.
 *
 * O que importa aqui é a decisão: o que conta como nome repetido e quando a
 * remoção é recusada. O acesso ao D1 é responsabilidade das consultas.
 */
const mocks = vi.hoisted(() => ({
  listNeighborhoods: vi.fn(),
  insertNeighborhood: vi.fn(),
  updateNeighborhoodRow: vi.fn(),
  deleteNeighborhood: vi.fn(),
  findNeighborhoodById: vi.fn(),
  countPropertiesInNeighborhood: vi.fn(),
}))

// Só o acesso ao banco é dublado. `chaveDoNome` é lógica pura e é justamente a
// regra sob teste, então entra a de verdade.
vi.mock('../../src/server/db/queries/neighborhoods', async (importar) => {
  const original =
    await importar<typeof import('../../src/server/db/queries/neighborhoods')>()
  return { ...mocks, chaveDoNome: original.chaveDoNome }
})

const { criarBairro, editarBairro, removerBairro } = await import(
  '../../src/server/services/neighborhoods'
)
const { chaveDoNome } = await import('../../src/server/db/queries/neighborhoods')
const { bairroSchema } = await import('../../src/server/validation/neighborhood')
const { destinoSeguro } = await import('../../src/lib/retorno')

const db = {} as never
const bairro = (id: number, name: string) => ({ id, name, createdAt: 0, updatedAt: 0 })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listNeighborhoods.mockResolvedValue([
    bairro(1, 'Maurício de Nassau'),
    bairro(2, 'Centro'),
  ])
  mocks.insertNeighborhood.mockImplementation(async (_db: unknown, name: string) =>
    bairro(99, name),
  )
  mocks.updateNeighborhoodRow.mockImplementation(async (_db: unknown, id: number, name: string) =>
    bairro(id, name),
  )
})

describe('chaveDoNome', () => {
  /**
   * O caso que motivou a função: sem isso, "Mauricio de Nassau" entraria como
   * um segundo bairro para o mesmo lugar e racharia o filtro público ao meio.
   */
  it.each([
    ['Maurício de Nassau', 'mauricio de nassau'],
    ['MAURÍCIO DE NASSAU', 'Maurício de Nassau'],
    ['  Centro  ', 'centro'],
    ['Indianópolis', 'INDIANOPOLIS'],
  ])('trata %s e %s como o mesmo bairro', (a, b) => {
    expect(chaveDoNome(a)).toBe(chaveDoNome(b))
  })

  it('não confunde bairros de verdade diferentes', () => {
    expect(chaveDoNome('Centro')).not.toBe(chaveDoNome('Centro Novo'))
  })
})

describe('criarBairro', () => {
  it('cria quando o nome é novo', async () => {
    const r = await criarBairro(db, 'Boa Vista')
    expect(r).toMatchObject({ ok: true })
    expect(mocks.insertNeighborhood).toHaveBeenCalledWith(db, 'Boa Vista')
  })

  it.each(['mauricio de nassau', 'MAURÍCIO DE NASSAU', 'Mauricio de Nassau'])(
    'recusa %s por já existir escrito de outro jeito',
    async (nome) => {
      const r = await criarBairro(db, nome)
      expect(r).toEqual({ ok: false, erro: 'Já existe o bairro "Maurício de Nassau".' })
      expect(mocks.insertNeighborhood).not.toHaveBeenCalled()
    },
  )
})

describe('editarBairro', () => {
  it('deixa salvar o mesmo nome do próprio bairro', async () => {
    const r = await editarBairro(db, 1, 'Maurício de Nassau')
    expect(r).toMatchObject({ ok: true })
  })

  it('recusa assumir o nome de outro bairro', async () => {
    const r = await editarBairro(db, 1, 'centro')
    expect(r).toEqual({ ok: false, erro: 'Já existe o bairro "Centro".' })
    expect(mocks.updateNeighborhoodRow).not.toHaveBeenCalled()
  })
})

describe('removerBairro', () => {
  /**
   * A chave estrangeira já recusaria com `restrict`, mas o erro do banco não
   * diz nada a quem está na tela. Esta checagem existe pela mensagem.
   */
  it.each([
    [1, '1 imóvel usa este bairro. Troque o bairro deles antes de remover.'],
    [4, '4 imóveis usam este bairro. Troque o bairro deles antes de remover.'],
  ])('recusa remover bairro com %i imóvel(is)', async (total, mensagem) => {
    mocks.findNeighborhoodById.mockResolvedValue(bairro(1, 'Centro'))
    mocks.countPropertiesInNeighborhood.mockResolvedValue(total)

    expect(await removerBairro(db, 1)).toEqual({ ok: false, erro: mensagem })
    expect(mocks.deleteNeighborhood).not.toHaveBeenCalled()
  })

  it('remove quando ninguém usa', async () => {
    mocks.findNeighborhoodById.mockResolvedValue(bairro(1, 'Centro'))
    mocks.countPropertiesInNeighborhood.mockResolvedValue(0)

    expect(await removerBairro(db, 1)).toEqual({ ok: true })
    expect(mocks.deleteNeighborhood).toHaveBeenCalledWith(db, 1)
  })

  it('não quebra se o bairro não existe', async () => {
    mocks.findNeighborhoodById.mockResolvedValue(null)
    expect(await removerBairro(db, 404)).toEqual({ ok: false, erro: 'Bairro não encontrado.' })
  })
})

describe('bairroSchema', () => {
  it('apara espaços em volta', () => {
    const r = bairroSchema.safeParse({ name: '  Centro  ' })
    expect(r.success && r.data.name).toBe('Centro')
  })

  it.each(['', ' ', 'A'])('recusa %o por ser curto demais', (nome) => {
    expect(bairroSchema.safeParse({ name: nome }).success).toBe(false)
  })
})

describe('destinoSeguro', () => {
  it('aceita caminho interno do painel', () => {
    expect(destinoSeguro('/admin/imoveis/novo')).toBe('/admin/imoveis/novo')
    expect(destinoSeguro('/admin/imoveis/12')).toBe('/admin/imoveis/12')
  })

  /**
   * Sem isto, um link do painel terminando em outro site teria a confiança do
   * domínio certo na barra de endereço.
   */
  it.each([
    'https://site-falso.com',
    '//site-falso.com',
    '/login',
    '/',
    'admin/imoveis/novo',
    '',
    null,
  ])('recusa %o', (bruto) => {
    expect(destinoSeguro(bruto)).toBeNull()
  })
})
