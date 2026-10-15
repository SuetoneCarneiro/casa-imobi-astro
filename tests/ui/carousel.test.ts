// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Comportamento das setas de rolagem horizontal.
 *
 * Aqui mora a lógica que já rendeu dois bugs: seta aparecendo sem ter o que
 * rolar, e seta "anterior" morta por ficar desabilitada.
 */
function montar({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  document.body.innerHTML = `
    <section data-carousel-root>
      <button type="button" data-scroll="prev" hidden>←</button>
      <button type="button" data-scroll="next" hidden>→</button>
      <ul data-track><li>a</li><li>b</li></ul>
    </section>`

  const track = document.querySelector('[data-track]') as HTMLElement
  Object.defineProperty(track, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(track, 'clientWidth', { value: clientWidth, configurable: true })
  track.scrollBy = vi.fn()

  return {
    track,
    prev: document.querySelector('[data-scroll="prev"]') as HTMLButtonElement,
    next: document.querySelector('[data-scroll="next"]') as HTMLButtonElement,
  }
}

beforeEach(() => {
  vi.resetModules()
  // jsdom não traz ResizeObserver; o script só precisa que ele exista e
  // dispare uma vez, como o de verdade faz ao observar.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: () => void) {}
      observe() {
        this.cb()
      }
      disconnect() {}
    },
  )
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {} }))
})

describe('setas', () => {
  it('ficam escondidas quando não há transbordo', async () => {
    const { prev, next } = montar({ scrollWidth: 500, clientWidth: 500 })
    await import('../../src/scripts/carousel')
    expect(prev.hidden).toBe(true)
    expect(next.hidden).toBe(true)
  })

  it('aparecem quando há transbordo', async () => {
    const { prev, next } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')
    expect(prev.hidden).toBe(false)
    expect(next.hidden).toBe(false)
  })

  it('rolam pela largura visível ao clicar', async () => {
    const { track, next } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')

    next.click()
    expect(track.scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 450, behavior: 'smooth' }),
    )
  })

  it('rolam para trás com a seta anterior', async () => {
    const { track, prev } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')

    prev.click()
    expect(track.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: -450 }))
  })
})

describe('estado de ponta', () => {
  it('marca a seta anterior no início', async () => {
    const { prev, next } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')
    expect(prev.dataset.edge).toBe('true')
    expect(next.dataset.edge).toBe('false')
  })

  it('inverte a marcação ao chegar no fim', async () => {
    const { track, prev, next } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')

    track.scrollLeft = 1000
    track.dispatchEvent(new Event('scroll'))

    expect(prev.dataset.edge).toBe('false')
    expect(next.dataset.edge).toBe('true')
  })

  /**
   * A regressão que importa: o estado de ponta é só visual. Se virasse
   * `disabled` de novo, uma falha em atualizá-lo deixaria a seta morta e o
   * visitante sem conseguir voltar.
   */
  it('nunca desabilita o botão de verdade', async () => {
    const { prev, next } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')
    expect(prev.disabled).toBe(false)
    expect(next.disabled).toBe(false)
  })

  it('a seta na ponta continua clicável', async () => {
    const { track, prev } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')

    expect(prev.dataset.edge).toBe('true')
    prev.click()
    expect(track.scrollBy).toHaveBeenCalled()
  })
})

describe('movimento reduzido', () => {
  it('não anima quando o sistema pede menos movimento', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {} }))
    const { track, next } = montar({ scrollWidth: 1500, clientWidth: 500 })
    await import('../../src/scripts/carousel')

    next.click()
    expect(track.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })
})
