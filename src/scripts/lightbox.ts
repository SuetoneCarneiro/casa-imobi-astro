/**
 * Visualização das fotos em tela cheia.
 *
 * Melhoria progressiva, como o resto do site: cada foto já é um link para o
 * arquivo grande, então sem JavaScript o navegador abre a imagem por conta
 * própria. Com JavaScript, o clique é interceptado e abre um `<dialog>` modal,
 * que traz de graça o fechamento por Esc, o foco preso dentro e o fundo inerte.
 *
 * Markup esperado:
 *   a[data-lightbox]            uma por foto, href apontando para a versão grande
 *   dialog[data-lightbox-dialog]
 *     img[data-lightbox-img]
 *     [data-lightbox-counter]
 *     button[data-lightbox-prev|next|close]
 */
export function ligarLightbox() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox-dialog]')
  // Sem suporte a <dialog> modal, os links seguem funcionando sozinhos.
  if (!dialog || typeof dialog.showModal !== 'function') return

  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[data-lightbox]')]
  const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]')
  if (links.length === 0 || !img) return

  const contador = dialog.querySelector<HTMLElement>('[data-lightbox-counter]')
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)')
  let atual = 0

  const miniatura = (link: HTMLAnchorElement) => link.querySelector('img')

  const mostrar = (indice: number) => {
    // Circular: da última a seta avança para a primeira. Numa galeria curta,
    // bater numa parede invisível incomoda mais do que dar a volta.
    atual = (indice + links.length) % links.length
    const link = links[atual]!
    const pequena = miniatura(link)

    /*
     * A versão da galeria já está no cache do navegador, então aparece na hora
     * e evita o retângulo vazio enquanto a grande viaja. A troca só acontece se
     * o usuário ainda estiver nesta foto: numa navegação rápida, a imagem que
     * terminar depois não pode sobrescrever a que ele já escolheu.
     */
    if (pequena) {
      img.src = pequena.currentSrc || pequena.src
      img.alt = pequena.alt
    }

    const trocar = () => {
      if (links[atual] === link) img.src = link.href
    }
    const grande = new Image()
    grande.src = link.href
    // `decode` evita o pisca da troca, mas não existe em navegador antigo, e
    // chamá-lo sem checar estoura antes de haver promessa para capturar.
    if (typeof grande.decode === 'function') {
      grande.decode().then(trocar).catch(() => {})
    } else {
      grande.addEventListener('load', trocar)
    }

    if (contador) contador.textContent = `${atual + 1} de ${links.length}`
  }

  const abrir = (indice: number) => {
    mostrar(indice)
    dialog.showModal()
    document.documentElement.style.overflow = 'hidden'
  }

  links.forEach((link, i) => {
    link.addEventListener('click', (evento) => {
      // Deixa passar o que o usuário pediu de propósito: nova aba, download.
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return
      evento.preventDefault()
      abrir(i)
    })
  })

  dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', () => dialog.close())
  dialog.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => mostrar(atual - 1))
  dialog.querySelector('[data-lightbox-next]')?.addEventListener('click', () => mostrar(atual + 1))

  // Clique fora da foto fecha. O alvo só é o próprio dialog na área vazia,
  // porque a imagem e os botões ficam por cima.
  dialog.addEventListener('click', (evento) => {
    if (evento.target === dialog) dialog.close()
  })

  dialog.addEventListener('keydown', (evento) => {
    if (links.length < 2) return
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      mostrar(atual + 1)
    }
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault()
      mostrar(atual - 1)
    }
  })

  // No toque não há seta de teclado nem mouse, e arrastar é o gesto esperado
  // de um visualizador de fotos.
  let inicioX: number | null = null
  img.addEventListener(
    'touchstart',
    (evento) => {
      inicioX = evento.changedTouches[0]?.clientX ?? null
    },
    { passive: true },
  )
  img.addEventListener(
    'touchend',
    (evento) => {
      if (inicioX === null || links.length < 2) return
      const distancia = (evento.changedTouches[0]?.clientX ?? inicioX) - inicioX
      if (Math.abs(distancia) > 50) mostrar(atual + (distancia < 0 ? 1 : -1))
      inicioX = null
    },
    { passive: true },
  )

  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = ''
    /*
     * Devolve o foco à foto em que a pessoa parou, e não àquela de onde ela
     * saiu. Como os links vivem dentro do carrossel, isso também deixa a
     * galeria na mesma posição do que ela estava vendo ampliado.
     */
    const link = links[atual]
    link?.focus({ preventScroll: true })
    link?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduzMovimento.matches ? 'auto' : 'smooth',
    })
  })
}

ligarLightbox()
