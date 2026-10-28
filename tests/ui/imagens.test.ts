import { describe, expect, it } from 'vitest'
import { ehImagemAceita, pareceHeic } from '../../src/lib/imagens'

const arquivo = (name: string, type = '') => ({ name, type })

describe('ehImagemAceita', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])(
    'aceita pelo tipo %s',
    (type) => expect(ehImagemAceita(arquivo('foto.xyz', type))).toBe(true),
  )

  /**
   * O caso que motivou a função: navegador que não conhece HEIC entrega o
   * arquivo sem tipo. Recusar aqui faria a foto sumir sem explicação.
   */
  it.each(['IMG_0042.HEIC', 'foto.heic', 'foto.heif'])(
    'aceita %s mesmo sem tipo declarado',
    (nome) => expect(ehImagemAceita(arquivo(nome))).toBe(true),
  )

  it('aceita extensões comuns sem tipo', () => {
    expect(ehImagemAceita(arquivo('planta.JPG'))).toBe(true)
    expect(ehImagemAceita(arquivo('planta.png'))).toBe(true)
  })

  it('recusa o que não é imagem', () => {
    expect(ehImagemAceita(arquivo('contrato.pdf', 'application/pdf'))).toBe(false)
    expect(ehImagemAceita(arquivo('planilha.xlsx'))).toBe(false)
    expect(ehImagemAceita(arquivo('sem-extensao'))).toBe(false)
  })
})

describe('pareceHeic', () => {
  it.each([
    ['IMG_0042.HEIC', ''],
    ['foto.heif', ''],
    ['foto.sem-extensao', 'image/heic'],
    ['foto.sem-extensao', 'image/heif'],
  ])('reconhece %s (%s)', (nome, tipo) => {
    expect(pareceHeic(arquivo(nome, tipo))).toBe(true)
  })

  // Decide se vale baixar alguns megabytes de decodificador. Falso positivo custa caro.
  it.each([
    ['foto.jpg', 'image/jpeg'],
    ['foto.png', 'image/png'],
    ['arquivo.heico.jpg', 'image/jpeg'],
  ])('não confunde %s', (nome, tipo) => {
    expect(pareceHeic(arquivo(nome, tipo))).toBe(false)
  })
})
