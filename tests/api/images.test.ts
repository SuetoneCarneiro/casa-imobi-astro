import { describe, expect, it } from 'vitest'
import {
  buildStorageKey,
  extFromMime,
  imageUrl,
  mimeFromExt,
  variantPath,
  VARIANTS,
} from '../../src/server/services/images'

describe('formatos', () => {
  it.each([
    ['image/webp', 'webp'],
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
  ])('reconhece %s', (mime, ext) => expect(extFromMime(mime)).toBe(ext))

  it('recusa formato não suportado', () => {
    expect(extFromMime('image/gif')).toBeNull()
    expect(extFromMime('')).toBeNull()
  })

  it('volta do ext para o mime', () => {
    expect(mimeFromExt('jpg')).toBe('image/jpeg')
  })
})

describe('chaves no R2', () => {
  it('gera chave dentro do imóvel', () => {
    expect(buildStorageKey(42)).toMatch(/^imoveis\/42\/[a-z0-9]{16}$/)
  })

  it('nunca repete a chave', () => {
    const chaves = new Set(Array.from({ length: 50 }, () => buildStorageKey(1)))
    expect(chaves.size).toBe(50)
  })

  it('monta o caminho de cada variante', () => {
    expect(variantPath('imoveis/8/abc', 'md', 'webp')).toBe('imoveis/8/abc/md.webp')
    expect(variantPath('imoveis/8/abc', 'thumb', 'jpg')).toBe('imoveis/8/abc/thumb.jpg')
  })

  it('tem exatamente três variantes', () => {
    expect(VARIANTS).toEqual(['thumb', 'md', 'full'])
  })
})

describe('imageUrl', () => {
  it('fica fora de /api para a URL ser curta', () => {
    expect(imageUrl('imoveis/8/abc', 'md', 'webp')).toBe('/fotos/imoveis/8/abc/md.webp')
  })

  it('usa md e webp por padrão', () => {
    expect(imageUrl('imoveis/8/abc')).toBe('/fotos/imoveis/8/abc/md.webp')
  })
})
