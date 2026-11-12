import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { beforeAll, describe, expect, it } from 'vitest'
import Badge from '../../src/components/ui/Badge.astro'
import Button from '../../src/components/ui/Button.astro'
import EmptyState from '../../src/components/site/EmptyState.astro'
import Pagination from '../../src/components/site/Pagination.astro'
import PropertyCard from '../../src/components/site/PropertyCard.astro'
import PropertyGallery from '../../src/components/site/PropertyGallery.astro'
import type { PropertyImage } from '../../src/server/db/schema'
import type { PropertyComBairro } from '../../src/server/db/queries/properties'

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

/** Isola a lista de características, para asserções não casarem com o título. */
function caracteristicas(html: string) {
  return html.match(/<ul[^>]*>[\s\S]*?<\/ul>/)?.[0] ?? ''
}

function imovel(over: Partial<PropertyComBairro> = {}): PropertyComBairro {
  return {
    id: 1,
    code: 'CI-0001',
    title: 'Casa com 3 quartos e suíte',
    slug: 'casa-com-3-quartos-e-suite',
    description: null,
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
    addressStreet: 'Rua A',
    addressNumber: '10',
    hideAddressNumber: false,
    neighborhood: 'Centro',
    addressCity: 'Caruaru',
    addressState: 'PE',
    addressZip: null,
    development: null,
    videoUrl: null,
    createdBy: 1,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as PropertyComBairro
}

describe('Button', () => {
  // Evita o erro clássico de estilizar link como botão e perder a navegação.
  it('vira <a> quando recebe href', async () => {
    const html = await container.renderToString(Button, {
      props: { href: '/imoveis' },
      slots: { default: 'Ver imóveis' },
    })
    expect(html).toContain('<a')
    expect(html).toContain('href="/imoveis"')
    expect(html).not.toContain('<button')
  })

  it('vira <button> quando não recebe href', async () => {
    const html = await container.renderToString(Button, { slots: { default: 'Enviar' } })
    expect(html).toContain('<button')
    expect(html).toContain('type="button"')
  })

  it('aplica a variante pedida', async () => {
    const html = await container.renderToString(Button, {
      props: { variant: 'whatsapp' },
      slots: { default: 'Falar' },
    })
    expect(html).toContain('bg-whatsapp')
  })
})

describe('Badge', () => {
  it('mostra o conteúdo do slot', async () => {
    const html = await container.renderToString(Badge, { slots: { default: 'Condomínio' } })
    expect(html).toContain('Condomínio')
  })
})

describe('PropertyCard', () => {
  it('mostra preço formatado, código e bairro', async () => {
    const html = await container.renderToString(PropertyCard, { props: { property: imovel() } })
    expect(html).toContain('450.000')
    expect(html).toContain('CI-0001')
    expect(html).toContain('Centro')
  })

  it('lista só as características maiores que zero', async () => {
    const html = await container.renderToString(PropertyCard, {
      props: { property: imovel({ bedrooms: 0, bathrooms: 2, parkingSpaces: 0 }) },
    })
    const lista = caracteristicas(html)
    expect(lista).toContain('banheiros')
    expect(lista).not.toContain('quartos')
    expect(lista).not.toContain('vagas')
  })

  it('usa singular quando a contagem é 1', async () => {
    const html = await container.renderToString(PropertyCard, {
      props: { property: imovel({ bedrooms: 1, bathrooms: 1, parkingSpaces: 1 }) },
    })
    const lista = caracteristicas(html)
    expect(lista).toContain('>quarto<')
    expect(lista).toContain('>banheiro<')
    expect(lista).toContain('>vaga<')
  })

  // Estado real de todo imóvel recém-cadastrado, não um erro.
  it('mostra "Sem foto" quando não há capa', async () => {
    const html = await container.renderToString(PropertyCard, { props: { property: imovel() } })
    expect(html).toContain('Sem foto')
    expect(html).not.toContain('<img src="/fotos/')
  })

  it('usa a capa quando existe', async () => {
    const html = await container.renderToString(PropertyCard, {
      props: { property: imovel(), coverUrl: '/fotos/imoveis/1/abc/thumb.webp' },
    })
    expect(html).toContain('/fotos/imoveis/1/abc/thumb.webp')
    expect(html).not.toContain('Sem foto')
  })

  it('marca condomínio', async () => {
    const html = await container.renderToString(PropertyCard, {
      props: { property: imovel({ isCondo: true }) },
    })
    expect(html).toContain('Condomínio')
  })

  it('aponta para a página pública do imóvel', async () => {
    const html = await container.renderToString(PropertyCard, { props: { property: imovel() } })
    expect(html).toContain('href="/imoveis/casa-com-3-quartos-e-suite"')
  })
})

describe('EmptyState', () => {
  it('mostra título e descrição', async () => {
    const html = await container.renderToString(EmptyState, {
      props: { title: 'Nenhum imóvel', description: 'Tente ampliar a busca.' },
    })
    expect(html).toContain('Nenhum imóvel')
    expect(html).toContain('Tente ampliar a busca.')
  })
})

describe('Pagination', () => {
  const url = new URL('https://casaimobi.com.br/imoveis?tipo=house')

  it('não aparece com uma página só', async () => {
    const html = await container.renderToString(Pagination, {
      props: { url, page: 1, totalPages: 1 },
    })
    expect(html).not.toContain('<nav')
  })

  it('preserva os filtros nos links', async () => {
    const html = await container.renderToString(Pagination, {
      props: { url, page: 2, totalPages: 5 },
    })
    expect(html).toContain('tipo=house')
    expect(html).toContain('pagina=3')
  })

  it('marca a página atual para leitor de tela', async () => {
    const html = await container.renderToString(Pagination, {
      props: { url, page: 2, totalPages: 5 },
    })
    expect(html).toContain('aria-current="page"')
  })

  it('esconde "Anterior" na primeira página', async () => {
    const html = await container.renderToString(Pagination, {
      props: { url, page: 1, totalPages: 5 },
    })
    expect(html).not.toContain('Anterior')
    expect(html).toContain('Próxima')
  })
})

describe('PropertyGallery', () => {
  function foto(over: Partial<PropertyImage> = {}): PropertyImage {
    return {
      id: 1,
      propertyId: 1,
      storageKey: 'imoveis/1/abc',
      format: 'webp',
      alt: null,
      position: 0,
      isCover: true,
      width: 1024,
      height: 768,
      createdAt: 0,
      ...over,
    }
  }

  const renderizar = (imagens: PropertyImage[]) =>
    container.renderToString(PropertyGallery, { props: { images: imagens, property: imovel() } })

  /** Sem JavaScript o link precisa levar à foto grande por conta própria. */
  it('aponta cada foto para a variante de 1920px', async () => {
    const html = await renderizar([foto(), foto({ id: 2, position: 1, isCover: false })])
    expect(html).toContain('/full.webp')
    expect((html.match(/data-lightbox[\s>]/g) ?? []).length).toBe(2)
  })

  /**
   * O bug que motivou este teste: a classe trazia `flex` sem variante. O
   * navegador esconde um <dialog> fechado pela própria folha de estilo, mas
   * qualquer `display` vindo do autor vence essa regra, então o diálogo ficava
   * ocupando a página desde o carregamento e a foto reaparecia no meio do
   * conteúdo ao fechar. Um display aqui só pode existir atrelado a `[open]`.
   */
  it('não deixa o diálogo ocupar a página enquanto está fechado', async () => {
    const html = await renderizar([foto()])
    const classes = html.match(/<dialog[^>]*class="([^"]*)"/)?.[1]?.split(/\s+/) ?? []
    expect(classes.length).toBeGreaterThan(0)

    const DISPLAY = [
      'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid',
      'inline-grid', 'table', 'inline-table', 'contents', 'flow-root', 'list-item',
    ]
    expect(classes.filter((c) => DISPLAY.includes(c))).toEqual([])
    expect(classes).toContain('hidden')
    expect(classes.some((c) => /^open:/.test(c))).toBe(true)
  })

  it('sem fotos não renderiza diálogo nenhum', async () => {
    const html = await renderizar([])
    expect(html).not.toContain('data-lightbox-dialog')
  })
})
