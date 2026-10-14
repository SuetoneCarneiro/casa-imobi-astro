/**
 * Setas dos contêineres com rolagem horizontal.
 *
 * Melhoria progressiva: a base é `scroll-snap`, que já funciona no toque e no
 * trackpad sem script. As setas existem porque no desktop com mouse não há
 * gesto de arrastar, então sem elas não dá para navegar.
 *
 * Markup esperado:
 *   [data-carousel-root]
 *     [data-track]              contêiner com overflow-x
 *     [data-scroll="prev"|"next"]  botões, iniciando com `hidden`
 */
export function ligarCarrosseis() {
  document.querySelectorAll<HTMLElement>('[data-carousel-root]').forEach((root) => {
    const track = root.querySelector<HTMLElement>('[data-track]')
    if (!track) return

    const buttons = root.querySelectorAll<HTMLButtonElement>('[data-scroll]')
    if (buttons.length === 0) return

    /**
     * Esconde as setas quando não há o que rolar e desabilita a que já chegou ao
     * fim. Precisa rodar mais de uma vez: ao carregar, o CSS pode ainda não ter
     * aplicado a largura dos itens, e as fontes mudam o layout depois.
     */
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth
      const rolavel = max > 8
      buttons.forEach((button) => {
        button.hidden = !rolavel
        /*
         * Marca a ponta só para efeito visual, via data-edge. Nunca usar
         * `disabled` de verdade: botão desabilitado ignora clique, então
         * qualquer falha em atualizar este estado deixaria a seta morta e o
         * usuário sem conseguir voltar. Dimmed e funcionando é melhor que
         * bonito e quebrado.
         */
        const naPonta =
          button.dataset.scroll === 'next' ? track.scrollLeft >= max - 8 : track.scrollLeft <= 8
        button.dataset.edge = naPonta ? 'true' : 'false'
      })
    }

    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)')

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.dataset.scroll === 'next' ? 1 : -1
        track.scrollBy({
          left: direction * track.clientWidth * 0.9,
          behavior: reduzMovimento.matches ? 'auto' : 'smooth',
        })
      })
    })

    track.addEventListener('scroll', sync, { passive: true })

    const observer = new ResizeObserver(sync)
    observer.observe(track)
    if (track.firstElementChild) observer.observe(track.firstElementChild)

    window.addEventListener('load', sync)
    document.fonts?.ready.then(sync)
  })
}

ligarCarrosseis()
