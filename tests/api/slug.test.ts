import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from '../../src/server/services/slug'

describe('slugify', () => {
  it('remove acentos', () => {
    expect(slugify('Casa com suíte no Maurício de Nassau')).toBe(
      'casa-com-suite-no-mauricio-de-nassau',
    )
  })

  it('colapsa símbolos e espaços', () => {
    expect(slugify('Terreno 12x30  —  Petrópolis!!')).toBe('terreno-12x30-petropolis')
  })

  it('não deixa hífen nas pontas', () => {
    expect(slugify('  ...Casa...  ')).toBe('casa')
  })

  it('limita o comprimento', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80)
  })
})

describe('uniqueSlug', () => {
  it('usa a raiz quando está livre', async () => {
    expect(await uniqueSlug('Casa no Centro', async () => false)).toBe('casa-no-centro')
  })

  it('acrescenta sufixo quando já existe', async () => {
    const ocupados = new Set(['casa-no-centro', 'casa-no-centro-2'])
    expect(await uniqueSlug('Casa no Centro', async (s) => ocupados.has(s))).toBe(
      'casa-no-centro-3',
    )
  })

  it('tem saída para título sem nenhum caractere útil', async () => {
    expect(await uniqueSlug('!!!', async () => false)).toBe('imovel')
  })
})
