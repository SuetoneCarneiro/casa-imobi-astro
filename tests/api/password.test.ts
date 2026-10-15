import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/server/services/password'

describe('hashPassword', () => {
  it('grava no formato pbkdf2$iteracoes$salt$hash', async () => {
    const hash = await hashPassword('senhaSegura123')
    const partes = hash.split('$')
    expect(partes).toHaveLength(4)
    expect(partes[0]).toBe('pbkdf2')
    expect(Number(partes[1])).toBeGreaterThanOrEqual(100_000)
  })

  // Salt aleatório: duas pessoas com a mesma senha têm hashes diferentes.
  it('gera hashes diferentes para a mesma senha', async () => {
    const [a, b] = await Promise.all([hashPassword('igual'), hashPassword('igual')])
    expect(a).not.toBe(b)
  })
})

describe('verifyPassword', () => {
  it('aceita a senha correta', async () => {
    const hash = await hashPassword('senhaSegura123')
    expect(await verifyPassword('senhaSegura123', hash)).toBe(true)
  })

  it('recusa a senha errada', async () => {
    const hash = await hashPassword('senhaSegura123')
    expect(await verifyPassword('senhaSegura124', hash)).toBe(false)
  })

  // O seed grava '!' de propósito: usuário semeado não entra até ter senha real.
  it('recusa o hash inutilizável do seed', async () => {
    expect(await verifyPassword('qualquer', '!')).toBe(false)
  })

  it.each(['', 'pbkdf2$100000$abc', 'md5$1$a$b', 'pbkdf2$10$a$b'])(
    'recusa hash malformado: %s',
    async (hash) => {
      expect(await verifyPassword('qualquer', hash)).toBe(false)
    },
  )
})
