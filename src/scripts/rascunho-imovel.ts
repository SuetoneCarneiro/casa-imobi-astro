/**
 * Guarda e devolve o rascunho do cadastro de imóvel.
 *
 * Quem está preenchendo o formulário e percebe que o bairro ainda não existe
 * precisa sair da página para cadastrá-lo. Sem isto, perderia tudo que já
 * tinha digitado, e o caminho mais curto passaria a ser inventar um bairro
 * parecido com algum da lista.
 *
 * Fica no `sessionStorage` por ser exatamente desta aba e morrer ao fechá-la.
 * Todo acesso vai em try/catch: em aba anônima o navegador pode recusar.
 */
const CHAVE = 'casaimobi:rascunho-imovel'

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/*
 * O estreitamento é por `instanceof`, e não por genérico de querySelector: os
 * tipos do Workers declaram um `Element` próprio, do HTMLRewriter, que conflita
 * com o do DOM na restrição desses genéricos.
 */
function campos(form: HTMLFormElement): Campo[] {
  const saida: Campo[] = []
  for (const el of Array.from(form.querySelectorAll('input[name], select[name], textarea[name]'))) {
    const ehCampo =
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    if (ehCampo && el.type !== 'file') saida.push(el)
  }
  return saida
}

function guardar(form: HTMLFormElement) {
  const dados: Record<string, string[]> = {}
  for (const campo of campos(form)) {
    // Caixa desmarcada não entra, igual ao que o navegador envia num POST.
    if ((campo.type === 'checkbox' || campo.type === 'radio') && !(campo as HTMLInputElement).checked) {
      continue
    }
    ;(dados[campo.name] ??= []).push(campo.value)
  }
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(dados))
  } catch {
    // Sem rascunho a pessoa perde o que digitou, mas o cadastro do bairro
    // continua funcionando. Travar aqui seria pior.
  }
}

function devolver(form: HTMLFormElement) {
  let dados: Record<string, string[]>
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (!bruto) return
    dados = JSON.parse(bruto)
    // Vale uma vez só: um F5 depois não pode ressuscitar rascunho velho.
    sessionStorage.removeItem(CHAVE)
  } catch {
    return
  }

  for (const campo of campos(form)) {
    const valores = dados[campo.name]
    if (campo.type === 'checkbox' || campo.type === 'radio') {
      ;(campo as HTMLInputElement).checked = Boolean(valores?.includes(campo.value))
      continue
    }
    if (valores?.length) campo.value = valores.shift()!
  }
}

export function ligarRascunhoDeImovel() {
  const link = document.querySelector('a[data-novo-bairro]')
  const form = link?.closest('form')
  if (!link || !(form instanceof HTMLFormElement)) return

  link.addEventListener('click', () => guardar(form))

  const params = new URLSearchParams(location.search)
  const novoBairro = params.get('bairro-novo')
  if (!novoBairro && !params.has('restaurar')) return

  devolver(form)

  const select = form.querySelector('select[name="neighborhoodId"]')
  if (novoBairro && select instanceof HTMLSelectElement) {
    select.value = novoBairro
    // Mostra à pessoa que o bairro novo já entrou escolhido.
    select.focus({ preventScroll: true })
    select.scrollIntoView({ block: 'center' })
  }

  // Tira os parâmetros da barra: eles já cumpriram o papel, e deixá-los faria
  // um recarregamento tentar restaurar de novo.
  history.replaceState(null, '', location.pathname + location.hash)
}

ligarRascunhoDeImovel()
