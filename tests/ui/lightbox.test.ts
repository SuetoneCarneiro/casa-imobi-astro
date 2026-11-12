// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Visualização das fotos em tela cheia.
 *
 * O jsdom não implementa `<dialog>` modal nem `decode()` de imagem, então os
 * dois são substituídos aqui. O que interessa testar é a lógica em volta:
 * qual foto abre, a volta circular e para onde o foco vai ao fechar.
 */
function montar(quantidade = 3) {
  const fotos = Array.from(
    { length: quantidade },
    (_, i) => `
      <a href="/fotos/imovel/${i}/full.webp" data-lightbox aria-label="Ampliar foto ${i + 1}">
        <img src="/fotos/imovel/${i}/md.webp" alt="foto ${i + 1}" />
      </a>`,
  ).join('')

  document.body.innerHTML = `
    <ul>${fotos}</ul>
    <dialog data-lightbox-dialog>
      <img data-lightbox-img alt="" />
      <p data-lightbox-counter></p>
      <button data-lightbox-prev>←</button>
      <button data-lightbox-next>→</button>
      <button data-lightbox-close>×</button>
    </dialog>`

  const dialog = document.querySelector('dialog') as HTMLDialogElement
  dialog.showModal = vi.fn(() => {
    dialog.open = true
  })
  dialog.close = vi.fn(() => {
    dialog.open = false
    dialog.dispatchEvent(new Event('close'))
  })

  return {
    dialog,
    links: [...document.querySelectorAll<HTMLAnchorElement>('a[data-lightbox]')],
    img: document.querySelector('[data-lightbox-img]') as HTMLImageElement,
    contador: document.querySelector('[data-lightbox-counter]') as HTMLElement,
    prev: document.querySelector('[data-lightbox-prev]') as HTMLButtonElement,
    next: document.querySelector('[data-lightbox-next]') as HTMLButtonElement,
  }
}

async function ligar() {
  const { ligarLightbox } = await import('../../src/scripts/lightbox')
  ligarLightbox()
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {} }))
  // A troca para a versão grande não é o alvo destes testes.
  HTMLImageElement.prototype.decode = () => Promise.resolve()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('abertura', () => {
  it('abre na foto que foi clicada, e não sempre na primeira', async () => {
    const { dialog, links, contador } = montar()
    await ligar()

    links[1]!.click()

    expect(dialog.showModal).toHaveBeenCalled()
    expect(contador.textContent).toBe('2 de 3')
  })

  it('trava a rolagem da página enquanto está aberto e devolve ao fechar', async () => {
    const { dialog, links } = montar()
    await ligar()

    links[0]!.click()
    expect(document.documentElement.style.overflow).toBe('hidden')

    dialog.close()
    expect(document.documentElement.style.overflow).toBe('')
  })

  /**
   * Ctrl+clique e Cmd+clique são pedidos explícitos de abrir noutra aba.
   * Interceptá-los tiraria do usuário algo que o link lhe dava de graça.
   */
  it('não intercepta clique com tecla modificadora', async () => {
    const { dialog, links } = montar()
    await ligar()

    const evento = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    links[0]!.dispatchEvent(evento)

    expect(evento.defaultPrevented).toBe(false)
    expect(dialog.showModal).not.toHaveBeenCalled()
  })
})

describe('navegação', () => {
  it('dá a volta ao passar da última para a primeira', async () => {
    const { links, contador, next } = montar()
    await ligar()

    links[2]!.click()
    expect(contador.textContent).toBe('3 de 3')

    next.click()
    expect(contador.textContent).toBe('1 de 3')
  })

  it('dá a volta ao voltar da primeira para a última', async () => {
    const { links, contador, prev } = montar()
    await ligar()

    links[0]!.click()
    prev.click()

    expect(contador.textContent).toBe('3 de 3')
  })

  it.each([
    ['ArrowRight', '2 de 3'],
    ['ArrowLeft', '3 de 3'],
  ])('a tecla %s navega', async (key, esperado) => {
    const { dialog, links, contador } = montar()
    await ligar()

    links[0]!.click()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

    expect(contador.textContent).toBe(esperado)
  })

  it('com uma foto só, o teclado não muda nada', async () => {
    const { dialog, links, contador } = montar(1)
    await ligar()

    links[0]!.click()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

    expect(contador.textContent).toBe('1 de 1')
  })
})

describe('fechamento', () => {
  /**
   * Devolver o foco à foto de onde a pessoa saiu, e não àquela por onde ela
   * entrou, é o que mantém a galeria na posição do que ela estava vendo.
   */
  it('devolve o foco à foto em que parou', async () => {
    const { dialog, links, next } = montar()
    await ligar()

    links[0]!.click()
    next.click()
    next.click()
    dialog.close()

    expect(document.activeElement).toBe(links[2])
  })
})

describe('degradação', () => {
  it('não faz nada quando o navegador não tem dialog modal', async () => {
    const { dialog, links } = montar()
    // @ts-expect-error simula navegador sem suporte
    dialog.showModal = undefined
    await ligar()

    const evento = new MouseEvent('click', { bubbles: true, cancelable: true })
    links[0]!.dispatchEvent(evento)

    // O clique segue livre, então o link leva à imagem grande por conta própria.
    expect(evento.defaultPrevented).toBe(false)
  })
})
