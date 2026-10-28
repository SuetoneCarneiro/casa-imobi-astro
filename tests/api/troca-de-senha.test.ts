import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Troca de senha pela própria pessoa, com a camada de banco trocada por mocks.
 *
 * O hash NÃO é mockado: o que importa aqui é que a senha atual é de fato
 * conferida contra o hash guardado, e um mock esconderia justamente isso.
 */
const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  countOtherActiveAdmins: vi.fn(),
  deleteOtherSessions: vi.fn(),
}))

vi.mock('../../src/server/db/queries/users', () => mocks)
vi.mock('../../src/server/db/queries/sessions', () => mocks)

const { trocarSenhaPropria } = await import('../../src/server/services/users')
const { hashPassword, verifyPassword } = await import('../../src/server/services/password')
const { parseTrocaDeSenha, trocaDeSenhaSchema } = await import('../../src/server/validation/user')

const db = {} as Parameters<typeof trocarSenhaPropria>[0]
const SESSAO = 'sessao-deste-navegador'
let user: { id: number; passwordHash: string }

beforeEach(async () => {
  vi.clearAllMocks()
  user = { id: 7, passwordHash: await hashPassword('senhaAntiga123') }
})

const dados = (atual: string, nova: string) => ({ atual, nova, confirmacao: nova })

describe('trocarSenhaPropria', () => {
  it('grava a nova senha quando a atual confere', async () => {
    const r = await trocarSenhaPropria(db, user, dados('senhaAntiga123', 'senhaNova456'), SESSAO)

    expect(r.ok).toBe(true)
    const [, id, valores] = mocks.updateUser.mock.calls[0]!
    expect(id).toBe(7)
    expect(await verifyPassword('senhaNova456', valores.passwordHash)).toBe(true)
  })

  it('recusa quando a senha atual está errada, sem tocar no banco', async () => {
    const r = await trocarSenhaPropria(db, user, dados('chuteQualquer', 'senhaNova456'), SESSAO)

    expect(r).toEqual({ ok: false, erro: 'A senha atual não confere.', campo: 'atual' })
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(mocks.deleteOtherSessions).not.toHaveBeenCalled()
  })

  it('recusa repetir a senha que já está em uso', async () => {
    const r = await trocarSenhaPropria(db, user, dados('senhaAntiga123', 'senhaAntiga123'), SESSAO)

    expect(r.ok).toBe(false)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  /**
   * Trocar a senha costuma ser reação a suspeita de acesso indevido. Deixar as
   * outras sessões vivas esvaziaria o gesto.
   */
  it('derruba as outras sessões e preserva a deste navegador', async () => {
    await trocarSenhaPropria(db, user, dados('senhaAntiga123', 'senhaNova456'), SESSAO)

    expect(mocks.deleteOtherSessions).toHaveBeenCalledWith(db, 7, SESSAO)
  })
})

describe('trocaDeSenhaSchema', () => {
  it('exige que a confirmação bata com a nova senha', () => {
    const r = trocaDeSenhaSchema.safeParse(
      { atual: 'qualquer', nova: 'senhaNova456', confirmacao: 'senhaNova457' },
    )
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['confirmacao'])
  })

  it.each([
    ['nova senha curta', { atual: 'qualquer', nova: 'curta', confirmacao: 'curta' }],
    ['senha atual em branco', { atual: '', nova: 'senhaNova456', confirmacao: 'senhaNova456' }],
  ])('recusa %s', (_, entrada) => {
    expect(trocaDeSenhaSchema.safeParse(entrada).success).toBe(false)
  })

  it('lê os três campos do formulário', () => {
    const form = new FormData()
    form.set('atual', 'senhaAntiga123')
    form.set('nova', 'senhaNova456')
    form.set('confirmacao', 'senhaNova456')

    expect(parseTrocaDeSenha(form).success).toBe(true)
  })
})
